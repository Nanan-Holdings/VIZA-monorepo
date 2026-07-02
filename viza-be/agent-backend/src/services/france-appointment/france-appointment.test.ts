import { describe, expect, it } from "vitest";

import {
  FranceAppointmentServiceError,
  createFranceAppointmentService,
  type FranceAppointmentApplication,
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
  actions: FranceAppointmentManualAction[];
  confirmations: FranceAppointmentConfirmation[];
} {
  const repository = {
    jobs: [] as FranceAppointmentJob[],
    slots: [] as FranceAppointmentSlot[],
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
    async getLatestJob(applicationId: string) {
      return repository.jobs.find((job) => job.applicationId === applicationId) ?? null;
    },
    async getJob(jobId: string) {
      return repository.jobs.find((job) => job.id === jobId) ?? null;
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
    async replaceObservedSlots(jobId: string, slots: Omit<FranceAppointmentSlot, "id" | "jobId" | "applicationId" | "status" | "observedAt">[]) {
      const job = repository.jobs.find((item) => item.id === jobId)!;
      repository.slots = repository.slots.filter((slot) => slot.jobId !== jobId);
      const inserted = slots.map((slot, index) => ({
        ...slot,
        id: `slot-${index + 1}`,
        jobId,
        applicationId: job.applicationId,
        status: "observed",
        observedAt: new Date(0).toISOString(),
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
});
