import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSocketScalingStatus,
  initializeSocketScaling,
  resolveSocketScalingConfig,
  type SocketScalingDependencies,
  type SocketScalingRedisClient,
} from "./socket-scaling.js";

class FakeRedisClient implements SocketScalingRedisClient {
  isOpen = false;
  isReady = false;
  connectError: Error | null = null;
  readonly connect = vi.fn(async () => {
    if (this.connectError) throw this.connectError;
    this.isOpen = true;
    this.isReady = true;
    this.emit("ready");
  });
  readonly quit = vi.fn(async () => {
    this.isOpen = false;
    this.isReady = false;
    this.emit("end");
  });
  readonly destroy = vi.fn(() => {
    this.isOpen = false;
    this.isReady = false;
  });
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(private readonly duplicateClient?: FakeRedisClient) {}

  duplicate(): SocketScalingRedisClient {
    if (!this.duplicateClient) throw new Error("Missing fake duplicate client");
    return this.duplicateClient;
  }

  on(event: string, listener: () => void): this {
    const current = this.listeners.get(event) ?? [];
    current.push(listener);
    this.listeners.set(event, current);
    return this;
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

function createDependencies(pubClient: FakeRedisClient): SocketScalingDependencies {
  return {
    createRedisClient: vi.fn(() => pubClient),
    createRedisAdapter: vi.fn(() => ({ adapter: "fake" })),
  };
}

describe("Socket.IO scaling configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves polling plus WebSocket with the in-memory adapter by default", () => {
    const config = resolveSocketScalingConfig({ NODE_ENV: "production" });

    expect(config).toEqual({
      mode: "memory",
      multiReplicaEnabled: false,
      transports: ["polling", "websocket"],
    });
    expect(resolveSocketScalingConfig({
      SOCKET_IO_MULTI_REPLICA_ENABLED: " true ",
    }).multiReplicaEnabled).toBe(false);
  });

  it("fails closed when multi-replica mode has no shared adapter URL", () => {
    expect(() => resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
    })).toThrow("SOCKET_IO_REDIS_URL is required");
  });

  it("requires TLS for production and permits plaintext only on a local development loopback", () => {
    expect(() => resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "redis://redis.internal:6379",
    })).toThrow("TLS");

    expect(() => resolveSocketScalingConfig({
      NODE_ENV: "development",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "redis://redis.internal:6379",
    })).toThrow("loopback");

    expect(resolveSocketScalingConfig({
      NODE_ENV: "development",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "redis://127.0.0.1:6379",
    })).toMatchObject({
      mode: "redis",
      multiReplicaEnabled: true,
      transports: ["websocket"],
    });

    expect(resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://socket-user:secret@redis.internal:6379/0",
    })).toMatchObject({ mode: "redis", transports: ["websocket"] });
  });
});

describe("Socket.IO shared adapter lifecycle", () => {
  it("connects both clients, installs the adapter, reports only aggregate state, and closes idempotently", async () => {
    const subClient = new FakeRedisClient();
    const pubClient = new FakeRedisClient(subClient);
    const dependencies = createDependencies(pubClient);
    const adapter = vi.fn();
    const config = resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://socket-user:secret@redis.internal:6379/0",
    });

    const runtime = await initializeSocketScaling({ adapter }, config, dependencies);

    expect(pubClient.connect).toHaveBeenCalledTimes(1);
    expect(subClient.connect).toHaveBeenCalledTimes(1);
    expect(dependencies.createRedisAdapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(getSocketScalingStatus()).toEqual({
      mode: "redis",
      multiReplicaEnabled: true,
      adapterReady: true,
      transports: ["websocket"],
    });
    expect(JSON.stringify(getSocketScalingStatus())).not.toMatch(/redis\.internal|secret|socket-user/u);

    const first = runtime.close();
    const second = runtime.close();
    expect(first).toBe(second);
    await first;
    expect(pubClient.quit).toHaveBeenCalledTimes(1);
    expect(subClient.quit).toHaveBeenCalledTimes(1);
    expect(getSocketScalingStatus().adapterReady).toBe(false);
  });

  it("cleans up both clients and never installs a half-connected adapter", async () => {
    const subClient = new FakeRedisClient();
    subClient.connectError = new Error("rediss://socket-user:secret@redis.internal failed");
    const pubClient = new FakeRedisClient(subClient);
    const dependencies = createDependencies(pubClient);
    const adapter = vi.fn();
    const config = resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://socket-user:secret@redis.internal:6379/0",
    });

    await expect(initializeSocketScaling({ adapter }, config, dependencies))
      .rejects.toThrow("shared adapter failed to initialize");

    expect(adapter).not.toHaveBeenCalled();
    expect(pubClient.quit).toHaveBeenCalledTimes(1);
    expect(subClient.destroy).toHaveBeenCalledTimes(1);
    expect(getSocketScalingStatus().adapterReady).toBe(false);
  });

  it("redacts client-construction failures before startup logging can observe them", async () => {
    const config = resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://socket-user:secret@redis.internal:6379/0",
    });
    const dependencies: SocketScalingDependencies = {
      createRedisClient: () => {
        throw new Error("rediss://socket-user:secret@redis.internal rejected");
      },
      createRedisAdapter: vi.fn(),
    };

    const rejection = initializeSocketScaling(
      { adapter: vi.fn() },
      config,
      dependencies,
    );
    await expect(rejection).rejects.toThrow(
      "Socket.IO shared adapter failed to initialize.",
    );
    await expect(rejection).rejects.not.toThrow(/redis\.internal|secret|socket-user/u);
    expect(getSocketScalingStatus().adapterReady).toBe(false);
  });

  it("marks the adapter unavailable when either Redis client emits an error", async () => {
    const subClient = new FakeRedisClient();
    const pubClient = new FakeRedisClient(subClient);
    const config = resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://redis.internal:6379",
    });
    const runtime = await initializeSocketScaling(
      { adapter: vi.fn() },
      config,
      createDependencies(pubClient),
    );

    subClient.emit("error");
    expect(getSocketScalingStatus().adapterReady).toBe(false);
    await runtime.close();
  });

  it("redacts adapter close failures", async () => {
    const subClient = new FakeRedisClient();
    const pubClient = new FakeRedisClient(subClient);
    const config = resolveSocketScalingConfig({
      NODE_ENV: "production",
      SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
      SOCKET_IO_REDIS_URL: "rediss://socket-user:secret@redis.internal:6379",
    });
    const runtime = await initializeSocketScaling(
      { adapter: vi.fn() },
      config,
      createDependencies(pubClient),
    );
    pubClient.quit.mockRejectedValueOnce(
      new Error("rediss://socket-user:secret@redis.internal close failed"),
    );

    const rejection = runtime.close();
    await expect(rejection).rejects.toThrow(
      "Socket.IO shared adapter failed to close cleanly.",
    );
    await expect(rejection).rejects.not.toThrow(/redis\.internal|secret|socket-user/u);
    expect(pubClient.destroy).toHaveBeenCalledTimes(1);
  });

  it("bounds startup when Redis never settles and destroys unopened clients", async () => {
    vi.useFakeTimers();
    try {
      const subClient = new FakeRedisClient();
      const pubClient = new FakeRedisClient(subClient);
      pubClient.connect.mockImplementation(() => new Promise(() => undefined));
      subClient.connect.mockImplementation(() => new Promise(() => undefined));
      const config = resolveSocketScalingConfig({
        NODE_ENV: "production",
        SOCKET_IO_MULTI_REPLICA_ENABLED: "true",
        SOCKET_IO_REDIS_URL: "rediss://redis.internal:6379",
      });

      const initialization = initializeSocketScaling(
        { adapter: vi.fn() },
        config,
        createDependencies(pubClient),
      );
      const rejection = expect(initialization).rejects.toThrow(
        "Socket.IO shared adapter failed to initialize.",
      );
      await vi.advanceTimersByTimeAsync(5_000);
      await rejection;
      expect(pubClient.destroy).toHaveBeenCalledTimes(1);
      expect(subClient.destroy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
