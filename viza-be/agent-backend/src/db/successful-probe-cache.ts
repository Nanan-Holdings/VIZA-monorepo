type SuccessfulProbeResult = {
	success: boolean;
};

type CachedProbe<T> = {
	fetchedAt: number;
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
		private readonly defaultMaxAgeMs: number,
		private readonly now = () => Date.now(),
	) {
		if (!Number.isFinite(defaultMaxAgeMs) || defaultMaxAgeMs < 1) {
			throw new Error("Probe cache TTL must be positive");
		}
	}

	async getOrCreate(
		factory: () => Promise<T>,
		maxAgeMs = this.defaultMaxAgeMs,
	): Promise<T> {
		if (!Number.isFinite(maxAgeMs) || maxAgeMs < 1) {
			throw new Error("Probe cache max age must be positive");
		}

		const now = this.now();
		if (this.cached && now - this.cached.fetchedAt < maxAgeMs) {
			return this.cached.value;
		}
		this.cached = null;

		if (this.inFlight) return this.inFlight;

		const pending = factory()
			.then((value) => {
				// clear() can invalidate a lookup while its factory is still running.
				// Existing callers may finish, but the old lookup must not repopulate
				// the cache or replace a newer successful result.
				if (value.success && this.inFlight === pending) {
					this.cached = {
						fetchedAt: this.now(),
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
