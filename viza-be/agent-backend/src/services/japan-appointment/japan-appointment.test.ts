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
    async getLatestJob() { return jobs[0] ?? null; },
    async getJob(jobId) { return jobs.find((job) => job.id === jobId) ?? null; },
    async insertJob(input) {
      const job: JapanAppointmentJob = { id: "job-1", applicationId: input.applicationId, userId: input.userId, status: "appointment_account_required", mode: "assisted_live", requiresUserAction: false, currentManualAction: null, userPreferencesJson: input.preferences, lastErrorCode: null, lastErrorMessage: null, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
      jobs.push(job); return job;
    },
    async updateJob(jobId, patch) { const index = jobs.findIndex((job) => job.id === jobId); jobs[index] = { ...jobs[index], ...patch }; return jobs[index]; },
    async ensureAccount() { return { id: "account-1", accountEmail: "[REDACTED]", accountStatus: "alias_prepared", emailVerified: false }; },
    async getAccount() { return null; },
    async insertManualAction(input) { const action = { id: "action-1", actionType: input.actionType, status: "pending", instruction: input.instruction, metadataRedactedJson: input.metadata, createdAt: new Date(0).toISOString() }; actions.push(action); return action; },
    async getPendingManualAction() { return actions.find((action) => action.status === "pending") ?? null; },
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

  it("prepares an alias-backed assisted-live job and preserves all stop gates", async () => {
    const { repository } = repositoryFor();
    const service = new JapanAppointmentService(repository);
    await service.recordConsent({ applicationId: "application-1", userId: "user-1", snapshot: {} });
    const job = await service.createJob({ applicationId: "application-1", userId: "user-1", eligibility });
    expect(job.status).toBe("appointment_account_required");
    expect(job.userPreferencesJson).toMatchObject({ aliasPrepared: true, stopBeforeSlotSelection: true, stopBeforePayment: true, stopBeforeFinalBooking: true });
  });
});
