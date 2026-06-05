import type {
  AppointmentAssistanceJob,
  AppointmentStatusCheck,
  AppointmentStatusResult,
} from "./types.js";
import type { USAppointmentRepository } from "./repository.js";
import { redactToObject } from "./redaction.js";

export class AppointmentStatusService {
  constructor(private readonly repository: USAppointmentRepository) {}

  getCooldownMs(): number {
    const configured = Number(process.env.US_APPOINTMENT_STATUS_CHECK_COOLDOWN_MS ?? "600000");
    return Number.isFinite(configured) && configured >= 60_000 ? configured : 600_000;
  }

  async assertCooldown(job: AppointmentAssistanceJob): Promise<void> {
    const latest = await this.repository.getLatestStatusCheck(job.id);
    if (!latest?.checkedAt) return;
    const elapsed = Date.now() - Date.parse(latest.checkedAt);
    if (elapsed < this.getCooldownMs()) {
      throw new Error("Appointment status checks are rate limited. Please wait before checking again.");
    }
  }

  async saveStatusCheck(
    job: AppointmentAssistanceJob,
    result: AppointmentStatusResult,
  ): Promise<AppointmentStatusCheck> {
    return this.repository.insertStatusCheck({
      jobId: job.id,
      applicationId: job.applicationId,
      userId: job.userId,
      status: result.statusCheck,
      resultRedactedJson: redactToObject(result.resultRedactedJson),
    });
  }
}
