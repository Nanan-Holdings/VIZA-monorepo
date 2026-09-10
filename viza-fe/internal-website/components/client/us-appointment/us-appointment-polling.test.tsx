import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentStatusSnapshot, USAppointmentStatus } from "@/types/us-appointment";
import { USAppointmentAssistant } from "./us-appointment-assistant";

const api = vi.hoisted(() => ({
  getAppointmentStatus: vi.fn(),
  approveAppointmentFinalConfirmation: vi.fn(),
  bookSelectedAppointmentSlot: vi.fn(),
  cancelAppointmentJob: vi.fn(),
  checkAppointmentSlots: vi.fn(),
  checkAppointmentStatus: vi.fn(),
  completeAppointmentManualAction: vi.fn(),
  createAppointmentJob: vi.fn(),
  recordAppointmentConsent: vi.fn(),
  revealAppointmentAccount: vi.fn(),
  resumeAppointmentJob: vi.fn(),
  runAppointmentJob: vi.fn(),
  selectAppointmentSlot: vi.fn(),
}));
vi.mock("@/lib/us-appointment/client", () => ({
  ...api,
  USAppointmentApiError: class extends Error { code = "synthetic_error"; },
}));
vi.mock("@/app/actions/application-group", () => ({
  getTeamApplicationContext: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useLocale: () => "en", useTranslations: () => translate };
});

function snapshot(status: USAppointmentStatus = "appointment_account_creation_started"): AppointmentStatusSnapshot {
  return {
    job: {
      id: "synthetic-job", applicationId: "synthetic-application", userId: "synthetic-user",
      appointmentAccountId: null, countryCode: "US", visaType: "B1_B2",
      ds160ConfirmationCode: null, applyingCountryCode: "CN", applyingPostCity: "Shanghai",
      schedulingProvider: "synthetic-provider", status, mode: "dry_run", userPreferencesJson: {},
      requiresUserAction: false, currentManualAction: null, lastErrorCode: null, lastErrorMessage: null,
      idempotencyKey: "synthetic-idempotency", createdAt: null, updatedAt: null,
    },
    account: null, pendingManualAction: null, manualActions: [], slots: [],
    confirmation: null, latestStatusCheck: null, dryRunNotice: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function visibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advance(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe("U.S. appointment background polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    api.getAppointmentStatus.mockReset().mockResolvedValue(snapshot());
    visibility("visible");
  });
  afterEach(() => {
    cleanup();
    for (const [name, method] of Object.entries(api)) {
      if (name !== "getAppointmentStatus") expect(method).not.toHaveBeenCalled();
    }
    Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  });

  it("coalesces visibility resumes throughout a slow read and preserves the seven-second cadence", async () => {
    const pending = deferred<AppointmentStatusSnapshot>();
    api.getAppointmentStatus.mockResolvedValueOnce(snapshot()).mockReturnValueOnce(pending.promise);
    render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
    await advance();
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(1);
    await advance(7_000);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 3; index += 1) {
      visibility("hidden");
      visibility("visible");
      await advance();
    }
    await advance(14_000);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    pending.resolve(snapshot());
    await advance();
    await advance(6_999);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(3);
  });

  it("aborts the active read on unmount and ignores late responses and visibility events", async () => {
    const pending = deferred<AppointmentStatusSnapshot>();
    api.getAppointmentStatus.mockResolvedValueOnce(snapshot()).mockReturnValueOnce(pending.promise);
    const view = render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
    await advance();
    await advance(7_000);
    const signal = api.getAppointmentStatus.mock.calls[1][1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve(snapshot());
    await advance(60_000);
    visibility("visible");
    await advance();
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
  });

  it("pauses hidden-page polls and reads on visibility return", async () => {
    render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
    await advance();
    visibility("hidden");
    await advance(60_000);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(1);
    visibility("visible");
    await advance();
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
  });

  it("retries a failed background read after seven seconds", async () => {
    api.getAppointmentStatus.mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new Error("synthetic failure"));
    render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
    await advance();
    await advance(7_000);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    await advance(6_999);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(3);
  });

  it.each(["appointment_confirmation_captured", "appointment_failed", "appointment_cancelled"] as const)(
    "stops after receiving %s", async (status) => {
      api.getAppointmentStatus.mockResolvedValueOnce(snapshot()).mockResolvedValue(snapshot(status));
      render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
      await advance();
      await advance(7_000);
      expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
      visibility("hidden");
      visibility("visible");
      await advance(60_000);
      expect(api.getAppointmentStatus).toHaveBeenCalledTimes(2);
    },
  );

  it("does not start polling when no appointment job exists", async () => {
    api.getAppointmentStatus.mockResolvedValue({ ...snapshot(), job: null });
    render(<USAppointmentAssistant applicationId="synthetic-application" workerReady={false} />);
    await advance();
    visibility("hidden");
    visibility("visible");
    await advance(60_000);
    expect(api.getAppointmentStatus).toHaveBeenCalledTimes(1);
  });
});
