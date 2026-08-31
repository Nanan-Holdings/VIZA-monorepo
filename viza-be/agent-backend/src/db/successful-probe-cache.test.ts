import { describe, expect, it, vi } from "vitest";
import { SuccessfulProbeCache } from "./successful-probe-cache.js";

describe("SuccessfulProbeCache", () => {
	it("coalesces one hundred simultaneous successful probes", async () => {
		let release: ((value: { success: boolean; marker: string }) => void) | undefined;
		const factory = vi.fn(
			() => new Promise<{ success: boolean; marker: string }>((resolve) => {
				release = resolve;
			}),
		);
		const cache = new SuccessfulProbeCache(5_000);

		const probes = Array.from({ length: 100 }, () => cache.getOrCreate(factory));
		release?.({ success: true, marker: "ready" });
		const results = await Promise.all(probes);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(results.every((result) => result.marker === "ready")).toBe(true);
		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "ready" });
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("does not cache failures", async () => {
		const factory = vi
			.fn<() => Promise<{ success: boolean; marker: string }>>()
			.mockResolvedValueOnce({ success: false, marker: "offline" })
			.mockResolvedValueOnce({ success: true, marker: "recovered" });
		const cache = new SuccessfulProbeCache(5_000);

		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "offline" });
		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "recovered" });
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("refreshes a successful result after its TTL", async () => {
		let now = 0;
		const factory = vi.fn(async () => ({ success: true, marker: `ready-${now}` }));
		const cache = new SuccessfulProbeCache(5_000, () => now);

		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "ready-0" });
		now = 4_999;
		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "ready-0" });
		now = 5_000;
		await expect(cache.getOrCreate(factory)).resolves.toMatchObject({ marker: "ready-5000" });
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("lets strict callers refresh a snapshot that remains fresh for health callers", async () => {
		let now = 0;
		const factory = vi.fn(async () => ({ success: true, marker: `ready-${now}` }));
		const cache = new SuccessfulProbeCache(5_000, () => now);

		await expect(cache.getOrCreate(factory, 30_000)).resolves.toMatchObject({
			marker: "ready-0",
		});
		now = 6_000;
		await expect(cache.getOrCreate(factory, 30_000)).resolves.toMatchObject({
			marker: "ready-0",
		});
		await expect(cache.getOrCreate(factory, 5_000)).resolves.toMatchObject({
			marker: "ready-6000",
		});
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("coalesces a mixed burst when a strict caller refreshes an older snapshot", async () => {
		let now = 0;
		let release: ((value: { success: boolean; marker: string }) => void) | undefined;
		const factory = vi
			.fn<() => Promise<{ success: boolean; marker: string }>>()
			.mockResolvedValueOnce({ success: true, marker: "initial" })
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}),
			);
		const cache = new SuccessfulProbeCache(5_000, () => now);

		await cache.getOrCreate(factory);
		now = 6_000;
		const probes = [
			cache.getOrCreate(factory, 5_000),
			...Array.from({ length: 99 }, () => cache.getOrCreate(factory, 30_000)),
		];
		release?.({ success: true, marker: "refreshed" });

		const results = await Promise.all(probes);
		expect(results.every((result) => result.marker === "refreshed")).toBe(true);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("rejects an invalid caller-specific max age", async () => {
		const cache = new SuccessfulProbeCache(5_000);

		await expect(
			cache.getOrCreate(async () => ({ success: true }), 0),
		).rejects.toThrow("Probe cache max age must be positive");
	});
});
