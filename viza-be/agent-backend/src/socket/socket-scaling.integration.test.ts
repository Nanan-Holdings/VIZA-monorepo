import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, type Socket as SocketClient } from "socket.io-client";
import { afterAll, describe, expect, it } from "vitest";
import {
  initializeSocketScaling,
  resolveSocketScalingConfig,
  type SocketScalingRuntime,
} from "./socket-scaling.js";

interface SocketTestNode {
  httpServer: http.Server;
  io: SocketIOServer;
  runtime: SocketScalingRuntime;
  url: string;
}

const rawRedisUrl = process.env.SOCKET_IO_REDIS_INTEGRATION_URL?.trim();
const describeWithRedis = rawRedisUrl ? describe : describe.skip;
const nodes: SocketTestNode[] = [];
const clients: SocketClient[] = [];

function requireLoopbackRedisUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SOCKET_IO_REDIS_INTEGRATION_URL must be a valid URL.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "redis:" || !loopbackHosts.has(url.hostname)) {
    throw new Error(
      "SOCKET_IO_REDIS_INTEGRATION_URL must use plaintext Redis on a loopback host.",
    );
  }
  return url.toString();
}

async function createTestNode(redisUrl: string, namespaceName: string): Promise<SocketTestNode> {
  const httpServer = http.createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const io = new SocketIOServer(httpServer, { transports: ["websocket"] });
  const config = resolveSocketScalingConfig({
    NODE_ENV: "test",
    SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
    SOCKET_IO_REDIS_URL: redisUrl,
  });
  const runtime = await initializeSocketScaling(io, config);
  const namespace = io.of(namespaceName);

  namespace.on("connection", (socket) => {
    socket.on("join", async (room: unknown, acknowledge?: () => void) => {
      if (typeof room !== "string") return;
      await socket.join(room);
      acknowledge?.();
    });
    socket.on(
      "broadcast",
      (room: unknown, payload: unknown, acknowledge?: () => void) => {
        if (typeof room !== "string") return;
        namespace.to(room).emit("cross-node", payload);
        acknowledge?.();
      },
    );
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Socket.IO integration node did not bind a TCP port.");
  }

  const node = {
    httpServer,
    io,
    runtime,
    url: `http://127.0.0.1:${address.port}${namespaceName}`,
  };
  nodes.push(node);
  return node;
}

async function connectClient(url: string): Promise<SocketClient> {
  const client = createSocketClient(url, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  clients.push(client);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Socket.IO integration client connection timed out."));
    }, 5_000);
    const finish = (result: "connected" | Error): void => {
      clearTimeout(timeout);
      client.off("connect_error", onError);
      if (result === "connected") resolve();
      else reject(result);
    };
    const onError = (error: Error): void => finish(error);
    client.once("connect", () => finish("connected"));
    client.once("connect_error", onError);
    client.connect();
  });

  return client;
}

async function joinRoom(client: SocketClient, room: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Socket.IO integration room join timed out."));
    }, 5_000);
    client.emit("join", room, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function closeNode(node: SocketTestNode): Promise<void> {
  await new Promise<void>((resolve) => node.io.close(() => resolve()));
  await node.runtime.close();
  if (node.httpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      node.httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describeWithRedis("Socket.IO Redis multi-replica integration", () => {
  afterAll(async () => {
    for (const client of clients) client.disconnect();
    await Promise.allSettled(nodes.reverse().map(closeNode));
  });

  it("delivers a room broadcast between clients connected to different nodes", async () => {
    const redisUrl = requireLoopbackRedisUrl(rawRedisUrl ?? "");
    const namespaceName = `/scale-test-${randomUUID()}`;
    const room = `room-${randomUUID()}`;
    const [firstNode, secondNode] = await Promise.all([
      createTestNode(redisUrl, namespaceName),
      createTestNode(redisUrl, namespaceName),
    ]);
    const [firstClient, secondClient] = await Promise.all([
      connectClient(firstNode.url),
      connectClient(secondNode.url),
    ]);
    await Promise.all([
      joinRoom(firstClient, room),
      joinRoom(secondClient, room),
    ]);

    const payload = { kind: "cross-node-smoke", sequence: 1 };
    const receivedBySecondNode = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Cross-node Socket.IO broadcast timed out."));
      }, 5_000);
      secondClient.once("cross-node", (received: unknown) => {
        clearTimeout(timeout);
        resolve(received);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket.IO broadcast acknowledgement timed out."));
      }, 5_000);
      firstClient.emit("broadcast", room, payload, () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await expect(receivedBySecondNode).resolves.toEqual(payload);
    expect(firstClient.io.engine.transport.name).toBe("websocket");
    expect(secondClient.io.engine.transport.name).toBe("websocket");
  });
});
