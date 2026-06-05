import type {
  AppointmentAssistanceJob,
  AppointmentSlot,
  SlotReadResult,
} from "./types.js";
import type { USAppointmentRepository } from "./repository.js";
import { redactToObject } from "./redaction.js";

export class AppointmentSlotService {
  constructor(private readonly repository: USAppointmentRepository) {}

  async saveObservedSlots(
    job: AppointmentAssistanceJob,
    result: SlotReadResult,
  ): Promise<AppointmentSlot[]> {
    return this.repository.insertSlots(
      result.slots.map((slot) => ({
        jobId: job.id,
        applicationId: job.applicationId,
        appointmentDate: slot.appointmentDate,
        appointmentTime: slot.appointmentTime,
        appointmentLocation: slot.appointmentLocation,
        appointmentType: slot.appointmentType,
        source: slot.source ?? "dry_run",
        metadataRedactedJson: redactToObject(slot.metadataRedactedJson ?? {}),
      })),
    );
  }

  async selectSlot(job: AppointmentAssistanceJob, slotId: string): Promise<AppointmentSlot> {
    const slot = await this.repository.getSlot(slotId);
    if (!slot || slot.jobId !== job.id) {
      throw new Error("Slot not found for this appointment job.");
    }
    if (slot.status !== "observed") {
      throw new Error("This appointment slot is no longer selectable.");
    }
    const selected = await this.repository.updateSlotStatus(slotId, "user_selected");
    await this.repository.markOtherSlotsExpired(job.id, slotId);
    return selected;
  }
}
