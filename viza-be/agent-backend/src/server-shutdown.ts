import type { Server as SocketIOServer } from "socket.io";

export interface BoundedServerShutdownOptions {
	io: Pick<SocketIOServer, "close" | "disconnectSockets">;
	closeDatabase: () => Promise<void>;
	beforeClose?: () => void;
	timeoutMs: number;
}

function closeSocketIoAndHttp(
	io: Pick<SocketIOServer, "close" | "disconnectSockets">,
): Promise<void> {
	io.disconnectSockets(true);
	return new Promise<void>((resolve, reject) => {
		void io.close((error?: Error) => {
			if (error) reject(error);
			else resolve();
		}).catch(reject);
	});
}

export function createBoundedServerShutdown(
	options: BoundedServerShutdownOptions,
): () => Promise<void> {
	let shutdownPromise: Promise<void> | null = null;

	return (): Promise<void> => {
		if (shutdownPromise) return shutdownPromise;

		const gracefulClose = (async (): Promise<void> => {
			options.beforeClose?.();
			let realtimeCloseError: unknown;
			try {
				await closeSocketIoAndHttp(options.io);
			} catch (error) {
				realtimeCloseError = error;
			}

			await options.closeDatabase();
			if (realtimeCloseError) throw realtimeCloseError;
		})();

		shutdownPromise = new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(
					new Error(`Graceful server shutdown exceeded ${options.timeoutMs}ms.`),
				);
			}, options.timeoutMs);

			void gracefulClose.then(
				() => {
					clearTimeout(timeout);
					resolve();
				},
				(error: unknown) => {
					clearTimeout(timeout);
					reject(error);
				},
			);
		});

		return shutdownPromise;
	};
}
