import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApplicationApiApplicantProfileId } = vi.hoisted(() => ({
  getApplicationApiApplicantProfileId: vi.fn(),
}));

vi.mock("@/lib/application-api-auth", () => ({ getApplicationApiApplicantProfileId }));

import { GET } from "./route";

describe("retired Taiwan handoff route", () => {
  beforeEach(() => {
    getApplicationApiApplicantProfileId.mockReset().mockResolvedValue("profile-id");
  });

  it("never returns or claims an official-site handoff", async () => {
    const response = await GET();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "台湾申请现由 VIZA 在后台提交，请返回申请最终核对页完成授权。",
      code: "taiwan_handoff_retired",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps the endpoint behind applicant authentication", async () => {
    getApplicationApiApplicantProfileId.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
