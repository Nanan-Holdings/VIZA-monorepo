import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Logger } from "../utils/logger.js";

const SOCKET_ADAPTER_KEY = "viza:socket.io";
const REDIS_CONNECT_TIMEOUT_MS = 5_000;
const REDIS_CLOSE_TIMEOUT_MS = 2_000;
const logger = new Logger({ serviceName: "SocketScaling" });

export type SocketTransport = "polling" | "websocket";

export interface SocketScalingConfig {
  mode: "memory" | "redis";
  multiReplicaEnabled: boolean;
  transports: SocketTransport[];
  redisUrl?: string;
}

export interface SocketScalingStatus {
  mode: "memory" | "redis";
  multiReplicaEnabled: boolean;
  adapterReady: boolean;
  transports: SocketTransport[];
}

export interface SocketScalingRedisClient {
  readonly isOpen: boolean;
  readonly isReady: boolean;
  duplicate(): SocketScalingRedisClient;
  on(event: string, listener: (...args: unknown[]) => void): this;
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  destroy(): void;
}

export interface SocketScalingDependencies {
  createRedisClient: (url: string) => SocketScalingRedisClient;
  createRedisAdapter: (
    pubClient: SocketScalingRedisClient,
    subClient: SocketScalingRedisClient,
  ) => unknown;
}

interface SocketScalingServer {
  adapter(adapter: never): unknown;
}

export interface SocketScalingRuntime {
  close: () => Promise<void>;
}

let scalingStatus: SocketScalingStatus = {
  mode: "memory",
  multiReplicaEnabled: false,
  adapterReady: true,
  transports: ["polling", "websocket"],
};

function exactTrue(value: string | undefined): boolean {
  return value === "true";
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function validateRedisUrl(rawUrl: string, nodeEnv: string | undefined): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SOCKET_IO_REDIS_URL must be a valid Redis URL.");
  }

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("SOCKET_IO_REDIS_URL must use redis:// or rediss://.");
  }
  if (!url.hostname) {
    throw new Error("SOCKET_IO_REDIS_URL must include a host.");
  }
  if (nodeEnv === "production" && url.protocol !== "rediss:") {
    throw new Error("SOCKET_IO_REDIS_URL must use TLS (rediss://) in production.");
  }
  if (url.protocol === "redis:" && !isLoopbackHost(url.hostname)) {
    throw new Error("Plaintext redis:// is allowed only for a local loopback host.");
  }
}

export function resolveSocketScalingConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SocketScalingConfig {
  if (!exactTrue(env.SOCKET_IO_MULTI_REPLICA_ENABLED)) {
    return {
      mode: "memory",
      multiReplicaEnabled: false,
      transports: ["polling", "websocket"],
    };
  }

  const redisUrl = env.SOCKET_IO_REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error(
      "SOCKET_IO_REDIS_URL is required when SOCKET_IO_MULTI_REPLICA_ENABLED=true.",
    );
  }
  validateRedisUrl(redisUrl, env.NODE_ENV);

  return {
    mode: "redis",
    multiReplicaEnabled: true,
    transports: ["websocket"],
    redisUrl,
  };
}

export function getSocketScalingStatus(): SocketScalingStatus {
  return {
    ...scalingStatus,
    transports: [...scalingStatus.transports],
  };
}

function setScalingStatus(config: SocketScalingConfig, adapterReady: boolean): void {
  scalingStatus = {
    mode: config.mode,
    multiReplicaEnabled: config.multiReplicaEnabled,
    adapterReady,
    transports: [...config.transports],
  };
}

const defaultDependencies: SocketScalingDependencies = {
  createRedisClient: (url) => createClient({ url }) as unknown as SocketScalingRedisClient,
  createRedisAdapter: (pubClient, subClient) => createAdapter(
    pubClient as never,
    subClient as never,
    { key: SOCKET_ADAPTER_KEY },
  ),
};

async function closeRedisClient(client: SocketScalingRedisClient): Promise<void> {
  if (client.isOpen) {
    try {
      await withinDeadline(
        client.quit(),
        REDIS_CLOSE_TIMEOUT_MS,
        "Socket.IO Redis client close timed out.",
      );
      return;
    } catch (error) {
      try {
        client.destroy();
      } catch {
        // The process-level shutdown deadline remains the final safety net.
      }
      throw error;
    }
  }
  client.destroy();
}

async function withinDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        timeout.unref();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function initializeSocketScaling(
  io: SocketScalingServer,
  config: SocketScalingConfig = resolveSocketScalingConfig(),
  dependencies: SocketScalingDependencies = defaultDependencies,
): Promise<SocketScalingRuntime> {
  setScalingStatus(config, config.mode === "memory");
  if (config.mode === "memory") {
    const closed = Promise.resolve();
    return { close: () => closed };
  }

  const redisUrl = config.redisUrl;
  if (!redisUrl) {
    throw new Error("Socket.IO shared adapter configuration is incomplete.");
  }

  let pubClient: SocketScalingRedisClient | null = null;
  let subClient: SocketScalingRedisClient | null = null;
  let adapterInstalled = false;
  let pubReady = false;
  let subReady = false;
  let closing = false;
  let closePromise: Promise<void> | null = null;

  const refreshReady = (): void => {
    scalingStatus = {
      ...scalingStatus,
      adapterReady: adapterInstalled && pubReady && subReady,
    };
  };
  const bindLifecycle = (
    client: SocketScalingRedisClient,
    role: "publisher" | "subscriber",
  ): void => {
    client.on("ready", () => {
      if (role === "publisher") pubReady = true;
      else subReady = true;
      refreshReady();
    });
    for (const event of ["error", "end", "reconnecting"] as const) {
      client.on(event, () => {
        if (role === "publisher") pubReady = false;
        else subReady = false;
        refreshReady();
        if (!closing) {
          logger.warn("socket_adapter_client_unavailable", undefined, { role, event });
        }
      });
    }
  };
  const close = (): Promise<void> => {
    if (closePromise) return closePromise;
    closing = true;
    scalingStatus = { ...scalingStatus, adapterReady: false };
    closePromise = (async () => {
      const results = await Promise.allSettled([
        pubClient ? closeRedisClient(pubClient) : Promise.resolve(),
        subClient ? closeRedisClient(subClient) : Promise.resolve(),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failure) {
        throw new Error("Socket.IO shared adapter failed to close cleanly.");
      }
    })();
    return closePromise;
  };

  try {
    pubClient = dependencies.createRedisClient(redisUrl);
    subClient = pubClient.duplicate();
    bindLifecycle(pubClient, "publisher");
    bindLifecycle(subClient, "subscriber");
    await Promise.all([
      withinDeadline(
        pubClient.connect(),
        REDIS_CONNECT_TIMEOUT_MS,
        "Socket.IO publisher connect timed out.",
      ),
      withinDeadline(
        subClient.connect(),
        REDIS_CONNECT_TIMEOUT_MS,
        "Socket.IO subscriber connect timed out.",
      ),
    ]);
    pubReady = pubClient.isReady;
    subReady = subClient.isReady;
    io.adapter(dependencies.createRedisAdapter(pubClient, subClient) as never);
    adapterInstalled = true;
    refreshReady();
    if (!scalingStatus.adapterReady) {
      throw new Error("Socket.IO Redis clients did not become ready.");
    }
    return { close };
  } catch {
    await close().catch(() => undefined);
    throw new Error("Socket.IO shared adapter failed to initialize.");
  }
}
