import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseClient } from "../db/supabase-client.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";
import {
  JapanAppointmentService,
  JapanAppointmentServiceError,
  SupabaseJapanAppointmentRepository,
  type JsonObject,
} from "../services/japan-appointment/index.js";
import { Logger } from "../utils/logger.js";

const repository = new SupabaseJapanAppointmentRepository();
const service = new JapanAppointmentService(repository);
const logger = new Logger({ serviceName: "JapanAppointmentRoutes" });
export const japanAppointmentApplicationRouter = Router();
export const japanAppointmentOperationsRouter = Router();

type Requester = { kind: "user"; userId: string; role: string | null } | { kind: "service"; userId: null; role: "service" };
interface Locals { requester: Requester; applicationId?: string; jobId?: string }

const applicationParams = z.object({ applicationId: z.string().uuid() });
const jobParams = z.object({ jobId: z.string().uuid() });
const consentBody = z.object({ accepted: z.literal(true), consentSnapshot: z.record(z.unknown()).default({}) }).strict();
const jobBody = z.object({
  idempotencyKey: z.string().trim().min(8).max(180).optional(),
  eligibility: z.object({
    singaporePassType: z.string().trim().min(1),
    singaporePassExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    intendedReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    passportType: z.string().trim().min(1),
    visaRequestType: z.string().trim().min(1),
    occupation: z.string().trim().min(1),
    checklistConfirmed: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
}).strict();

function bearer(req: Request) {
  const value = req.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

function equalToken(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function requester(req: Request): Promise<Requester | null> {
  const token = bearer(req);
  if (!token) return null;
  const serviceTokens = [process.env.JAPAN_APPOINTMENT_INTERNAL_TOKEN, process.env.AGENT_BACKEND_INTERNAL_TOKEN, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .filter((value): value is string => Boolean(value?.trim()));
  if (serviceTokens.some((value) => equalToken(token, value))) return { kind: "service", userId: null, role: "service" };
  const auth = readSupabaseUserAuthConfig();
  if (!auth) throw new JapanAppointmentServiceError(500, "supabase_auth_not_configured", "Supabase auth is not configured.");
  const userClient = createClient(auth.supabaseUrl, auth.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await getSupabaseClient().from("users").select("role, deleted_at").eq("id", data.user.id).maybeSingle();
  return { kind: "user", userId: data.user.id, role: row?.deleted_at === null && typeof row.role === "string" ? row.role : null };
}

function fail(res: Response, error: unknown, code: string) {
  if (error instanceof JapanAppointmentServiceError) {
    res.status(error.status).json({ error: true, code: error.code, message: error.message });
    return;
  }
  logger.error(code, error instanceof Error ? error : new Error(String(error)));
  res.status(500).json({ error: true, code, message: "Japan appointment request failed." });
}

async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const value = await requester(req);
    if (!value) { res.status(401).json({ error: true, code: "unauthorized", message: "Bearer token required." }); return; }
    res.locals.japanAppointment = { requester: value } satisfies Locals;
    next();
  } catch (error) { fail(res, error, "japan_appointment_auth_failed"); }
}

function locals(res: Response) { return res.locals.japanAppointment as Locals; }

async function applicationAccess(req: Request, res: Response, next: NextFunction) {
  await auth(req, res, async () => {
    const parsed = applicationParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: true, code: "validation_error" }); return; }
    const current = locals(res);
    if (current.requester.kind === "service" || current.requester.role === "admin") {
      current.applicationId = parsed.data.applicationId; next(); return;
    }
    try {
      const application = await repository.getApplication(parsed.data.applicationId);
      if (!application) { res.status(404).json({ error: true, code: "application_not_found" }); return; }
      if (application.userId !== current.requester.userId) { res.status(403).json({ error: true, code: "forbidden" }); return; }
      current.applicationId = application.id; next();
    } catch (error) { fail(res, error, "japan_appointment_application_access_failed"); }
  });
}

async function owner(req: Request, res: Response, next: NextFunction) {
  await applicationAccess(req, res, () => {
    if (locals(res).requester.kind !== "user") { res.status(403).json({ error: true, code: "owner_user_required" }); return; }
    next();
  });
}

async function jobAccess(req: Request, res: Response, next: NextFunction) {
  await auth(req, res, async () => {
    const parsed = jobParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: true, code: "validation_error" }); return; }
    try {
      const job = await repository.getJob(parsed.data.jobId);
      if (!job) { res.status(404).json({ error: true, code: "appointment_job_not_found" }); return; }
      const current = locals(res);
      if (current.requester.kind === "user" && current.requester.role !== "admin" && current.requester.userId !== job.userId) {
        res.status(403).json({ error: true, code: "forbidden" }); return;
      }
      current.jobId = job.id; next();
    } catch (error) { fail(res, error, "japan_appointment_job_access_failed"); }
  });
}

japanAppointmentApplicationRouter.get("/:applicationId/japan-appointment/status", applicationAccess, async (_req, res) => {
  try { res.json({ error: false, data: await service.getStatusForApplication(locals(res).applicationId ?? "") }); }
  catch (error) { fail(res, error, "japan_appointment_status_failed"); }
});

japanAppointmentApplicationRouter.post("/:applicationId/japan-appointment/consent", owner, async (req, res) => {
  const parsed = consentBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: true, code: "validation_error", details: parsed.error.issues }); return; }
  const current = locals(res);
  if (current.requester.kind !== "user") return;
  try {
    const consent = await service.recordConsent({ applicationId: current.applicationId ?? "", userId: current.requester.userId, snapshot: parsed.data.consentSnapshot as JsonObject });
    res.json({ error: false, data: { consentRecorded: true, consent } });
  } catch (error) { fail(res, error, "japan_appointment_consent_failed"); }
});

japanAppointmentApplicationRouter.post("/:applicationId/japan-appointment/job", owner, async (req, res) => {
  const parsed = jobBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: true, code: "validation_error", details: parsed.error.issues }); return; }
  const current = locals(res);
  if (current.requester.kind !== "user") return;
  try {
    const job = await service.createJob({ applicationId: current.applicationId ?? "", userId: current.requester.userId, eligibility: parsed.data.eligibility, idempotencyKey: parsed.data.idempotencyKey });
    res.json({ error: false, data: job });
  } catch (error) { fail(res, error, "japan_appointment_job_create_failed"); }
});

japanAppointmentOperationsRouter.post("/jobs/:jobId/check-portal", jobAccess, async (_req, res) => {
  try { res.json({ error: false, data: await service.checkPortal(locals(res).jobId ?? "") }); }
  catch (error) { fail(res, error, "japan_appointment_check_portal_failed"); }
});

japanAppointmentOperationsRouter.post("/jobs/:jobId/cancel", jobAccess, async (_req, res) => {
  try { res.json({ error: false, data: await service.cancel(locals(res).jobId ?? "") }); }
  catch (error) { fail(res, error, "japan_appointment_cancel_failed"); }
});
