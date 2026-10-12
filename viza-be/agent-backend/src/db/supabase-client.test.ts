import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	abortSignal: vi.fn(),
	createClient: vi.fn(),
	eq: vi.fn(),
	from: vi.fn(),
	limit: vi.fn(),
	loggerError: vi.fn(),
	loggerInfo: vi.fn(),
	maybeSingle: vi.fn(),
	order: vi.fn(),
	select: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: mocks.createClient,
}));

vi.mock("../utils/logger.js", () => ({
	Logger: class {
		info = mocks.loggerInfo;
		error = mocks.loggerError;
	},
}));

import {
	clearSupabaseProbeCachesForTests,
	testActiveKnowledgeRelease,
	testSupabaseConnection,
} from "./supabase-client.js";

const builder = {
	abortSignal: mocks.abortSignal,
	eq: mocks.eq,
	limit: mocks.limit,
	maybeSingle: mocks.maybeSingle,
	order: mocks.order,
	select: mocks.select,
};

describe("Supabase readiness probe", () => {
	beforeEach(() => {
		clearSupabaseProbeCachesForTests();
		for (const mock of Object.values(mocks)) mock.mockReset();
		mocks.createClient.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue(builder);
		mocks.select.mockReturnValue(builder);
		mocks.eq.mockReturnValue(builder);
		mocks.limit.mockReturnValue(builder);
		mocks.order.mockReturnValue(builder);
		process.env.SUPABASE_URL = "https://example.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
	});

	it("uses an existence-only HEAD query and coalesces a cold burst", async () => {
		mocks.abortSignal.mockResolvedValue({ error: null });

		const results = await Promise.all(
			Array.from({ length: 100 }, () => testSupabaseConnection(1_000)),
		);

		expect(results.every((result) => result.success)).toBe(true);
		expect(mocks.from).toHaveBeenCalledTimes(1);
		expect(mocks.from).toHaveBeenCalledWith("applicant_profiles");
		expect(mocks.select).toHaveBeenCalledWith("id", { head: true });
		expect(mocks.limit).toHaveBeenCalledWith(1);
		expect(mocks.abortSignal).toHaveBeenCalledTimes(1);

		await expect(testSupabaseConnection(1_000)).resolves.toMatchObject({
			success: true,
		});
		expect(mocks.abortSignal).toHaveBeenCalledTimes(1);
	});

	it("immediately retries a failed dependency check", async () => {
		mocks.abortSignal
			.mockResolvedValueOnce({ error: { message: "temporarily offline" } })
			.mockResolvedValueOnce({ error: null });

		await expect(testSupabaseConnection(1_000)).resolves.toMatchObject({
			success: false,
			error: "temporarily offline",
		});
		await expect(testSupabaseConnection(1_000)).resolves.toMatchObject({
			success: true,
		});
		expect(mocks.abortSignal).toHaveBeenCalledTimes(2);
	});

	it("coalesces the active knowledge release health probe", async () => {
		mocks.abortSignal.mockReturnValue(builder);
		mocks.maybeSingle.mockResolvedValue({
			data: { id: "release-id", release_key: "release-key" },
			error: null,
		});

		const results = await Promise.all(
			Array.from({ length: 100 }, () => testActiveKnowledgeRelease(1_000)),
		);

		expect(results.every((result) => result.success)).toBe(true);
		expect(results.every((result) => result.releaseKey === "release-key")).toBe(true);
		expect(mocks.from).toHaveBeenCalledTimes(1);
		expect(mocks.from).toHaveBeenCalledWith("visa_knowledge_releases");
		expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
	});
});
