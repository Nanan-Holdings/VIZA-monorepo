import { describe, expect, it } from "vitest";
import {
  JapanAppointmentService,
  JapanAppointmentServiceError,
  type JapanAppointmentApplication,
  type JapanAppointmentJob,
  type JapanAppointmentManualAction,
  type JapanAppointmentRepository,
} from "./JapanAppointmentService";

function repositoryFor(applicationPatch: Partial<JapanAppointmentApplication> = {}) {
  const jobs: JapanAppointmentJob[] = [];
  const actions: JapanAppointmentManualAction[] = [];
  const slots: Array<import("./JapanAppointmentService").JapanAppointmentSlot> = [];
  const application: JapanAppointmentApplication = {
    id: "application-1", userId: "user-1", applicantId: "applicant-1", country: "japan",
    visaType: "TEMPORARY_VISITOR", inboxAlias: null,
    answers: { surname: "Chen", given_names: "Hongyu", date_of_birth: "2000-01-01", nationality: "China", passport_number: "P123", passport_expiry_date: "2030-01-01", email: "test@example.com", phone: "+6512345678" },
    profile: {}, documentTypes: ["passport_scan", "applicant_photo"], ...applicationPatch,
  };
  const repository: JapanAppointmentRepository = {
    async getApplication() { return application; },
    async ensureAlias() { return "appl-test@example.com"; },
    async findConsent() { return actions.find((action) => action.actionType === "japan_vfs_sg_consent") ?? null; },
    async insertConsent(applicationId, _userId, snapshot) {
      const action = { id: "consent-1", actionType: "japan_vfs_sg_consent", status: "completed", instruction: null, metadataRedactedJson: snapshot, createdAt: new Date(0).toISOString() };
      actions.push(action); return action;
    },
    async getLatestJob() { return jobs.at(-1) ?? null; },
    async getJob(jobId) { return jobs.find((job) => job.id === jobId) ?? null; },
    async insertJob(input) {
      const job: JapanAppointmentJob = { id: `job-${jobs.length + 1}`, applicationId: input.applicationId, userId: input.userId, status: "appointment_account_required", mode: "assisted_live", requiresUserAction: false, currentManualAction: null, userPreferencesJson: input.preferences, lastErrorCode: null, lastErrorMessage: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
      jobs.push(job); return job;
    },
    async updateJob(jobId, patch) { const index = jobs.findIndex((job) => job.id === jobId); jobs[index] = { ...jobs[index], ...patch }; return jobs[index]; },
    async ensureAccount() { return { id: "account-1", accountEmail: "[REDACTED]", accountStatus: "alias_prepared", emailVerified: false }; },
    async getAccount() { return null; },
    async insertManualAction(input) { const action = { id: "action-1", actionType: input.actionType, status: "pending", instruction: input.instruction, metadataRedactedJson: input.metadata, createdAt: new Date(0).toISOString() }; actions.push(action); return action; },
    async getPendingManualAction() { return actions.find((action) => action.status === "pending") ?? null; },
    async replaceObservedSlots() { return slots; },
    async listSlots() { return slots; },
    async selectSlot(_jobId, slotId) { return slots.find((slot) => slot.id === slotId) ?? null; },
    async getSelectedSlot() { return slots.find((slot) => slot.status === "user_selected") ?? null; },
    async insertConfirmation(input) { return { ...input, id: "confirmation-1", createdAt: new Date(0).toISOString() }; },
    async getConfirmation() { return null; },
    async updateApplicationState() { return undefined; },
  };
  return { repository, actions, jobs };
}

const eligibility = { singaporePassType: "employment_pass", singaporePassExpiryDate: "2027-01-01", intendedReturnDate: "2026-12-01", passportType: "ordinary", visaRequestType: "single_entry", occupation: "employed", checklistConfirmed: ["passport"] };

describe("JapanAppointmentService", () => {
  it("requires stored passport and photo uploads instead of trusting UI checkboxes", async () => {
    const { repository } = repositoryFor({ documentTypes: [] });
    const service = new JapanAppointmentService(repository);
    await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
    await expect(service.createJob({ applicationId: "application-1", userId: "user-1", eligibility }))
      .rejects.toMatchObject<Partial<JapanAppointmentServiceError>>({ code: "missing_required_fields" });
  });

  it("creates a public-recon job without preparing an alias or account", async () => {
    const { repository } = repositoryFor();
    let aliasCalls = 0;
    let accountCalls = 0;
    repository.ensureAlias = async () => { aliasCalls += 1; return "unused@example.com"; };
    repository.ensureAccount = async () => { accountCalls += 1; return { id: "unused", accountEmail: null, accountStatus: "unused", emailVerified: false }; };
    const service = new JapanAppointmentService(repository);
    await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
    const job = await service.createJob({ applicationId: "application-1", userId: "user-1", eligibility });
    expect(job.status).toBe("appointment_account_required");
    expect(job.userPreferencesJson).toMatchObject({
      automationMode: "public_recon",
      accountCreationEnabled: false,
      aliasPrepared: false,
      eligibility,
      stopBeforeSlotSelection: true,
      stopBeforePayment: true,
      stopBeforeFinalBooking: true,
    });
    expect(aliasCalls).toBe(0);
    expect(accountCalls).toBe(0);
  });

  it("returns backend-owned preflight and consent state", async () => {
    const { repository } = repositoryFor({ documentTypes: ["passport_scan"] });
    const service = new JapanAppointmentService(repository);
    let snapshot = await service.getStatusForApplication("application-1");
    expect(snapshot.preflight).toMatchObject({
      consentRecorded: false,
      passportUploaded: true,
      photoUploaded: false,
      missingApplicationFields: [],
    });
    await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
    snapshot = await service.getStatusForApplication("application-1");
    expect(snapshot.preflight.consentRecorded).toBe(true);
  });

  it("checks only the public VFS route and stops at the login boundary", async () => {
    const { repository } = repositoryFor();
    const requests: Array<Record<string, unknown>> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({
        ok: true,
        slots: [],
        checkpoint: { type: "login", message: "Public login boundary reached." },
        evidence: { pageTitle: "Sign in", finalUrl: "https://example.test/login", httpStatus: 200 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    try {
      const service = new JapanAppointmentService(repository);
      await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
      const job = await service.createJob({ applicationId: "application-1", userId: "user-1", eligibility });
      const snapshot = await service.checkPortal(job.id);
      expect(requests).toEqual([{ jobId: job.id, publicOnly: true, prepareAlias: false }]);
      expect(snapshot.job?.status).toBe("appointment_manual_required");
      expect(snapshot.job?.userPreferencesJson).toMatchObject({
        automationMode: "public_recon",
        accountCreationEnabled: false,
        aliasPrepared: false,
      });
      expect(snapshot.pendingManualAction?.actionType).toBe("login");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("allows a fresh preparation after a cancelled job", async () => {
    const { repository, jobs } = repositoryFor();
    const service = new JapanAppointmentService(repository);
    await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
    const first = await service.createJob({ applicationId: "application-1", userId: "user-1", eligibility });
    await service.cancel(first.id);
    const second = await service.createJob({ applicationId: "application-1", userId: "user-1", eligibility });
    expect(jobs).toHaveLength(2);
    expect(second.status).toBe("appointment_account_required");
  });
});
