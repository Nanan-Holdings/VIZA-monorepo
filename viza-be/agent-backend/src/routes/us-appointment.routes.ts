import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseClient } from "../db/supabase-client.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";
import { Logger } from "../utils/logger.js";
import {
  createUSAppointmentServices,
  redactToObject,
  SupabaseUSAppointmentRepository,
  USAppointmentServiceError,
  usAppointmentModes,
  type JsonObject,
  type USAppointmentMode,
} from "../services/us-appointment/index.js";

const logger = new Logger({ serviceName: "USAppointmentRoutes" });
const repository = new SupabaseUSAppointmentRepository();
const services = createUSAppointmentServices(repository);

export const usAppointmentApplicationRouter = Router();
export const usAppointmentOperationsRouter = Router();

type Requester =
  | { kind: "user"; userId: string; role: string | null }
  | { kind: "service"; userId: null; role: "service" };

interface USAppointmentLocals {
  requester: Requester;
  applicationId?: string;
  jobId?: string;
  actionId?: string;
}

const applicationIdParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

const jobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const actionIdParamsSchema = z.object({
  actionId: z.string().uuid(),
});

const slotParamsSchema = z.object({
  jobId: z.string().uuid(),
  slotId: z.string().uuid(),
});

const consentBodySchema = z
  .object({
    accepted: z.literal(true),
    consentSnapshot: z.record(z.unknown()).optional().default({}),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
  })
  .strict();

const jobBodySchema = z
  .object({
    mode: z.enum(usAppointmentModes).optional().default("dry_run"),
    ds160ConfirmationCode: z.string().trim().min(4).max(80).optional(),
    applyingCountryCode: z.string().trim().min(2).max(3),
    applyingPostCity: z.string().trim().min(1).max(120).optional(),
    schedulingProvider: z.string().trim().min(1).max(120).optional(),
    userPreferencesJson: z.record(z.unknown()).optional().default({}),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
  })
  .strict();

const manualActionCompleteBodySchema = z
  .object({
    userInput: z.record(z.unknown()).optional().default({}),
  })
  .strict();

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function configuredServiceTokens(): string[] {
  return [
    process.env.US_APPOINTMENT_INTERNAL_TOKEN,
    process.env.AGENT_BACKEND_INTERNAL_TOKEN,
    process.env.INTERNAL_AUTOMATION_TOKEN,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function tokensMatch(providedToken: string, configuredToken: string): boolean {
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  if (provided.length !== configured.length) return false;
  return timingSafeEqual(provided, configured);
}

function isServiceToken(token: string): boolean {
  return configuredServiceTokens().some((configuredToken) =>
    tokensMatch(token, configuredToken),
  );
}

async function resolveRequester(req: Request): Promise<Requester | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  if (isServiceToken(token)) return { kind: "service", userId: null, role: "service" };

  const authConfig = readSupabaseUserAuthConfig();
  if (!authConfig) {
    throw new USAppointmentServiceError(
      500,
      "supabase_auth_not_configured",
      "Supabase auth is not configured.",
    );
  }

  const userClient = createClient(authConfig.supabaseUrl, authConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: roleRow, error: roleError } = await getSupabaseClient()
    .from("users")
    .select("id, role, deleted_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (roleError) throw new Error(roleError.message);
  const roleRecord = roleRow as { role?: unknown; deleted_at?: unknown } | null;
  const role =
    typeof roleRecord?.role === "string" && roleRecord.deleted_at === null
      ? roleRecord.role
      : null;

  return { kind: "user", userId: userData.user.id, role };
}

function setRequester(res: Response, requester: Requester): void {
  const existing = res.locals.usAppointment as USAppointmentLocals | undefined;
  if (existing) {
    existing.requester = requester;
    return;
  }
  res.locals.usAppointment = { requester } satisfies USAppointmentLocals;
}

function getLocals(res: Response): USAppointmentLocals {
  return res.locals.usAppointment as USAppointmentLocals;
}

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
    message: "Request validation failed.",
    details: formatValidationError(error),
  });
}

function sendUSAppointmentError(res: Response, error: unknown, fallbackCode: string): void {
  if (error instanceof USAppointmentServiceError) {
    res.status(error.status).json({
      error: true,
      code: error.code,
      message: error.message,
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes("appointment_") &&
    (normalizedMessage.includes("schema cache") ||
      normalizedMessage.includes("could not find the table") ||
      normalizedMessage.includes("could not find the column"))
  ) {
    res.status(503).json({
      error: true,
      code: "appointment_schema_not_configured",
      message: "U.S. appointment database schema is not configured.",
    });
    return;
  }

  logger.error(fallbackCode, error instanceof Error ? error : new Error(String(error)));
  res.status(500).json({
    error: true,
    code: fallbackCode,
    message: "U.S. appointment request failed.",
  });
}

function isAdminOrService(requester: Requester): boolean {
  return requester.kind === "service" || requester.role === "admin";
}

async function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const requester = await resolveRequester(req);
    if (!requester) {
      res.status(401).json({
        error: true,
        code: "unauthorized",
        message: "Bearer token required.",
      });
      return;
    }
    setRequester(res, requester);
    next();
  } catch (error) {
    sendUSAppointmentError(res, error, "us_appointment_auth_failed");
  }
}

async function requireApplicationAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuthenticated(req, res, async () => {
    const paramsResult = applicationIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    const locals = getLocals(res);
    const requester = locals.requester;
    if (isAdminOrService(requester)) {
      locals.applicationId = paramsResult.data.applicationId;
      next();
      return;
    }

    try {
      const application = await repository.getApplicationContext(paramsResult.data.applicationId);
      if (!application) {
        res.status(404).json({
          error: true,
          code: "application_not_found",
          message: "Application not found.",
        });
        return;
      }
      if (application.userId !== requester.userId) {
        res.status(403).json({
          error: true,
          code: "forbidden",
          message: "You cannot access this application.",
        });
        return;
      }
      locals.applicationId = application.id;
      next();
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_application_auth_failed");
    }
  });
}

async function requireOwnerUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireApplicationAccess(req, res, async () => {
    const locals = getLocals(res);
    if (locals.requester.kind !== "user") {
      res.status(403).json({
        error: true,
        code: "owner_user_required",
        message: "A user session is required for this action.",
      });
      return;
    }
    next();
  });
}

async function requireJobAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuthenticated(req, res, async () => {
    const paramsResult = jobIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const job = await repository.getJob(paramsResult.data.jobId);
      if (!job) {
        res.status(404).json({
          error: true,
          code: "appointment_job_not_found",
          message: "Appointment job not found.",
        });
        return;
      }

      const locals = getLocals(res);
      const requester = locals.requester;
      if (!isAdminOrService(requester) && requester.userId !== job.userId) {
        res.status(403).json({
          error: true,
          code: "forbidden",
          message: "You cannot access this appointment job.",
        });
        return;
      }
      locals.jobId = job.id;
      next();
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_job_auth_failed");
    }
  });
}

async function requireManualActionAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuthenticated(req, res, async () => {
    const paramsResult = actionIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const action = await repository.getManualAction(paramsResult.data.actionId);
      if (!action) {
        res.status(404).json({
          error: true,
          code: "manual_action_not_found",
          message: "Manual action not found.",
        });
        return;
      }

      const locals = getLocals(res);
      const requester = locals.requester;
      if (!isAdminOrService(requester) && requester.userId !== action.userId) {
        res.status(403).json({
          error: true,
          code: "forbidden",
          message: "You cannot access this manual action.",
        });
        return;
      }
      locals.actionId = action.id;
      next();
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_manual_action_auth_failed");
    }
  });
}

usAppointmentApplicationRouter.post(
  "/:applicationId/us-appointment/consent",
  requireOwnerUser,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = consentBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const locals = getLocals(res);
    if (!locals.applicationId || locals.requester.kind !== "user") {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const consent = await services.orchestrator.recordConsent({
        applicationId: locals.applicationId,
        actorUserId: locals.requester.userId,
        consentSnapshot: redactToObject(bodyResult.data.consentSnapshot),
        idempotencyKey: bodyResult.data.idempotencyKey,
      });
      res.json({ error: false, data: { consentRecorded: true, consent } });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_consent_failed");
    }
  },
);

usAppointmentApplicationRouter.post(
  "/:applicationId/us-appointment/job",
  requireOwnerUser,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = jobBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const locals = getLocals(res);
    if (!locals.applicationId || locals.requester.kind !== "user") {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const job = await services.orchestrator.createJob({
        applicationId: locals.applicationId,
        userId: locals.requester.userId,
        mode: bodyResult.data.mode as USAppointmentMode,
        ds160ConfirmationCode: bodyResult.data.ds160ConfirmationCode,
        applyingCountryCode: bodyResult.data.applyingCountryCode,
        applyingPostCity: bodyResult.data.applyingPostCity,
        schedulingProvider: bodyResult.data.schedulingProvider,
        userPreferencesJson: redactToObject(bodyResult.data.userPreferencesJson) as JsonObject,
        idempotencyKey: bodyResult.data.idempotencyKey,
      });
      res.json({ error: false, data: job });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_job_create_failed");
    }
  },
);

usAppointmentApplicationRouter.get(
  "/:applicationId/us-appointment/status",
  requireApplicationAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const applicationId = getLocals(res).applicationId;
    if (!applicationId) {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const status = await services.orchestrator.getStatus(applicationId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_status_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/run",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.runJob(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_run_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/resume",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.resumeJob(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_resume_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/manual-actions/:actionId/complete",
  requireManualActionAccess,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = manualActionCompleteBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const actionId = getLocals(res).actionId;
    if (!actionId) {
      res.status(400).json({ error: true, code: "action_id_missing" });
      return;
    }

    try {
      const status = await services.orchestrator.completeManualAction(
        actionId,
        redactToObject(bodyResult.data.userInput),
      );
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_manual_action_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/slots/:slotId/select",
  requireJobAccess,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = slotParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const status = await services.orchestrator.selectSlot(
        paramsResult.data.jobId,
        paramsResult.data.slotId,
      );
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_slot_select_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/approve-final-confirmation",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.approveFinalConfirmation(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_final_approval_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/book-selected-slot",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.bookSelectedSlot(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_book_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/check-slots",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.checkSlots(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_check_slots_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/check-status",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.checkAppointmentStatus(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_check_status_failed");
    }
  },
);

usAppointmentOperationsRouter.post(
  "/jobs/:jobId/cancel",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const status = await services.orchestrator.cancelJob(jobId);
      res.json({ error: false, data: status });
    } catch (error) {
      sendUSAppointmentError(res, error, "us_appointment_cancel_failed");
    }
  },
);
