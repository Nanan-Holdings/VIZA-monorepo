import type {
  AppointmentAssistanceJob,
  InsertAppointmentAuditEventInput,
  JsonObject,
} from "./types.js";
import type { USAppointmentRepository } from "./repository.js";
import { redactToObject } from "./redaction.js";

export class AppointmentAuditService {
  constructor(private readonly repository: USAppointmentRepository) {}

  async record(input: InsertAppointmentAuditEventInput): Promise<void> {
    await this.repository.addAuditEvent({
      ...input,
      metadataRedactedJson: input.metadataRedactedJson
        ? redactToObject(input.metadataRedactedJson)
        : null,
    });
  }

  async recordJobTransition(
    job: AppointmentAssistanceJob,
    eventType: string,
    eventMessage: string,
    metadata: JsonObject = {},
  ): Promise<void> {
    await this.record({
      jobId: job.id,
      applicationId: job.applicationId,
      userId: job.userId,
      eventType,
      eventMessage,
      metadataRedactedJson: metadata,
    });
  }
}
