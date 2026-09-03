import { beforeEach, describe, expect, it, vi } from "vitest";

const getApplicationApiApplicantProfileIdMock = vi.hoisted(() => vi.fn());
const createNewArrivalCardApplicationForApplicantMock = vi.hoisted(() =>
  vi.fn()
);

vi.mock("@/lib/application-api-auth", () => ({
  getApplicationApiApplicantProfileId: getApplicationApiApplicantProfileIdMock,
}));
vi.mock("@/features/arrival-cards/server/create-new-application", () => ({
  createNewArrivalCardApplicationForApplicant:
    createNewArrivalCardApplicationForApplicantMock,
}));

import { POST } from "./route";

describe("arrival-card new-application route", () => {
  beforeEach(() => {
    getApplicationApiApplicantProfileIdMock.mockReset();
    createNewArrivalCardApplicationForApplicantMock.mockReset();
  });

  it("accepts VIZA's signed client session identity", async () => {
    getApplicationApiApplicantProfileIdMock.mockResolvedValue("profile-1");
    createNewArrivalCardApplicationForApplicantMock.mockResolvedValue({
      applicationId: "new-application-1",
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
      status: 201,
    });

    const response = await POST(
      new Request(
        "https://viza.test/api/applications/source-1/arrival-card-new-application",
        {
          method: "POST",
        }
      ),
      { params: Promise.resolve({ id: "source-1" }) }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      applicationId: "new-application-1",
      country: "south_korea",
      visaType: "KR_E_ARRIVAL_CARD",
    });
    expect(
      createNewArrivalCardApplicationForApplicantMock
    ).toHaveBeenCalledWith("profile-1", "source-1");
    expect(getApplicationApiApplicantProfileIdMock).toHaveBeenCalledWith({
      supabaseRequestTimeoutMs: 8_000,
    });
  });

  it("returns 401 when neither VIZA nor Supabase identity is available", async () => {
    getApplicationApiApplicantProfileIdMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "https://viza.test/api/applications/source-1/arrival-card-new-application",
        {
          method: "POST",
        }
      ),
      { params: Promise.resolve({ id: "source-1" }) }
    );

    expect(response.status).toBe(401);
    expect(
      createNewArrivalCardApplicationForApplicantMock
    ).not.toHaveBeenCalled();
  });
});
