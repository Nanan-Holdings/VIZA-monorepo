/**
 * UK account registration endpoint.
 *
 * POST /api/applications/:id/uk-account
 *   Body: { email, password, resumeUrl }
 *   Persists encrypted password + official resume URL to uk_accounts so the
 *   submission-service worker can drive the post-auth resume walk.
 *
 * Owner-validated via the same bearer-JWT pattern as
 * submission-result.routes.ts.
 */

import { Router, Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import { decryptSecret, encryptSecret } from "../utils/secret-cipher.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";

const router = Router();
const logger = new Logger({ serviceName: "UkAccountRoutes" });

interface UkAccountResolved {
  authUserId: string;
  applicantId: string;
  applicationId: string;
  country: string;
  visaType: string;
}

export const UK_STANDARD_VISITOR_VISA_TYPE = "UK_STANDARD_VISITOR";

/**
 * Applications have historically stored both the canonical UI country and
 * the shorter backend registry alias. Both are the same UK product; no other
 * country alias is accepted at this credential boundary.
 */
const UK_STANDARD_VISITOR_COUNTRIES = new Set(["uk", "united_kingdom"]);

/**
 * UKVI sends resume links from one of these two exact official origins. Keep
 * this allowlist deliberately narrow: a URL from a look-alike host, a URL
 * with credentials, a non-HTTPS URL, or a different path must never enter the
 * credential vault or be returned to an applicant.
 */
const UK_RESUME_UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;
const UK_RESUME_URL_RULES = [
  {
    hostname: "visas-immigration.service.gov.uk",
    path: (pathname: string) => (
      (pathname.startsWith("/forceResume/") && pathname.length > "/forceResume/".length)
      // UKVI's current save-and-return email uses /resume/<UUID>.
      || (pathname.startsWith("/resume/") && UK_RESUME_UUID.test(pathname.slice("/resume/".length)))
    ),
  },
  {
    hostname: "apply-uk-visa.service.gov.uk",
    path: (pathname: string) => pathname === "/forceResume",
  },
] as const;

function hasExplicitPort(value: string): boolean {
  const authority = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/iu)?.[1];
  if (!authority) return false;
  return authority.slice(authority.lastIndexOf("@") + 1).includes(":");
}

export function isUkStandardVisitorApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    visaType === UK_STANDARD_VISITOR_VISA_TYPE
    && typeof country === "string"
    && UK_STANDARD_VISITOR_COUNTRIES.has(country.trim().toLowerCase())
  );
}

export function isAllowedUkResumeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || hasExplicitPort(value)
    || url.hash
  ) {
    return false;
  }

  const rule = UK_RESUME_URL_RULES.find(({ hostname }) => url.hostname === hostname);
  if (!rule || !rule.path(url.pathname)) return false;

  // The apply-uk-visa mail format carries the resume token in the query. Do
  // not accept a bare or unrelated query because the returned URL is a
  // privileged continuation link.
  if (url.hostname === "apply-uk-visa.service.gov.uk") {
    const queryKeys = [...url.searchParams.keys()];
    return (
      queryKeys.length === 1
      && queryKeys[0] === "token"
      && Boolean(url.searchParams.get("token"))
    );
  }

  return url.search === "";
}

function setNoStoreHeaders(res: Response): void {
  res.set({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
}

async function requireApplicationOwnerForApplicant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Application ID required" });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const authConfig = readSupabaseUserAuthConfig();
    if (!authConfig) {
      res.status(500).json({ error: "Supabase auth not configured" });
      return;
    }

    const userClient = createClient(authConfig.supabaseUrl, authConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const authUserId = userData.user.id;

    const admin = getSupabaseClient();
    const { data: app, error: appErr } = await admin
      .from("applications")
      .select("id, applicant_id, country, visa_type, applicant_profiles!inner(auth_user_id)")
      .eq("id", id)
      .single();

    if (appErr || !app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const profile = app.applicant_profiles as unknown as { auth_user_id: string } | null;
    if (!profile || profile.auth_user_id !== authUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.locals.uk = {
      authUserId,
      applicantId: app.applicant_id as string,
      applicationId: app.id as string,
      country: app.country as string,
      visaType: app.visa_type as string,
    } satisfies UkAccountResolved;

    next();
  } catch (err) {
    logger.error(
      "uk_ownership_check_failed",
      err instanceof Error ? err : new Error(String(err)),
      { applicationId: req.params.id },
    );
    res.status(500).json({ error: "Ownership check failed" });
  }
}

router.post(
  "/:id/uk-account",
  requireApplicationOwnerForApplicant,
  async (req: Request, res: Response): Promise<void> => {
    const ownership = res.locals.uk as UkAccountResolved;
    if (!isUkStandardVisitorApplication(ownership.country, ownership.visaType)) {
      res.status(409).json({ error: "This application is not a UK Standard Visitor application" });
      return;
    }

    const { applicantId, applicationId } = ownership;
    const body = req.body as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "email, password, and resumeUrl are required" });
      return;
    }
    const { email, password, resumeUrl } = body as {
      email?: string;
      password?: string;
      resumeUrl?: string;
    };

    if (
      typeof email !== "string"
      || typeof password !== "string"
      || typeof resumeUrl !== "string"
      || !email.trim()
      || !password
      || !resumeUrl.trim()
    ) {
      res.status(400).json({ error: "email, password, and resumeUrl are required" });
      return;
    }
    const normalizedResumeUrl = resumeUrl.trim();
    if (!isAllowedUkResumeUrl(normalizedResumeUrl)) {
      res.status(400).json({ error: "resumeUrl must be an official UKVI HTTPS resume URL" });
      return;
    }

    let passwordEncrypted: string;
    try {
      passwordEncrypted = encryptSecret(password);
    } catch (err) {
      logger.error(
        "uk_account_encrypt_failed",
        err instanceof Error ? err : new Error(String(err)),
      );
      res.status(500).json({ error: "Failed to encrypt password" });
      return;
    }

    const admin = getSupabaseClient();
    const { error } = await admin
      .from("uk_accounts")
      .upsert(
        {
          applicant_id: applicantId,
          application_id: applicationId,
          email: email.trim(),
          password_encrypted: passwordEncrypted,
          resume_url: normalizedResumeUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id" },
      );

    if (error) {
      logger.error(
        "uk_account_upsert_failed",
        new Error(error.message),
        { applicantId },
      );
      res.status(500).json({ error: "Failed to persist UK account" });
      return;
    }

    res.json({ ok: true });
  },
);

/**
 * POST /api/applications/:id/uk-account/reveal
 *
 * Explicit owner-only reveal. The lookup is application-scoped even though
 * applicant_id is retained as a defence-in-depth check for legacy rows. UKVI
 * credentials never enter submission_result, a GET route, logs, or caches.
 */
router.post(
  "/:id/uk-account/reveal",
  (_req: Request, res: Response, next: NextFunction): void => {
    setNoStoreHeaders(res);
    next();
  },
  requireApplicationOwnerForApplicant,
  async (_req: Request, res: Response): Promise<void> => {
    setNoStoreHeaders(res);

    const ownership = res.locals.uk as UkAccountResolved;
    if (!isUkStandardVisitorApplication(ownership.country, ownership.visaType)) {
      res.status(409).json({ error: "This application is not a UK Standard Visitor application" });
      return;
    }

    try {
      const admin = getSupabaseClient();
      const { data: account, error } = await admin
        .from("uk_accounts")
        .select("email, password_encrypted, resume_url")
        .eq("application_id", ownership.applicationId)
        .eq("applicant_id", ownership.applicantId)
        .maybeSingle();

      if (error) {
        logger.error("uk_account_reveal_lookup_failed", new Error(error.message), {
          applicationId: ownership.applicationId,
        });
        res.status(500).json({ error: "Could not load the UK managed account" });
        return;
      }
      if (!account) {
        res.status(404).json({ error: "The UK managed account is not available" });
        return;
      }

      const email = typeof account.email === "string" ? account.email : "";
      const encryptedPassword = typeof account.password_encrypted === "string"
        ? account.password_encrypted
        : "";
      const resumeUrl = typeof account.resume_url === "string" ? account.resume_url : "";
      if (!email || !encryptedPassword || !isAllowedUkResumeUrl(resumeUrl)) {
        res.status(500).json({ error: "The UK managed account is incomplete" });
        return;
      }

      const password = decryptSecret(encryptedPassword);
      if (!password) {
        res.status(500).json({ error: "The UK managed account is incomplete" });
        return;
      }

      res.json({
        email,
        password,
        resumeUrl,
        revealedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        "uk_account_reveal_failed",
        err instanceof Error ? err : new Error(String(err)),
        { applicationId: ownership.applicationId },
      );
      res.status(500).json({ error: "Could not reveal the UK managed account" });
    }
  },
);

export default router;
