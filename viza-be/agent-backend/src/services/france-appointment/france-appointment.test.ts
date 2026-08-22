import { describe, expect, it, vi } from "vitest";

import {
  FranceAppointmentServiceError,
  createFranceAppointmentService,
  waitForSubmissionServiceReady,
  type FranceAppointmentApplication,
  type FranceAppointmentAccount,
  type FranceAppointmentConfirmation,
  type FranceAppointmentJob,
  type FranceAppointmentManualAction,
  type FranceAppointmentRepository,
  type FranceAppointmentSlot,
} from "./FranceAppointmentService";

function createRepository(
  applicationPatch: Partial<FranceAppointmentApplication> = {},
): FranceAppointmentRepository & {
  jobs: FranceAppointmentJob[];
  slots: FranceAppointmentSlot[];
  account: FranceAppointmentAccount | null;
  actions: FranceAppointmentManualAction[];
  confirmations: FranceAppointmentConfirmation[];
} {
  const repository = {
    jobs: [] as FranceAppointmentJob[],
    slots: [] as FranceAppointmentSlot[],
    account: null as FranceAppointmentAccount | null,
    actions: [] as FranceAppointmentManualAction[],
    confirmations: [] as FranceAppointmentConfirmation[],
    async getApplication(applicationId: string) {
      return {
        id: applicationId,
        userId: "user-1",
        applicantId: "applicant-1",
        country: "france",
        countryCode: "FR",
        visaType: "EU_SCHENGEN_C_SHORT_STAY",
        officialReferenceEncrypted: "encrypted-fra-reference",
        appointmentAssistanceStatus: null,
        profile: {
          fullName: "Test Applicant",
          surname: "Applicant",
          givenNames: "Test",
          dateOfBirth: "1990-01-02",
          nationality: "China",
          passportNumber: "P1234567",
          passportExpiryDate: "2030-01-02",
          phone: "+8613800000000",
          email: "test@example.com",
          address: "Shanghai",
        },
        ...applicationPatch,
      };
    },
    async findConsent(applicationId: string, userId: string) {
      return repository.actions.find((action) =>
        action.applicationId === applicationId &&
        action.userId === userId &&
        action.actionType === "consent" &&
        action.status === "completed") ?? null;
    },
    async insertManualAction(input: Omit<FranceAppointmentManualAction, "id" | "createdAt">) {
      const action = { ...input, id: `action-${repository.actions.length + 1}`, createdAt: new Date(0).toISOString() };
      repository.actions.push(action);
      return action;
    },
    async listManualActions(jobId: string) {
      return repository.actions.filter((action) => action.jobId === jobId).reverse();
    },
    async getLatestJob(applicationId: string) {
      return [...repository.jobs].reverse().find((job) => job.applicationId === applicationId) ?? null;
    },
    async getJob(jobId: string) {
      return repository.jobs.find((job) => job.id === jobId) ?? null;
    },
    async getAccountForApplication() {
      return repository.account;
    },
    async insertJob(input: Omit<FranceAppointmentJob, "id" | "createdAt" | "updatedAt">) {
      const job = {
        ...input,
        id: `job-${repository.jobs.length + 1}`,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      repository.jobs.push(job);
      return job;
    },
    async updateJob(jobId: string, patch: Partial<FranceAppointmentJob>) {
      const index = repository.jobs.findIndex((job) => job.id === jobId);
      repository.jobs[index] = { ...repository.jobs[index], ...patch, updatedAt: new Date(1).toISOString() };
      return repository.jobs[index];
    },
    async replaceObservedSlots(jobId: string, slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt" | "expiresAt">[]) {
      const job = repository.jobs.find((item) => item.id === jobId)!;
      repository.slots = repository.slots.filter((slot) => slot.jobId !== jobId);
      const inserted = slots.map((slot, index) => ({
        ...slot,
        id: `slot-${index + 1}`,
        jobId,
        applicationId: job.applicationId,
        status: "observed",
        observedAt: new Date(0).toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }));
      repository.slots.push(...inserted);
      return inserted;
    },
    async listSlots(jobId: string) {
      return repository.slots.filter((slot) => slot.jobId === jobId);
    },
    async selectSlot(jobId: string, slotId: string) {
      repository.slots = repository.slots.map((slot) =>
        slot.jobId !== jobId
          ? slot
          : { ...slot, status: slot.id === slotId ? "user_selected" : "expired" });
      return repository.slots.find((slot) => slot.id === slotId) ?? null;
    },
    async getSelectedSlot(jobId: string) {
      return repository.slots.find((slot) => slot.jobId === jobId && slot.status === "user_selected") ?? null;
    },
    async insertConfirmation(input: Omit<FranceAppointmentConfirmation, "id" | "createdAt">) {
      const confirmation = { ...input, id: `confirmation-${repository.confirmations.length + 1}`, createdAt: new Date(0).toISOString() };
      repository.confirmations.push(confirmation);
      return confirmation;
    },
    async getConfirmation(jobId: string) {
      return repository.confirmations.find((confirmation) => confirmation.jobId === jobId) ?? null;
    },
    async updateApplicationAppointmentState() {
      return;
    },
  } satisfies FranceAppointmentRepository & {
    jobs: FranceAppointmentJob[];
    slots: FranceAppointmentSlot[];
    actions: FranceAppointmentManualAction[];
    confirmations: FranceAppointmentConfirmation[];
  };
  return repository;
}

describe("France appointment service", () => {
  it("blocks job creation until a France-Visas official reference is available", async () => {
    const service = createFranceAppointmentService(createRepository({ officialReferenceEncrypted: null }));

    await service.recordConsent({
      applicationId: "app-1",
      userId: "user-1",
      consentSnapshot: { accepted: true },
    });

    await expect(service.createJob({
      applicationId: "app-1",
      userId: "user-1",
      centerCode: "shanghai",
      mode: "dry_run",
    })).rejects.toMatchObject({
      code: "official_reference_required",
    });
  });

  it("observes slots, requires slot selection, payment authorization, and final approval before booking", async () => {
    const repository = createRepository();
    const service = createFranceAppointmentService(repository);

    await service.recordConsent({
      applicationId: "app-1",
      userId: "user-1",
      consentSnapshot: { accepted: true },
    });
    const job = await service.createJob({
      applicationId: "app-1",
      userId: "user-1",
      centerCode: "shanghai",
      mode: "dry_run",
    });

    const observed = await service.checkSlots(job.id);
    expect(observed.slots).toHaveLength(2);
    expect(observed.job.status).toBe("appointment_slot_selection_required");

    await expect(service.bookSelectedSlot(job.id)).rejects.toMatchObject({
      code: "slot_required",
    });

    await service.selectSlot(job.id, observed.slots[0].id);
    await expect(service.bookSelectedSlot(job.id)).rejects.toMatchObject({
      code: "payment_authorization_required",
    });

    await service.recordPaymentAuthorization(job.id, {
      sessionId: "session-1",
      redacted: { brand: "visa", last4: "1234", expMonth: "09", expYear: "2030" },
    });
    await expect(service.bookSelectedSlot(job.id)).rejects.toMatchObject({
      code: "final_confirmation_required",
    });

    await service.approveFinalConfirmation(job.id);
    const booked = await service.bookSelectedSlot(job.id);
    expect(booked.job.status).toBe("appointment_confirmation_captured");
    expect(booked.confirmation?.confirmationNumber).toMatch(/^FR-TLS-DRYRUN-/);
    expect(JSON.stringify(booked.job.userPreferencesJson)).not.toContain("4111");
  });

  it("rate-limits repeated slot checks", async () => {
    const service = createFranceAppointmentService(createRepository(), { slotCooldownMs: 600_000 });
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const job = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "beijing", mode: "dry_run" });

    await service.checkSlots(job.id);
    await expect(service.checkSlots(job.id)).rejects.toBeInstanceOf(FranceAppointmentServiceError);
    await expect(service.checkSlots(job.id)).rejects.toMatchObject({ code: "slot_check_rate_limited" });
  });

  it("returns a server-owned masked review without exposing the encrypted reference", async () => {
    const repository = createRepository();
    const service = createFranceAppointmentService(repository);
    const snapshot = await service.getStatusForApplication("app-1");
    expect(snapshot.review.fullName).toBe("Test Applicant");
    expect(snapshot.review.franceVisasReferenceMasked).toBe("••••••••");
    expect(JSON.stringify(snapshot.review)).not.toContain("encrypted-fra-reference");
    expect(snapshot.review.missingFields).toEqual([]);
    expect(snapshot.review.complete).toBe(true);
  });

  it("allows a fresh idempotency key after cancellation while keeping active jobs idempotent", async () => {
    const repository = createRepository();
    const service = createFranceAppointmentService(repository);
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const first = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "dry_run", idempotencyKey: "france-key-1" });
    expect(await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "beijing", mode: "dry_run", idempotencyKey: "france-key-1" })).toBe(first);
    await service.cancelJob(first.id);
    const second = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "dry_run", idempotencyKey: "france-key-2" });
    expect(second.id).not.toBe(first.id);
  });

  it("keeps assisted-live at observation only and never falls back to dry-run slots", async () => {
    const repository = createRepository();
    repository.account = {
      id: "account-1",
      applicationId: "app-1",
      accountEmail: "a•••@viza.test",
      accountStatus: "appointment_reference_filled",
      emailVerified: true,
      lastLoginAt: new Date().toISOString(),
      referenceReady: true,
      metadataRedactedJson: { referenceReady: true },
      updatedAt: new Date().toISOString(),
    };
    const service = createFranceAppointmentService(repository, {
      submissionServiceUrl: "http://submission.test",
      fetchImpl: vi.fn(async (input) => {
        const pathname = new URL(String(input)).pathname;
        if (pathname === "/ready") return new Response("{}", { status: 200 });
        return new Response(JSON.stringify({ ok: true, status: "no_slots_available", slots: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }),
      sleep: async () => undefined,
    });
    await service.recordConsent({
      applicationId: "app-1",
      userId: "user-1",
      consentSnapshot: { accepted: true },
    });
    const job = await service.createJob({
      applicationId: "app-1",
      userId: "user-1",
      centerCode: "shanghai",
      mode: "assisted_live",
    });
    const result = await service.checkSlots(job.id);
    expect(result.slots).toHaveLength(0);
    expect(result.job?.status).toBe("appointment_no_slots_available");
    await expect(service.selectSlot(job.id, "slot-live-1")).rejects.toMatchObject({ code: "assisted_live_selection_disabled" });
    await expect(service.recordPaymentAuthorization(job.id, { sessionId: "session", redacted: { last4: "1234" } })).rejects.toMatchObject({ code: "assisted_live_payment_disabled" });
    await expect(service.bookSelectedSlot(job.id)).rejects.toMatchObject({ code: "assisted_live_booking_disabled" });
  });

  it("treats an empty slots_observed payload as selector drift, not official no-slots evidence", async () => {
    const repository = createRepository();
    repository.account = {
      id: "account-1",
      applicationId: "app-1",
      accountEmail: "a•••@viza.test",
      accountStatus: "appointment_reference_filled",
      emailVerified: true,
      lastLoginAt: new Date().toISOString(),
      referenceReady: true,
      metadataRedactedJson: { referenceReady: true },
      updatedAt: new Date().toISOString(),
    };
    const service = createFranceAppointmentService(repository, {
      submissionServiceUrl: "http://submission.test",
      fetchImpl: vi.fn(async (input) => {
        const pathname = new URL(String(input)).pathname;
        if (pathname === "/ready") return new Response("{}", { status: 200 });
        return new Response(JSON.stringify({ ok: true, status: "slots_observed", slots: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      sleep: async () => undefined,
    });
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const job = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "assisted_live" });

    const result = await service.checkSlots(job.id);

    expect(result.job?.status).toBe("appointment_manual_required");
    expect(result.pendingManualAction?.actionType).toBe("selector_drift");
    expect(result.slots).toEqual([]);
  });

  it("does not wake the worker when assisted-live account readiness is incomplete", async () => {
    const repository = createRepository();
    const fetchMock = vi.fn();
    const service = createFranceAppointmentService(repository, {
      submissionServiceUrl: "http://submission.test",
      fetchImpl: fetchMock,
      sleep: async () => undefined,
    });
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const job = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "assisted_live" });
    await expect(service.checkSlots(job.id)).rejects.toMatchObject({ code: "account_not_ready" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persists the latest redacted account-preparation failure instead of surfacing a stale checkpoint", async () => {
    const repository = createRepository();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname === "/ready") return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({
        error: "TLS login did not leave the authentication form after one safe refresh at https://visas-fr.tlscontact.com/en-us/login?session=secret user@example.com",
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    });
    const service = createFranceAppointmentService(repository, {
      submissionServiceUrl: "http://submission.test",
      accountPreparationEnabled: true,
      fetchImpl: fetchMock,
      sleep: async () => undefined,
    });
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const job = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "assisted_live" });
    await repository.insertManualAction({
      applicationId: "app-1",
      userId: "user-1",
      jobId: job.id,
      actionType: "account_preparation_failed",
      status: "pending",
      instruction: "Old account failure",
      metadataRedactedJson: {},
    });
    await repository.insertManualAction({
      applicationId: "app-1",
      userId: "user-1",
      jobId: job.id,
      actionType: "selector_drift",
      status: "pending",
      instruction: "Old selector drift",
      metadataRedactedJson: {},
    });
    await repository.insertManualAction({
      applicationId: "app-1",
      userId: "user-1",
      jobId: job.id,
      actionType: "account_preparation_failed",
      status: "pending",
      instruction: "Different old account failure",
      metadataRedactedJson: {},
    });

    const result = await service.run(job.id);

    expect(result.pendingManualAction?.actionType).toBe("account_preparation_failed");
    expect(result.pendingManualAction?.instruction).toContain("https://visas-fr.tlscontact.com/en-us/login");
    expect(result.pendingManualAction?.instruction).not.toContain("session=secret");
    expect(result.pendingManualAction?.instruction).not.toContain("user@example.com");
    expect(result.pendingManualAction?.metadataRedactedJson).toMatchObject({
      httpStatus: 400,
      workerErrorPresent: true,
      retryable: true,
    });
  });

  it("rejects expired slots before selection", async () => {
    const repository = createRepository();
    const service = createFranceAppointmentService(repository, { now: () => Date.parse("2026-08-19T00:00:00Z") });
    await service.recordConsent({ applicationId: "app-1", userId: "user-1", consentSnapshot: { accepted: true } });
    const job = await service.createJob({ applicationId: "app-1", userId: "user-1", centerCode: "shanghai", mode: "dry_run" });
    repository.slots.push({
      id: "expired-slot",
      jobId: job.id,
      applicationId: job.applicationId,
      appointmentDate: "2026-09-15",
      appointmentTime: "09:00",
      appointmentLocation: "TLScontact Shanghai",
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      status: "observed",
      observedAt: "2026-08-18T23:00:00Z",
      expiresAt: "2026-08-18T23:10:00Z",
      metadataRedactedJson: {},
    });
    await repository.updateJob(job.id, { status: "appointment_slot_selection_required" });
    await expect(service.selectSlot(job.id, "expired-slot")).rejects.toMatchObject({ code: "slot_expired" });
  });

  it("polls readiness at the bounded two-second contract", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const result = await waitForSubmissionServiceReady("http://submission.test", {
      fetchImpl: fetchMock,
      now: () => now,
      sleep: async (milliseconds) => { sleeps.push(milliseconds); now += milliseconds; },
    });
    expect(result.ready).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2_000]);
  });
});
