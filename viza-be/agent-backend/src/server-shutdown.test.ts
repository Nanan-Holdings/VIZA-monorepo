import { createServer } from "node:http";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, Socket } from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBoundedServerShutdown } from "./server-shutdown.js";

describe("bounded server shutdown", () => {
	let client: Socket | null = null;

	afterEach(() => {
		client?.disconnect();
		client = null;
	});

	it("disconnects a real upgraded socket before closing the database pool", async () => {
		const httpServer = createServer();
		const io = new SocketIOServer(httpServer, { transports: ["websocket"] });
		httpServer.listen(0, "127.0.0.1");
		await once(httpServer, "listening");
		const { port } = httpServer.address() as AddressInfo;
		client = createSocketClient(`http://127.0.0.1:${port}`, {
			forceNew: true,
			transports: ["websocket"],
			reconnection: false,
		});
		await once(client, "connect");
		expect(client.io.engine.transport.name).toBe("websocket");

		const closeOrder: string[] = [];
		client.on("disconnect", () => closeOrder.push("socket"));
		const closeDatabase = vi.fn(async () => {
			closeOrder.push("database");
		});
		const beforeClose = vi.fn();
		const shutdown = createBoundedServerShutdown({
			io,
			closeDatabase,
			beforeClose,
			timeoutMs: 1_000,
		});

		const first = shutdown();
		const second = shutdown();
		expect(first).toBe(second);
		await first;

		expect(beforeClose).toHaveBeenCalledTimes(1);
		expect(closeDatabase).toHaveBeenCalledTimes(1);
		expect(client.connected).toBe(false);
		expect(httpServer.listening).toBe(false);
		expect(closeOrder).toEqual(["socket", "database"]);
	});

	it("rejects one shared shutdown promise at the configured deadline", async () => {
		vi.useFakeTimers();
		const httpServer = createServer();
		const io = new SocketIOServer(httpServer);
		const closeDatabase = vi.fn(
			() => new Promise<void>(() => undefined),
		);
		const shutdown = createBoundedServerShutdown({
			io,
			closeDatabase,
			timeoutMs: 250,
		});

		const result = shutdown();
		const rejection = expect(result).rejects.toThrow(/250ms/u);
		await vi.advanceTimersByTimeAsync(250);
		await rejection;
		expect(closeDatabase).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});
});
