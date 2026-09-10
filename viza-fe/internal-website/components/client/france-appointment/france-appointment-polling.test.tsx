import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FranceAppointmentAssistant } from "./france-appointment-assistant";
import type {
  FranceAppointmentStatus,
  FranceAppointmentStatusSnapshot,
} from "@/types/france-appointment";

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
const mockTranslate = vi.hoisted(() => (key: string) => key);

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => mockTranslate,
}));

vi.mock("@/lib/france-appointment/client", () => ({
  ...mockApi,
  FranceAppointmentApiError: class FranceAppointmentApiError extends Error {
    code = "test_error";
  },
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function snapshot(status: FranceAppointmentStatus = "appointment_account_required"):
  FranceAppointmentStatusSnapshot {
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
      userPreferencesJson: { centerCode: "shanghai" },
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
  };
}

function statusRequestCount() {
  return mockApi.getFranceAppointmentStatus.mock.calls.length;
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function dispatchVisibility(value: "visible" | "hidden") {
  setVisibility(value);
  document.dispatchEvent(new Event("visibilitychange"));
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceAndFlush(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function expectNoMutationCalls() {
  expect(mockApi.recordFranceAppointmentConsent).not.toHaveBeenCalled();
  expect(mockApi.createFranceAppointmentJob).not.toHaveBeenCalled();
  expect(mockApi.runFranceAppointmentJob).not.toHaveBeenCalled();
  expect(mockApi.checkFranceAppointmentSlots).not.toHaveBeenCalled();
  expect(mockApi.selectFranceAppointmentSlot).not.toHaveBeenCalled();
  expect(mockApi.recordFrancePaymentSession).not.toHaveBeenCalled();
  expect(mockApi.approveFranceAppointmentFinalConfirmation).not.toHaveBeenCalled();
  expect(mockApi.bookSelectedFranceAppointmentSlot).not.toHaveBeenCalled();
  expect(mockApi.cancelFranceAppointmentJob).not.toHaveBeenCalled();
}

describe("FranceAppointmentAssistant status polling", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.resetAllMocks();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("coalesces visibility resume while the status response is pending", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const pendingPoll = deferred<FranceAppointmentStatusSnapshot>();
    mockApi.getFranceAppointmentStatus
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(() => pendingPoll.promise)
      .mockResolvedValue(snapshot());

    render(<FranceAppointmentAssistant applicationId="application-1" />);
    await flushEffects();
    expect(statusRequestCount()).toBe(1);

    await advanceAndFlush(6_999);
    expect(statusRequestCount()).toBe(1);
    await advanceAndFlush(1);
    expect(statusRequestCount()).toBe(2);
    const requestSignal = mockApi.getFranceAppointmentStatus.mock.calls[1]?.[1];
    expect(requestSignal).toBeInstanceOf(AbortSignal);

    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    await advanceAndFlush(0);
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    await advanceAndFlush(0);
    expect(statusRequestCount()).toBe(2);

    pendingPoll.resolve(snapshot());
    await flushEffects();
    await advanceAndFlush(6_999);
    expect(statusRequestCount()).toBe(2);
    await advanceAndFlush(1);
    expect(statusRequestCount()).toBe(3);
    expectNoMutationCalls();
  });

  it("keeps polling paused while hidden and resumes immediately when visible", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    mockApi.getFranceAppointmentStatus.mockResolvedValue(snapshot());

    render(<FranceAppointmentAssistant applicationId="application-1" />);
    await flushEffects();
    expect(statusRequestCount()).toBe(1);

    dispatchVisibility("hidden");
    await advanceAndFlush(7_000 + 30_000);
    expect(statusRequestCount()).toBe(1);

    dispatchVisibility("visible");
    await advanceAndFlush(0);
    expect(statusRequestCount()).toBe(2);
    expectNoMutationCalls();
  });

  it("retries a failed status poll on the normal seven-second cadence", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    mockApi.getFranceAppointmentStatus
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new Error("temporary status failure"))
      .mockResolvedValue(snapshot());

    render(<FranceAppointmentAssistant applicationId="application-1" />);
    await flushEffects();
    await advanceAndFlush(7_000);
    expect(statusRequestCount()).toBe(2);
    await advanceAndFlush(6_999);
    expect(statusRequestCount()).toBe(2);
    await advanceAndFlush(1);
    expect(statusRequestCount()).toBe(3);
    expectNoMutationCalls();
  });

  it("aborts an in-flight poll on cleanup and ignores its late completion", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const pendingPoll = deferred<FranceAppointmentStatusSnapshot>();
    mockApi.getFranceAppointmentStatus
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(() => pendingPoll.promise);

    const view = render(<FranceAppointmentAssistant applicationId="application-1" />);
    await flushEffects();
    await advanceAndFlush(7_000);
    expect(statusRequestCount()).toBe(2);
    const requestSignal = mockApi.getFranceAppointmentStatus.mock.calls[1]?.[1] as AbortSignal | undefined;
    expect(requestSignal?.aborted).toBe(false);

    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    pendingPoll.resolve(snapshot());
    await flushEffects();
    dispatchVisibility("visible");
    await advanceAndFlush(60_000);
    expect(statusRequestCount()).toBe(2);
    expectNoMutationCalls();
  });

  it("stops polling after a terminal status snapshot", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    mockApi.getFranceAppointmentStatus
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot("appointment_failed"));

    render(<FranceAppointmentAssistant applicationId="application-1" />);
    await flushEffects();
    await advanceAndFlush(7_000);
    expect(statusRequestCount()).toBe(2);
    await flushEffects();

    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    await advanceAndFlush(60_000);
    expect(statusRequestCount()).toBe(2);
    expectNoMutationCalls();
  });
});
