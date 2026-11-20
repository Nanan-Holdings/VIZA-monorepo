/**
 * France-Visas account linking.
 *
 * POST /api/applications/:id/france-visas-account
 *   Body: { email, password }
 *
 * The applicant registers on france-visas.gouv.fr themselves (they solve the
 * registration CAPTCHA and verify their email), then gives VIZA the login once.
 * Both values are encrypted with the shared submission secret cipher and stored
 * in fv_accounts for the submission worker, which signs in with them. One
 * linked account per user, reused by every France application.
 *
 * The password is never returned, logged, or cached.
 */

import { Router, Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import { encryptSecret } from "../utils/secret-cipher.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";

const router = Router();
const logger = new Logger({ serviceName: "FranceVisasAccountRoutes" });

export const FRANCE_VISAS_VISA_TYPE = "EU_SCHENGEN_C_SHORT_STAY";
export const FRANCE_VISAS_ACCOUNT_PROVIDER = "france_visas";

/** France-Visas limits its login email field to 70 characters. */
const MAX_EMAIL_LENGTH = 70;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FranceAccountOwner {
  authUserId: string;
  applicationId: string;
  visaType: string;
}

export function validateFranceVisasLogin(
  email: unknown,
  password: unknown,
): { email: string; password: string } | { error: string } {
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "email and password are required" };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(normalizedEmail)) {
    return { error: "email must be the address you registered on France-Visas" };
  }
  if (password.length < 8 || password.length > 128 || password.trim() !== password) {
    return { error: "password must be your France-Visas password (8-128 characters)" };
  }
  return { email: normalizedEmail, password };
}

/** "ab•••@domain" — enough for the applicant to recognise their address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  return `${local.slice(0, 2)}•••@${domain}`;
}

function setNoStoreHeaders(res: Response): void {
  res.set({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
}

async function requireApplicationOwner(
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
      .select("id, visa_type, applicant_profiles!inner(auth_user_id)")
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

    res.locals.franceAccountOwner = {
      authUserId,
      applicationId: app.id as string,
      visaType: app.visa_type as string,
    } satisfies FranceAccountOwner;
    next();
  } catch (err) {
    logger.error(
      "france_account_ownership_check_failed",
      err instanceof Error ? err : new Error(String(err)),
      { applicationId: req.params.id },
    );
    res.status(500).json({ error: "Ownership check failed" });
  }
}

router.post(
  "/:id/france-visas-account",
  (_req: Request, res: Response, next: NextFunction): void => {
    setNoStoreHeaders(res);
    next();
  },
  requireApplicationOwner,
  async (req: Request, res: Response): Promise<void> => {
    const owner = res.locals.franceAccountOwner as FranceAccountOwner;
    if (owner.visaType !== FRANCE_VISAS_VISA_TYPE) {
      res.status(409).json({ error: "This application is not a France short-stay application" });
      return;
    }

    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const login = validateFranceVisasLogin(body.email, body.password);
    if ("error" in login) {
      res.status(400).json({ error: login.error });
      return;
    }

    let emailEncrypted: string;
    let passwordEncrypted: string;
    try {
      emailEncrypted = encryptSecret(login.email);
      passwordEncrypted = encryptSecret(login.password);
    } catch (err) {
      logger.error("france_account_encrypt_failed", err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({ error: "Could not secure the France-Visas login" });
      return;
    }

    const admin = getSupabaseClient();
    // One linked account per user: replace any earlier one.
    const { error: deleteError } = await admin
      .from("fv_accounts")
      .delete()
      .eq("user_id", owner.authUserId)
      .eq("provider", FRANCE_VISAS_ACCOUNT_PROVIDER);
    if (deleteError) {
      logger.error("france_account_replace_failed", new Error(deleteError.message), {
        applicationId: owner.applicationId,
      });
      res.status(500).json({ error: "Could not save the France-Visas login" });
      return;
    }

    const now = new Date().toISOString();
    const { error: insertError } = await admin.from("fv_accounts").insert({
      user_id: owner.authUserId,
      application_id: owner.applicationId,
      official_account_email_encrypted: emailEncrypted,
      official_account_password_encrypted: passwordEncrypted,
      provider: FRANCE_VISAS_ACCOUNT_PROVIDER,
      status: "linked",
      created_at: now,
      updated_at: now,
    });
    if (insertError) {
      logger.error("france_account_insert_failed", new Error(insertError.message), {
        applicationId: owner.applicationId,
      });
      res.status(500).json({ error: "Could not save the France-Visas login" });
      return;
    }

    res.json({ ok: true, email: maskEmail(login.email), linkedAt: now });
  },
);

export default router;
