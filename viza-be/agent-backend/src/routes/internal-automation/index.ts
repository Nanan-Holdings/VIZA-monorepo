import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Logger } from "../../utils/logger.js";
import {
  getApplicationPacketHandoff,
  getApplicationStatusSummary,
  ingestExternalStatus,
} from "./internal-automation.service.js";
import {
  requireExternalSubmissionToken,
  requireInternalAutomationToken,
} from "./auth.js";
import {
  applicationIdParamsSchema,
  externalStatusPathBodySchema,
  externalStatusUpdateSchema,
  statusSummaryQuerySchema,
} from "./validation.js";

const logger = new Logger({ serviceName: "InternalAutomationRoutes" });
const internalAutomationRouter = Router();

function formatValidationError(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function sendValidationError(res: Response, error: z.ZodError): void {
  res.status(400).json({
    error: true,
    code: "validation_error",
    message: "Request validation failed",
    details: formatValidationError(error),
  });
}

function sendServiceError(
  res: Response,
  result: { status: number; code: string; message: string },
): void {
  res.status(result.status).json({
    error: true,
    code: result.code,
    message: result.message,
  });
}

async function handleStatusSummary(req: Request, res: Response): Promise<void> {
  const paramsResult = applicationIdParamsSchema.safeParse(req.params);
  if (!paramsResult.success) {
    sendValidationError(res, paramsResult.error);
    return;
  }

  const queryResult = statusSummaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    sendValidationError(res, queryResult.error);
    return;
  }

  try {
    const result = await getApplicationStatusSummary(
      paramsResult.data.applicationId,
      queryResult.data,
    );

    if (!result.ok) {
      sendServiceError(res, result);
      return;
    }

    res.json({ error: false, data: result.data });
  } catch (error) {
    logger.error("status_summary_error", error as Error, {
      applicationId: paramsResult.data.applicationId,
    });
    res.status(500).json({
      error: true,
      code: "status_summary_failed",
      message: "Failed to load application status summary",
    });
  }
}

internalAutomationRouter.get(
  "/applications/:applicationId/status-summary",
  requireInternalAutomationToken,
  handleStatusSummary,
);

internalAutomationRouter.get(
  "/applications/:applicationId/lifecycle-summary",
  requireInternalAutomationToken,
  handleStatusSummary,
);

internalAutomationRouter.get(
  "/applications/:applicationId/packet-handoff",
  requireInternalAutomationToken,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = applicationIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const result = await getApplicationPacketHandoff(paramsResult.data.applicationId);

      if (!result.ok) {
        sendServiceError(res, result);
        return;
      }

      res.json({ error: false, data: result.data });
    } catch (error) {
      logger.error("packet_handoff_error", error as Error, {
        applicationId: paramsResult.data.applicationId,
      });
      res.status(500).json({
        error: true,
        code: "packet_handoff_failed",
        message: "Failed to build packet handoff payload",
      });
    }
  },
);

internalAutomationRouter.post(
  "/external-status",
  requireExternalSubmissionToken,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = externalStatusUpdateSchema.safeParse(req.body);
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    try {
      const result = await ingestExternalStatus(bodyResult.data);

      if (!result.ok) {
        sendServiceError(res, result);
        return;
      }

      res.json({ error: false, data: result.data });
    } catch (error) {
      logger.error("external_status_ingest_error", error as Error, {
        applicationId: bodyResult.data.applicationId,
        externalStatus: bodyResult.data.externalStatus,
      });
      res.status(500).json({
        error: true,
        code: "external_status_ingest_failed",
        message: "Failed to ingest external status",
      });
    }
  },
);

internalAutomationRouter.post(
  "/applications/:applicationId/external-status",
  requireExternalSubmissionToken,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = applicationIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    const bodyResult = externalStatusPathBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    try {
      const result = await ingestExternalStatus({
        ...bodyResult.data,
        applicationId: paramsResult.data.applicationId,
      });

      if (!result.ok) {
        sendServiceError(res, result);
        return;
      }

      res.json({ error: false, data: result.data });
    } catch (error) {
      logger.error("external_status_ingest_error", error as Error, {
        applicationId: paramsResult.data.applicationId,
        externalStatus: bodyResult.data.externalStatus,
      });
      res.status(500).json({
        error: true,
        code: "external_status_ingest_failed",
        message: "Failed to ingest external status",
      });
    }
  },
);

export default internalAutomationRouter;
