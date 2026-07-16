import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseClient } from "../db/supabase-client.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";
import { Logger } from "../utils/logger.js";
import {
  FranceAppointmentServiceError,
  SupabaseFranceAppointmentRepository,
  createFranceAppointmentService,
  type JsonObject,
} from "../services/france-appointment/index.js";

const logger = new Logger({ serviceName: "FranceAppointmentRoutes" });
const repository = new SupabaseFranceAppointmentRepository();
const service = createFranceAppointmentService(repository);

export const franceAppointmentApplicationRouter = Router();
export const franceAppointmentOperationsRouter = Router();

type Requester =
  | { kind: "user"; userId: string; role: string | null }
  | { kind: "service"; userId: null; role: "service" };

interface FranceAppointmentLocals {
  requester: Requester;
  applicationId?: string;
  jobId?: string;
}

const applicationIdParamsSchema = z.object({ applicationId: z.string().uuid() });
const jobIdParamsSchema = z.object({ jobId: z.string().uuid() });
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
    mode: z.enum(["dry_run", "assisted_live", "manual"]).optional().default("assisted_live"),
    centerCode: z.string().trim().min(2).max(80).default("shanghai"),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
    userPreferencesJson: z.record(z.unknown()).optional().default({}),
  })
  .strict();

const paymentSessionBodySchema = z
  .object({
    sessionId: z.string().trim().min(8).max(160),
    redacted: z
      .object({
        brand: z.string().trim().min(1).max(40).optional(),
        last4: z.string().trim().regex(/^\d{4}$/u),
        expMonth: z.string().trim().regex(/^\d{2}$/u),
        expYear: z.string().trim().regex(/^\d{4}$/u),
        holderNamePresent: z.boolean().optional(),
      })
      .passthrough(),
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
    process.env.FRANCE_APPOINTMENT_INTERNAL_TOKEN,
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
  return configuredServiceTokens().some((configuredToken) => tokensMatch(token, configuredToken));
}

async function resolveRequester(req: Request): Promise<Requester | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  if (isServiceToken(token)) return { kind: "service", userId: null, role: "service" };

  const authConfig = readSupabaseUserAuthConfig();
  if (!authConfig) {
    throw new FranceAppointmentServiceError(
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
  res.locals.franceAppointment = { requester } satisfies FranceAppointmentLocals;
}

function getLocals(res: Response): FranceAppointmentLocals {
  return res.locals.franceAppointment as FranceAppointmentLocals;
}

function isAdminOrService(requester: Requester): boolean {
  return requester.kind === "service" || requester.role === "admin";
}

function formatValidationError(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

function sendValidationError(res: Response, error: z.ZodError): void {
  res.status(400).json({
    error: true,
    code: "validation_error",
    message: "Request validation failed.",
    details: formatValidationError(error),
  });
}

function sendFranceAppointmentError(res: Response, error: unknown, fallbackCode: string): void {
  if (error instanceof FranceAppointmentServiceError) {
    res.status(error.status).json({
      error: true,
      code: error.code,
      message: error.message,
    });
    return;
  }
  logger.error(fallbackCode, error instanceof Error ? error : new Error(String(error)));
  res.status(500).json({
    error: true,
    code: fallbackCode,
    message: "France appointment request failed.",
  });
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
    sendFranceAppointmentError(res, error, "france_appointment_auth_failed");
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
      const application = await repository.getApplication(paramsResult.data.applicationId);
      if (!application) {
        res.status(404).json({ error: true, code: "application_not_found", message: "Application not found." });
        return;
      }
      if (application.userId !== requester.userId) {
        res.status(403).json({ error: true, code: "forbidden", message: "You cannot access this application." });
        return;
      }
      locals.applicationId = application.id;
      next();
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_application_auth_failed");
    }
  });
}

async function requireOwnerUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireApplicationAccess(req, res, async () => {
    if (getLocals(res).requester.kind !== "user") {
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
        res.status(404).json({ error: true, code: "appointment_job_not_found", message: "Appointment job not found." });
        return;
      }
      const locals = getLocals(res);
      if (!isAdminOrService(locals.requester) && locals.requester.userId !== job.userId) {
        res.status(403).json({ error: true, code: "forbidden", message: "You cannot access this appointment job." });
        return;
      }
      locals.jobId = job.id;
      next();
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_job_auth_failed");
    }
  });
}

franceAppointmentApplicationRouter.post(
  "/:applicationId/france-appointment/consent",
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
      const consent = await service.recordConsent({
        applicationId: locals.applicationId,
        userId: locals.requester.userId,
        consentSnapshot: bodyResult.data.consentSnapshot as JsonObject,
      });
      res.json({ error: false, data: { consentRecorded: true, consent } });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_consent_failed");
    }
  },
);

franceAppointmentApplicationRouter.post(
  "/:applicationId/france-appointment/job",
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
      const job = await service.createJob({
        applicationId: locals.applicationId,
        userId: locals.requester.userId,
        centerCode: bodyResult.data.centerCode,
        mode: bodyResult.data.mode,
        idempotencyKey: bodyResult.data.idempotencyKey,
      });
      res.json({ error: false, data: job });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_job_create_failed");
    }
  },
);

franceAppointmentApplicationRouter.get(
  "/:applicationId/france-appointment/status",
  requireApplicationAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const applicationId = getLocals(res).applicationId;
    if (!applicationId) {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }
    try {
      const snapshot = await service.getStatusForApplication(applicationId);
      res.json({
        error: false,
        data: snapshot ?? {
          job: null,
          account: null,
          slots: [],
          pendingManualAction: null,
          manualActions: [],
          confirmation: null,
          latestStatusCheck: null,
          dryRunNotice: null,
        },
      });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_status_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/run",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const snapshot = await service.checkSlots(jobId);
      res.json({ error: false, data: snapshot });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_run_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/check-slots",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const snapshot = await service.checkSlots(jobId);
      res.json({ error: false, data: snapshot });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_check_slots_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/slots/:slotId/select",
  requireJobAccess,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = slotParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }
    try {
      const snapshot = await service.selectSlot(paramsResult.data.jobId, paramsResult.data.slotId);
      res.json({ error: false, data: snapshot });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_slot_select_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/payment-session",
  requireJobAccess,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = paymentSessionBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const job = await service.recordPaymentAuthorization(jobId, {
        sessionId: bodyResult.data.sessionId,
        redacted: bodyResult.data.redacted,
      });
      res.json({ error: false, data: await service.getStatus(job.id) });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_payment_session_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/approve-final-confirmation",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const job = await service.approveFinalConfirmation(jobId);
      res.json({ error: false, data: await service.getStatus(job.id) });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_final_approval_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/book-selected-slot",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const snapshot = await service.bookSelectedSlot(jobId);
      res.json({ error: false, data: snapshot });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_book_failed");
    }
  },
);

franceAppointmentOperationsRouter.post(
  "/jobs/:jobId/cancel",
  requireJobAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const jobId = getLocals(res).jobId;
    if (!jobId) {
      res.status(400).json({ error: true, code: "job_id_missing" });
      return;
    }
    try {
      const job = await service.cancelJob(jobId);
      res.json({ error: false, data: job });
    } catch (error) {
      sendFranceAppointmentError(res, error, "france_appointment_cancel_failed");
    }
  },
);
