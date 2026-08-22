import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FranceAppointmentAssistant } from "./france-appointment-assistant";
import type { FranceAppointmentStatusSnapshot } from "@/types/france-appointment";

const mockApi = vi.hoisted(() => ({
  getFranceAppointmentStatus: vi.fn(),
  recordFranceAppointmentConsent: vi.fn(),
  createFranceAppointmentJob: vi.fn(),
  runFranceAppointmentJob: vi.fn(),
  checkFranceAppointmentSlots: vi.fn(),
  selectFranceAppointmentSlot: vi.fn(),
  recordFrancePaymentSession: vi.fn(),
  approveFranceAppointmentFinalConfirmation: vi.fn(),
  bookSelectedFranceAppointmentSlot: vi.fn(),
  cancelFranceAppointmentJob: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/france-appointment/client", () => ({
  ...mockApi,
  FranceAppointmentApiError: class FranceAppointmentApiError extends Error {
    code = "test_error";
  },
}));

function liveSnapshot(): FranceAppointmentStatusSnapshot {
  return {
    job: {
      id: "job-1",
      applicationId: "application-1",
      userId: "user-1",
      appointmentAccountId: "account-1",
      countryCode: "FR",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      ds160ConfirmationCode: null,
      applyingCountryCode: "CN",
      applyingPostCity: "Shanghai",
      schedulingProvider: "tlscontact_cn_fr",
      status: "appointment_slots_observed",
      mode: "assisted_live",
      userPreferencesJson: { centerCode: "shanghai" },
      requiresUserAction: true,
      currentManualAction: "slot_selection",
      lastErrorCode: null,
      lastErrorMessage: null,
      idempotencyKey: "idempotency-key",
      createdAt: null,
      updatedAt: null,
    },
    account: {
      id: "account-1",
      applicationId: "application-1",
      accountEmail: "a•••@example.com",
      accountStatus: "logged_in",
      emailVerified: true,
      lastLoginAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    },
    review: {
      fullName: "Example Applicant",
      dateOfBirth: "1990-01-01",
      nationality: "China",
      passportNumber: "P1234567",
      passportExpiryDate: "2030-01-01",
      phone: "+8613800000000",
      email: "applicant@example.com",
      address: "Shanghai",
      franceVisasReferenceMasked: "FR••••7890",
      centerCode: "shanghai",
      centerName: "Shanghai",
      missingFields: [],
      complete: true,
    },
    pendingManualAction: null,
    manualActions: [],
    slots: [
      {
        id: "slot-1",
        jobId: "job-1",
        applicationId: "application-1",
        appointmentDate: "2026-09-01",
        appointmentTime: "09:00",
        appointmentLocation: "Shanghai TLScontact",
        appointmentType: "short_stay",
        source: "france_tls_live",
        status: "observed",
        observedAt: "2026-08-19T00:00:00.000Z",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        metadataRedactedJson: {},
      },
      {
        id: "expired-slot",
        jobId: "job-1",
        applicationId: "application-1",
        appointmentDate: "2026-08-20",
        appointmentTime: "09:30",
        appointmentLocation: "Expired TLScontact observation",
        appointmentType: "short_stay",
        source: "france_tls_live",
        status: "observed",
        observedAt: "2026-08-19T00:00:00.000Z",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        metadataRedactedJson: {},
      },
    ],
    confirmation: null,
    latestStatusCheck: null,
    dryRunNotice: null,
  };
}

describe("FranceAppointmentAssistant assisted-live observation", () => {
  it("shows only non-expired observed slots without selection or payment controls", async () => {
    mockApi.getFranceAppointmentStatus.mockResolvedValue(liveSnapshot());

    render(<FranceAppointmentAssistant applicationId="application-1" />);

    await waitFor(() => expect(screen.getByText("slots.observedOnly")).toBeInTheDocument());
    expect(screen.queryByText("Expired TLScontact observation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "slots.choose" })).not.toBeInTheDocument();
    expect(screen.queryByText("payment.last4")).not.toBeInTheDocument();
    expect(screen.queryByText("final.book")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "panel.checkSlots" })).toBeInTheDocument();
  });

  it("keeps slot observation retryable after a persisted live checkpoint", async () => {
    const retryable = liveSnapshot();
    retryable.job!.status = "appointment_manual_required";
    retryable.job!.userPreferencesJson.referenceReady = true;
    retryable.slots = [];
    retryable.pendingManualAction = {
      id: "action-1",
      jobId: "job-1",
      applicationId: "application-1",
      userId: "user-1",
      actionType: "worker_readiness_timeout",
      status: "pending",
      instruction: "Retry the official observation.",
      userInputSchemaJson: null,
      userInputRedactedJson: null,
      screenshotUrl: null,
      expiresAt: null,
      metadataRedactedJson: { retryable: true },
      createdAt: "2026-08-19T00:00:00.000Z",
      completedAt: null,
    };
    mockApi.getFranceAppointmentStatus.mockResolvedValue(retryable);

    render(<FranceAppointmentAssistant applicationId="application-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "panel.checkSlots" })).toBeInTheDocument();
    });
  });

  it("renders the persisted official no-slots observation without action controls", async () => {
    const noSlots = liveSnapshot();
    noSlots.job!.status = "appointment_no_slots_available";
    noSlots.slots = [];
    mockApi.getFranceAppointmentStatus.mockResolvedValue(noSlots);

    render(<FranceAppointmentAssistant applicationId="application-1" />);

    await waitFor(() => expect(screen.getByText("slots.noSlots")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "slots.choose" })).not.toBeInTheDocument();
    expect(screen.queryByText("final.book")).not.toBeInTheDocument();
  });

  it("shows one review stage and blocks continuation when persisted data is incomplete", async () => {
    const incomplete = liveSnapshot();
    incomplete.job = null;
    incomplete.account = null;
    incomplete.slots = [];
    incomplete.review = {
      ...incomplete.review!,
      phone: null,
      missingFields: ["phone"],
      complete: false,
    };
    mockApi.getFranceAppointmentStatus.mockResolvedValue(incomplete);

    render(<FranceAppointmentAssistant applicationId="application-1" />);

    await waitFor(() => expect(screen.getByText("review.missingFieldsTitle")).toBeInTheDocument());
    expect(screen.getByText("review.missingFieldLabels.phone")).toBeInTheDocument();
    expect(screen.queryByText("stateMachine.accountTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("slots.title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "review.confirmAndContinue" })).toBeDisabled();
  });
});
