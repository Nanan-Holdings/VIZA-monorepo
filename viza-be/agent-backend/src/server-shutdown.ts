import type { Server as SocketIOServer } from "socket.io";

export interface BoundedServerShutdownOptions {
	io: Pick<SocketIOServer, "close" | "disconnectSockets">;
	closeDatabase: () => Promise<void>;
	beforeClose?: () => void;
	afterSocketClose?: () => Promise<void> | void;
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
			let closeError: unknown;
			try {
				await closeSocketIoAndHttp(options.io);
			} catch (error) {
				closeError = error;
			}

			try {
				await options.afterSocketClose?.();
			} catch (error) {
				closeError ??= error;
			}

			try {
				await options.closeDatabase();
			} catch (error) {
				closeError ??= error;
			}
			if (closeError) throw closeError;
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
