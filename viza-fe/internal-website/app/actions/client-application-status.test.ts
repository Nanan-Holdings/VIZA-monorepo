import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientStatusData, isValidClientStatusApplicationId } = vi.hoisted(() => ({
  getClientStatusData: vi.fn(),
  isValidClientStatusApplicationId: vi.fn(),
}));

vi.mock("@/app/client/status/status-data", () => ({
  getClientStatusData,
  isValidClientStatusApplicationId,
}));

import {
  getClientApplicationStatus,
  getClientApplicationStatuses,
} from "./client-application-status";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const application = {
  id: APPLICATION_ID,
  key: "singapore:SG_ARRIVAL_CARD",
  country: "singapore",
  visaType: "SG_ARRIVAL_CARD",
};

beforeEach(() => {
  getClientStatusData.mockReset();
  isValidClientStatusApplicationId.mockReset();
});

describe("getClientApplicationStatus", () => {
  it.each(["", " ", "not-a-uuid"])('rejects invalid selector "%s" without loading status data', async (applicationId) => {
    isValidClientStatusApplicationId.mockReturnValue(false);

    await expect(getClientApplicationStatus(applicationId)).resolves.toBeNull();

    expect(isValidClientStatusApplicationId).toHaveBeenCalledWith(applicationId.trim());
    expect(getClientStatusData).not.toHaveBeenCalled();
  });

  it("trims a valid selector and returns only the selected authenticated application", async () => {
    isValidClientStatusApplicationId.mockReturnValue(true);
    getClientStatusData.mockResolvedValue({
      authenticated: true,
      partialData: false,
      applications: [application],
      detailApplications: [application],
    });

    await expect(getClientApplicationStatus(`  ${APPLICATION_ID}  `)).resolves.toEqual(application);

    expect(isValidClientStatusApplicationId).toHaveBeenCalledWith(APPLICATION_ID);
    expect(getClientStatusData).toHaveBeenCalledWith({ applicationId: APPLICATION_ID });
  });

  it("does not expose a scoped result when authentication is unavailable", async () => {
    isValidClientStatusApplicationId.mockReturnValue(true);
    getClientStatusData.mockResolvedValue({
      authenticated: false,
      partialData: false,
      applications: [],
      detailApplications: [],
    });

    await expect(getClientApplicationStatus(APPLICATION_ID)).resolves.toBeNull();
    expect(getClientStatusData).toHaveBeenCalledWith({ applicationId: APPLICATION_ID });
  });

  it("returns the full status list through the unscoped action", async () => {
    getClientStatusData.mockResolvedValue({
      authenticated: true,
      partialData: true,
      applications: [{ key: "singapore" }],
      detailApplications: [application],
    });

    await expect(getClientApplicationStatuses()).resolves.toEqual({
      authenticated: true,
      partialData: true,
      applications: [application],
    });
    expect(getClientStatusData).toHaveBeenCalledWith();
  });
});
