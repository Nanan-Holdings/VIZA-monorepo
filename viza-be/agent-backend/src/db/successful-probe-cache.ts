type SuccessfulProbeResult = {
	success: boolean;
};

type CachedProbe<T> = {
	expiresAt: number;
	value: T;
};

/**
 * Coalesces dependency-probe bursts and briefly reuses only successful checks.
 * Failures remain immediately retryable so readiness cannot stay red because
 * of a cached transient outage.
 */
export class SuccessfulProbeCache<T extends SuccessfulProbeResult> {
	private cached: CachedProbe<T> | null = null;
	private inFlight: Promise<T> | null = null;

	constructor(
		private readonly ttlMs: number,
		private readonly now = () => Date.now(),
	) {
		if (!Number.isFinite(ttlMs) || ttlMs < 1) {
			throw new Error("Probe cache TTL must be positive");
		}
	}

	async getOrCreate(factory: () => Promise<T>): Promise<T> {
		if (this.cached && this.cached.expiresAt > this.now()) {
			return this.cached.value;
		}
		this.cached = null;

		if (this.inFlight) return this.inFlight;

		const pending = factory()
			.then((value) => {
				if (value.success) {
					this.cached = {
						expiresAt: this.now() + this.ttlMs,
						value,
					};
				}
				return value;
			})
			.finally(() => {
				if (this.inFlight === pending) this.inFlight = null;
			});
		this.inFlight = pending;
		return pending;
	}

	clear(): void {
		this.cached = null;
		this.inFlight = null;
	}
}
