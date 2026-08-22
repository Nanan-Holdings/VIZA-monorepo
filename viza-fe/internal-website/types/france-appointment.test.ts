import {
  getFranceAppointmentStage,
  type FranceAppointmentStatus,
  type FranceAppointmentStatusSnapshot,
} from "@/types/france-appointment";
import { describe, expect, it } from "vitest";

function snapshot(
  status: FranceAppointmentStatus,
  overrides: Partial<FranceAppointmentStatusSnapshot> = {},
): FranceAppointmentStatusSnapshot {
  return {
    job: {
      id: "job-1",
      applicationId: "application-1",
      userId: "user-1",
      appointmentAccountId: null,
      countryCode: "FR",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      ds160ConfirmationCode: null,
      applyingCountryCode: "CN",
      applyingPostCity: "Shanghai",
      schedulingProvider: "tlscontact_cn_fr",
      status,
      mode: "assisted_live",
      userPreferencesJson: {},
      requiresUserAction: false,
      currentManualAction: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      idempotencyKey: "idempotency-key",
      createdAt: null,
      updatedAt: null,
    },
    account: null,
    review: null,
    pendingManualAction: null,
    manualActions: [],
    slots: [],
    confirmation: null,
    latestStatusCheck: null,
    dryRunNotice: null,
    ...overrides,
  };
}

describe("getFranceAppointmentStage", () => {
  it("uses the persisted job and slot state without a local review override", () => {
    expect(getFranceAppointmentStage(null)).toBe("review");
    expect(getFranceAppointmentStage(snapshot("appointment_account_required"))).toBe("account");
    expect(getFranceAppointmentStage(snapshot("appointment_slots_observed"))).toBe("slots");
    expect(
      getFranceAppointmentStage(
        snapshot("appointment_slots_observed", {
          slots: [
            {
              id: "slot-1",
              jobId: "job-1",
              applicationId: "application-1",
              appointmentDate: "2026-09-01",
              appointmentTime: "09:00",
              appointmentLocation: "Shanghai",
              appointmentType: "short_stay",
              source: "france_tls_live",
              status: "user_selected",
              observedAt: "2026-08-19T00:00:00.000Z",
              expiresAt: "2026-08-19T00:10:00.000Z",
              metadataRedactedJson: {},
            },
          ],
        }),
      ),
    ).toBe("confirm");
  });

  it("returns review for a failed or cancelled persisted attempt", () => {
    expect(getFranceAppointmentStage(snapshot("appointment_failed"))).toBe("review");
    expect(getFranceAppointmentStage(snapshot("appointment_cancelled"))).toBe("review");
  });

  it("returns result only when official confirmation evidence exists", () => {
    expect(
      getFranceAppointmentStage(
        snapshot("appointment_confirmation_captured", {
          confirmation: {
            id: "confirmation-1",
            jobId: "job-1",
            applicationId: "application-1",
            userId: "user-1",
            countryCode: "FR",
            visaType: "EU_SCHENGEN_C_SHORT_STAY",
            appointmentDate: "2026-09-01",
            appointmentTime: "09:00",
            appointmentLocation: "Shanghai",
            appointmentType: "short_stay",
            confirmationNumber: "FR-123",
            confirmationPdfUrl: null,
            confirmationScreenshotUrl: null,
            rawConfirmationRedactedJson: {},
            createdAt: "2026-08-19T00:00:00.000Z",
          },
        }),
      ),
    ).toBe("result");
  });
});
