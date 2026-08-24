import { describe, expect, it } from "vitest";

import { readOnlineCapacityTargetMarker } from "./online-capacity-target.js";

describe("online capacity target marker", () => {
	it("is disabled by default", () => {
		expect(readOnlineCapacityTargetMarker({})).toBeNull();
	});

	it("derives the staging ref from the actual configured Supabase URL", () => {
		expect(
			readOnlineCapacityTargetMarker({
				ONLINE_CAPACITY_TARGET_ENABLED: "true",
				ONLINE_CAPACITY_TARGET_MODE: "staging-only",
				SUPABASE_URL: "https://stagingref1234567890.supabase.co",
			}),
		).toEqual({
			enabled: true,
			mode: "staging-only",
			projectRef: "stagingref1234567890",
		});
	});

	it("fails closed for a mismatched target mode", () => {
		expect(() =>
			readOnlineCapacityTargetMarker({
				ONLINE_CAPACITY_TARGET_ENABLED: "true",
				ONLINE_CAPACITY_TARGET_MODE: "local-test",
				SUPABASE_URL: "https://stagingref1234567890.supabase.co",
			}),
		).toThrow(/loopback/i);
	});
});
