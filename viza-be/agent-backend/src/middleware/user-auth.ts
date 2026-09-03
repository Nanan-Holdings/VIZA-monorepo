/**
 * Shared applicant authentication / authorization middleware for browser-facing
 * agent-backend routes.
 *
 * Two accepted credentials, mirroring the established `official-fee.routes.ts`
 * pattern:
 *   1. A Supabase user access token (Authorization: Bearer <jwt>). The token is
 *      validated with a user-scoped anon client (`auth.getUser`) and the
 *      authenticated `auth_user_id` is derived server-side. Any user id in the
 *      request body/query is IGNORED — it can never be trusted.
 *   2. A dedicated internal service token (server-to-server callers). This is a
 *      distinct secret from the Supabase service-role key on purpose
 *      (INTERNAL_AUTOMATION_TOKEN / AGENT_BACKEND_INTERNAL_TOKEN); the service
 *      role key is never accepted as a bearer credential here.
 *
 * Ownership of an application is resolved through the service-role client after
 * the auth uid is known (RLS could otherwise mask the row), matching
 * `submission-result.routes.ts#requireApplicationOwner`.
 */

import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { readSupabaseUserAuthConfig } from "../routes/supabase-user-auth-config.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "UserAuthMiddleware" });

const AUTH_PREFIX = "Bearer ";

export type Requester =
  | { kind: "service" }
  | { kind: "user"; authUserId: string };

export interface UserAuthLocals {
  requester?: Requester;
}

export function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith(AUTH_PREFIX)) return null;
  const token = authHeader.slice(AUTH_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Dedicated internal automation tokens for server-to-server callers. The
 * Supabase service-role key is intentionally NOT included so a leaked bearer
 * credential cannot double as full database access.
 */
function configuredInternalTokens(): string[] {
  return [
    process.env.INTERNAL_AUTOMATION_TOKEN,
    process.env.AGENT_BACKEND_INTERNAL_TOKEN,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function tokensMatch(providedToken: string, configuredToken: string): boolean {
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  if (provided.length !== configured.length) return false;
  return timingSafeEqual(provided, configured);
}

export function isInternalServiceToken(token: string): boolean {
  return configuredInternalTokens().some((configured) =>
    tokensMatch(token, configured),
  );
}

/**
 * Validate a Supabase access token and return the authenticated auth_user_id,
 * or null if the token is missing/invalid. Throws only when Supabase auth is
 * not configured at all (a 500-class misconfiguration).
 */
export async function authenticateSupabaseUser(
  token: string,
): Promise<string | null> {
  const authConfig = readSupabaseUserAuthConfig();
  if (!authConfig) {
    throw new Error("supabase_user_auth_not_configured");
  }
  const userClient = createClient(authConfig.supabaseUrl, authConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Resolve the caller into a Requester (service or authenticated user), or null
 * when no valid credential is present.
 */
export async function resolveRequester(req: Request): Promise<Requester | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  if (isInternalServiceToken(token)) return { kind: "service" };
  const authUserId = await authenticateSupabaseUser(token);
  if (!authUserId) return null;
  return { kind: "user", authUserId };
}

function setRequester(res: Response, requester: Requester): void {
  const locals = res.locals as UserAuthLocals;
  locals.requester = requester;
}

export function getRequester(res: Response): Requester {
  return (res.locals as UserAuthLocals).requester as Requester;
}

/**
 * Express middleware: require a valid service token or Supabase user token.
 * Sets res.locals.requester.
 */
export async function requireRequester(
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
        message: "Bearer token required",
      });
      return;
    }
    setRequester(res, requester);
    next();
  } catch (err) {
    if (err instanceof Error && err.message === "supabase_user_auth_not_configured") {
      res.status(500).json({
        error: true,
        code: "auth_not_configured",
        message: "Authentication is not configured",
      });
      return;
    }
    logger.error(
      "require_requester_failed",
      err instanceof Error ? err : new Error(String(err)),
    );
    res.status(500).json({ error: true, code: "auth_failed", message: "Authentication failed" });
  }
}

interface OwnershipProfileRow {
  auth_user_id: string | null;
  dependant_of_user_id?: string | null;
}

/**
 * Does the given auth user own (or is a dependant on) the application? Resolved
 * with the service-role client so RLS cannot mask the row.
 */
export async function applicationBelongsToUser(
  applicationId: string,
  authUserId: string,
): Promise<boolean | null> {
  const admin = getSupabaseClient();
  const { data, error } = await admin
    .from("applications")
    .select("id, applicant_profiles!inner(auth_user_id, dependant_of_user_id)")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null; // application not found

  const profile = data.applicant_profiles as unknown as OwnershipProfileRow | null;
  if (!profile) return false;
  return (
    profile.auth_user_id === authUserId ||
    profile.dependant_of_user_id === authUserId
  );
}

/**
 * Express middleware factory: require the caller to own the application named
 * by `paramName` (default "id"). Service tokens bypass the ownership check.
 */
export function requireApplicationOwner(paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireRequester(req, res, async () => {
      const requester = getRequester(res);
      if (requester.kind === "service") {
        next();
        return;
      }
      const applicationId = req.params[paramName];
      if (!applicationId) {
        res.status(400).json({ error: true, code: "bad_request", message: "Application id required" });
        return;
      }
      try {
        const owns = await applicationBelongsToUser(applicationId, requester.authUserId);
        if (owns === null) {
          res.status(404).json({ error: true, code: "not_found", message: "Application not found" });
          return;
        }
        if (!owns) {
          res.status(403).json({ error: true, code: "forbidden", message: "Forbidden" });
          return;
        }
        next();
      } catch (err) {
        logger.error(
          "application_ownership_check_failed",
          err instanceof Error ? err : new Error(String(err)),
          { applicationId },
        );
        res.status(500).json({ error: true, code: "auth_failed", message: "Ownership check failed" });
      }
    });
  };
}
