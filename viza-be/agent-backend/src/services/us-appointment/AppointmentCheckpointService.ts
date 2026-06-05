import type {
  AppointmentAssistanceJob,
  AppointmentManualAction,
  AppointmentManualActionType,
  JsonObject,
  USAppointmentStatus,
} from "./types.js";
import type { USAppointmentRepository } from "./repository.js";
import { redactToObject } from "./redaction.js";

export class AppointmentCheckpointService {
  constructor(private readonly repository: USAppointmentRepository) {}

  async createPendingCheckpoint(input: {
    job: AppointmentAssistanceJob;
    actionType: AppointmentManualActionType;
    jobStatus: USAppointmentStatus;
    instruction: string;
    userInputSchemaJson?: JsonObject | null;
    metadata?: JsonObject;
  }): Promise<{ job: AppointmentAssistanceJob; manualAction: AppointmentManualAction }> {
    const manualAction = await this.repository.insertManualAction({
      jobId: input.job.id,
      applicationId: input.job.applicationId,
      userId: input.job.userId,
      actionType: input.actionType,
      instruction: input.instruction,
      userInputSchemaJson: input.userInputSchemaJson ?? null,
      metadataRedactedJson: redactToObject(input.metadata ?? {}),
    });
    const job = await this.repository.updateJob(input.job.id, {
      status: input.jobStatus,
      requiresUserAction: true,
      currentManualAction: input.actionType,
    });
    return { job, manualAction };
  }

  async completeManualAction(
    actionId: string,
    userInput: JsonObject,
  ): Promise<AppointmentManualAction> {
    const action = await this.repository.getManualAction(actionId);
    if (!action) {
      throw new Error("Manual action not found.");
    }
    if (action.status !== "pending") {
      return action;
    }
    return this.repository.updateManualAction(actionId, {
      status: "completed",
      userInputRedactedJson: redactToObject(userInput),
      completedAt: new Date().toISOString(),
      metadataRedactedJson: redactToObject({
        ...(action.metadataRedactedJson ?? {}),
        completed_by_user: true,
      }),
    });
  }
}
