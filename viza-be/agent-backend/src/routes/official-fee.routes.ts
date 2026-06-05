import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import {
  createOfficialFeeServices,
  OfficialFeeServiceError,
  officialFeeModes,
  redactToObject,
  SupabaseOfficialFeeRepository,
  type OfficialFeeMode,
} from "../services/official-fee/index.js";

const logger = new Logger({ serviceName: "OfficialFeeRoutes" });

const repository = new SupabaseOfficialFeeRepository();
const officialFeeServices = createOfficialFeeServices(repository);

export const officialFeeApplicationRouter = Router();
export const officialFeeOperationsRouter = Router();

type Requester =
  | { kind: "user"; userId: string; role: string | null }
  | { kind: "service"; userId: null; role: "service" };

interface OfficialFeeLocals {
  requester: Requester;
  applicationId?: string;
}

const applicationIdParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

const intentIdParamsSchema = z.object({
  intentId: z.string().uuid(),
});

const quoteBodySchema = z
  .object({
    mode: z.enum(officialFeeModes).optional(),
    expiresInMinutes: z.number().int().min(5).max(24 * 60).optional(),
  })
  .strict();

const consentBodySchema = z
  .object({
    quoteId: z.string().uuid(),
    accepted: z.literal(true),
    consentSnapshot: z.record(z.unknown()).optional().default({}),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
  })
  .strict();

const paymentIntentBodySchema = z
  .object({
    quoteId: z.string().uuid().optional(),
    mode: z.enum(officialFeeModes).optional(),
    provider: z.string().trim().min(1).max(120).optional(),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
    fundingSource: z.enum(["user_deposit", "company_advance"]).optional(),
  })
  .strict();

const approveBodySchema = z
  .object({
    adminId: z.string().uuid().optional(),
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
    process.env.OFFICIAL_FEE_INTERNAL_TOKEN,
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new OfficialFeeServiceError(
      500,
      "supabase_auth_not_configured",
      "Supabase auth is not configured.",
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
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
  const existing = res.locals.officialFee as OfficialFeeLocals | undefined;
  if (existing) {
    existing.requester = requester;
    return;
  }
  res.locals.officialFee = { requester } satisfies OfficialFeeLocals;
}

function getOfficialFeeLocals(res: Response): OfficialFeeLocals {
  return res.locals.officialFee as OfficialFeeLocals;
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
    message: "Request validation failed",
    details: formatValidationError(error),
  });
}

function sendOfficialFeeError(res: Response, error: unknown, fallbackCode: string): void {
  if (error instanceof OfficialFeeServiceError) {
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
    message: "Official fee request failed.",
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
    sendOfficialFeeError(res, error, "official_fee_auth_failed");
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

    const locals = getOfficialFeeLocals(res);
    const requester = locals.requester;
    if (requester.kind === "service" || requester.role === "admin") {
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
      sendOfficialFeeError(res, error, "official_fee_application_auth_failed");
    }
  });
}

async function requireOwnerUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireApplicationAccess(req, res, async () => {
    const requester = getOfficialFeeLocals(res).requester;
    if (requester.kind !== "user") {
      res.status(403).json({
        error: true,
        code: "user_action_required",
        message: "This action must be completed by the authenticated applicant.",
      });
      return;
    }
    next();
  });
}

async function requireAdminOrService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuthenticated(req, res, () => {
    const requester = getOfficialFeeLocals(res).requester;
    if (requester.kind === "service" || requester.role === "admin") {
      next();
      return;
    }
    res.status(403).json({
      error: true,
      code: "admin_required",
      message: "Admin or service authorization is required.",
    });
  });
}

function requireAdminOnly(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requester = getOfficialFeeLocals(res).requester;
  if (requester.kind === "user" && requester.role === "admin") {
    next();
    return;
  }
  res.status(403).json({
    error: true,
    code: "admin_required",
    message: "Admin authorization is required.",
  });
}

officialFeeApplicationRouter.post(
  "/:applicationId/official-fee/quote",
  requireApplicationAccess,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = quoteBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }
    const applicationId = getOfficialFeeLocals(res).applicationId;
    if (!applicationId) {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const quote = await officialFeeServices.quoteService.createFeeQuote(applicationId, {
        mode: bodyResult.data.mode as OfficialFeeMode | undefined,
        expiresInMinutes: bodyResult.data.expiresInMinutes,
      });
      await officialFeeServices.consentService.requestConsent(applicationId, quote.id);
      res.json({ error: false, data: quote });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_quote_failed");
    }
  },
);

officialFeeApplicationRouter.post(
  "/:applicationId/official-fee/consent",
  requireOwnerUser,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = consentBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const locals = getOfficialFeeLocals(res);
    const applicationId = locals.applicationId;
    if (!applicationId || locals.requester.kind !== "user") {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      await officialFeeServices.consentService.recordConsent(
        applicationId,
        bodyResult.data.quoteId,
        {
          actorUserId: locals.requester.userId,
          consentSnapshot: redactToObject(bodyResult.data.consentSnapshot),
          idempotencyKey: bodyResult.data.idempotencyKey,
        },
      );
      res.json({ error: false, data: { consentRecorded: true } });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_consent_failed");
    }
  },
);

officialFeeApplicationRouter.post(
  "/:applicationId/official-fee/payment-intent",
  requireApplicationAccess,
  async (req: Request, res: Response): Promise<void> => {
    const bodyResult = paymentIntentBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const applicationId = getOfficialFeeLocals(res).applicationId;
    if (!applicationId) {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const intent = await officialFeeServices.paymentService.createOfficialFeePaymentIntent(
        applicationId,
        bodyResult.data,
      );
      res.json({ error: false, data: { ...intent, paymentInstrumentId: null } });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_intent_failed");
    }
  },
);

officialFeeApplicationRouter.get(
  "/:applicationId/official-fee/status",
  requireApplicationAccess,
  async (_req: Request, res: Response): Promise<void> => {
    const applicationId = getOfficialFeeLocals(res).applicationId;
    if (!applicationId) {
      res.status(400).json({ error: true, code: "application_id_missing" });
      return;
    }

    try {
      const status = await officialFeeServices.paymentService.getOfficialFeePaymentStatus(
        applicationId,
      );
      res.json({ error: false, data: status });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_status_failed");
    }
  },
);

officialFeeOperationsRouter.post(
  "/payment-intents/:intentId/approve",
  requireAuthenticated,
  requireAdminOnly,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = intentIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }
    const bodyResult = approveBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      sendValidationError(res, bodyResult.error);
      return;
    }

    const requester = getOfficialFeeLocals(res).requester;
    if (requester.kind !== "user") {
      res.status(403).json({
        error: true,
        code: "admin_required",
        message: "Admin authorization is required.",
      });
      return;
    }

    try {
      const intent = await officialFeeServices.paymentService.approveOfficialFeePayment(
        paramsResult.data.intentId,
        bodyResult.data.adminId ?? requester.userId,
      );
      res.json({ error: false, data: { ...intent, paymentInstrumentId: null } });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_approve_failed");
    }
  },
);

officialFeeOperationsRouter.post(
  "/payment-intents/:intentId/execute",
  requireAdminOrService,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = intentIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const result = await officialFeeServices.paymentService.executeOfficialFeePayment(
        paramsResult.data.intentId,
      );
      res.json({
        error: false,
        data: {
          ...result,
          intent: { ...result.intent, paymentInstrumentId: null },
        },
      });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_execute_failed");
    }
  },
);

officialFeeOperationsRouter.post(
  "/payment-intents/:intentId/retry",
  requireAdminOrService,
  async (req: Request, res: Response): Promise<void> => {
    const paramsResult = intentIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      sendValidationError(res, paramsResult.error);
      return;
    }

    try {
      const result = await officialFeeServices.paymentService.retryOfficialFeePayment(
        paramsResult.data.intentId,
      );
      res.json({
        error: false,
        data: {
          ...result,
          intent: { ...result.intent, paymentInstrumentId: null },
        },
      });
    } catch (error) {
      sendOfficialFeeError(res, error, "official_fee_retry_failed");
    }
  },
);
