import { afterEach, describe, expect, it, vi } from "vitest";
import { describeParameterTypes, fingerprintSql } from "./connection-config.js";

const supabaseMocks = vi.hoisted(() => ({
	rpc: vi.fn(),
}));

vi.mock("./supabase-client.js", () => ({
	getSupabaseClient: () => ({ rpc: supabaseMocks.rpc }),
}));

describe("Supabase adapter telemetry", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		supabaseMocks.rpc.mockReset();
	});

	it("logs only a SHA-256 fingerprint and parameter shape for search_query", async () => {
		const sensitiveQuery = "passport E99990000 applicant private phrase";
		supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });
		const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
		const { hybridSearchFaqChunks } = await import("./supabase-adapter.js");

		await hybridSearchFaqChunks([0.1, 0.2], sensitiveQuery, 5, 0.7);

		const logOutput = JSON.stringify(debug.mock.calls);
		const debugEvent = JSON.parse(String(debug.mock.calls[0]?.[0])) as Record<
			string,
			unknown
		>;
		expect(logOutput).not.toContain(sensitiveQuery);
		expect(logOutput).not.toContain("E99990000");
		expect(debugEvent).toMatchObject({
			queryFingerprint: fingerprintSql(sensitiveQuery),
			parameterCount: 1,
			parameterTypes: describeParameterTypes([sensitiveQuery]),
		});
		expect(supabaseMocks.rpc).toHaveBeenCalledWith(
			"hybrid_search_faq_chunks",
			expect.objectContaining({ search_query: sensitiveQuery }),
		);
	});
});
