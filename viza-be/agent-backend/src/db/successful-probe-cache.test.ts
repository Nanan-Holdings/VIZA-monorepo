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
});
