import assert from "node:assert/strict";
import type {
  AppointmentAccountRegistrationProof, AppointmentSlotRow, AuditEventInsert,
  ConfirmationInsert, ManualActionInsert, SlotInsert, StatusCheckInsert,
  USAppointmentRunnerRepository,
} from "../runner";
import {
  PLACEHOLDER_APPLICANT_DETAILS_RESULT, PLACEHOLDER_CREDENTIALS,
  PLACEHOLDER_JOB, PLACEHOLDER_VERIFICATION_CODE,
} from "./placeholder-data";

/** Isolated persistence adapter: no environment, database, email or live account. */
export class PlaceholderAppointmentRepository implements USAppointmentRunnerRepository {
  job = structuredClone(PLACEHOLDER_JOB);
  credentials = structuredClone(PLACEHOLDER_CREDENTIALS);
  manualActions: Array<ManualActionInsert & { completed: boolean }> = [];
  auditEvents: AuditEventInsert[] = [];
  slots: SlotInsert[] = [];
  confirmations: ConfirmationInsert[] = [];
  statusChecks: StatusCheckInsert[] = [];
  transitions: string[] = [this.job.status];
  applicationStates: string[] = [];
  selectedSlot: AppointmentSlotRow | null = null;
  private approvedSlotId: string | null = null;

  async listCandidateJobs() { return [structuredClone(this.job)]; }
  async hasPendingManualAction() { return this.manualActions.some((row) => !row.completed); }
  async getAppointmentAccountCredentials() { return { ...this.credentials }; }
  async getAppointmentApplicantDetails() { return PLACEHOLDER_APPLICANT_DETAILS_RESULT; }
  async assertAccountRegistrationInboxRoutable() {
    assert.equal(this.credentials.email, PLACEHOLDER_CREDENTIALS.email);
  }
  async waitForAccountVerificationEmail(
    _job: typeof PLACEHOLDER_JOB, _timeout: number,
    request: { since: string; accountEmail: string },
  ) {
    assert.equal(request.accountEmail, PLACEHOLDER_CREDENTIALS.email);
    assert.ok(Number.isFinite(Date.parse(request.since)));
    return { code: PLACEHOLDER_VERIFICATION_CODE, link: null };
  }
  async markAppointmentAccountVerified(_job: typeof PLACEHOLDER_JOB, proof: AppointmentAccountRegistrationProof) {
    assert.equal(proof.emailVerified, true);
    assert.equal(proof.accountCreated, true);
    assert.equal(proof.accountEmail, this.credentials.email);
    this.credentials = { ...this.credentials, accountStatus: "active", emailVerified: true };
  }
  async markAppointmentAccountRegistrationSubmitted() {
    if (!this.credentials.emailVerified) this.credentials.accountStatus = "registration_submitted";
  }
  async insertManualAction(input: ManualActionInsert) {
    this.manualActions.push({ ...input, completed: false });
  }
  async updateJobForManualAction(input: { jobId: string; status: string; currentManualAction: string }) {
    await this.updateJobStatus(input);
    this.job.requires_user_action = true;
  }
  async updateJobStatus(input: { jobId: string; status: string; currentManualAction?: string | null }) {
    assert.equal(input.jobId, this.job.id);
    this.job = { ...this.job, status: input.status, current_manual_action: input.currentManualAction ?? null };
    this.transitions.push(input.status);
  }
  async insertAuditEvent(input: AuditEventInsert) { this.auditEvents.push(input); }
  async insertSlots(input: SlotInsert[]) { this.slots.push(...input); }
  async getSelectedSlot() { return this.selectedSlot; }
  async hasCompletedFinalApproval() {
    return Boolean(this.selectedSlot && this.approvedSlotId === this.selectedSlot.id);
  }
  async insertConfirmation(input: ConfirmationInsert) {
    assert.equal(this.confirmations.length, 0, "A completed fixture booking must not be inserted twice.");
    assert.equal(input.job_id, this.job.id);
    this.confirmations.push(input);
    return { id: "fixture-confirmation" };
  }
  async insertStatusCheck(input: StatusCheckInsert) { this.statusChecks.push(input); }
  async updateApplicationAppointmentState(input: { applicationId: string; status: string }) {
    assert.equal(input.applicationId, this.job.application_id);
    this.applicationStates.push(input.status);
  }
  /** Simulates an explicit VIZA user action; never called by the live runner. */
  async resume(status: string) {
    for (const action of this.manualActions) action.completed = true;
    this.job.requires_user_action = false;
    await this.updateJobStatus({ jobId: this.job.id, status });
  }
  selectSlot(index: number) {
    const slot = this.slots[index];
    assert.ok(slot, "Only an observed fixture slot may be selected.");
    this.selectedSlot = { ...slot, id: `fixture-slot-${index}` };
    this.approvedSlotId = null;
  }
  approveSelectedSlot() {
    assert.ok(this.selectedSlot, "Select a slot before approving.");
    this.approvedSlotId = this.selectedSlot.id;
  }
}
