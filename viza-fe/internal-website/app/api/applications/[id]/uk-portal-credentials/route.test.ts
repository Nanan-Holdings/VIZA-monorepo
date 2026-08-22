import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProfileId } = vi.hoisted(() => ({
  getProfileId: vi.fn(),
}));

vi.mock("@/lib/application-api-auth", () => ({
  getApplicationApiApplicantProfileId: getProfileId,
}));

import { GET } from "./route";

describe("UK portal credentials route", () => {
  beforeEach(() => {
    getProfileId.mockReset();
  });

  it("requires an authenticated applicant", async () => {
    getProfileId.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never returns runner-managed UKVI credentials to a customer", async () => {
    getProfileId.mockResolvedValue("applicant-id");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(body)).not.toMatch(/password|cipher|resume/i);
  });
});
