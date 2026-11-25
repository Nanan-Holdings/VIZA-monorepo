/**
 * France-Visas account reveal.
 *
 * POST /api/applications/:id/france-visas-account/reveal
 *
 * The submission worker registers one France-Visas account per application
 * (on the application's inbox alias) and stores the login in fv_accounts,
 * encrypted with the shared submission secret cipher. This explicit,
 * owner-only route decrypts it so the applicant can sign in to France-Visas
 * themselves. The values are never logged, cached, or returned by a GET.
 */

import { Router, Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import { decryptSecret } from "../utils/secret-cipher.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";

const router = Router();
const logger = new Logger({ serviceName: "FranceVisasAccountRoutes" });

export const FRANCE_VISAS_VISA_TYPE = "EU_SCHENGEN_C_SHORT_STAY";

interface FranceAccountOwner {
  authUserId: string;
  applicationId: string;
  visaType: string;
}

function setNoStoreHeaders(res: Response): void {
  res.set({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
}

function decryptOrEmpty(payload: unknown): string {
  if (typeof payload !== "string" || !payload) return "";
  try {
    return decryptSecret(payload);
  } catch {
    return "";
  }
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
  "/:id/france-visas-account/reveal",
  (_req: Request, res: Response, next: NextFunction): void => {
    setNoStoreHeaders(res);
    next();
  },
  requireApplicationOwner,
  async (_req: Request, res: Response): Promise<void> => {
    const owner = res.locals.franceAccountOwner as FranceAccountOwner;
    if (owner.visaType !== FRANCE_VISAS_VISA_TYPE) {
      res.status(409).json({ error: "This application is not a France short-stay application" });
      return;
    }

    try {
      const admin = getSupabaseClient();
      const { data: account, error } = await admin
        .from("fv_accounts")
        .select("official_account_email_encrypted, official_account_password_encrypted")
        .eq("application_id", owner.applicationId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        logger.error("france_account_reveal_lookup_failed", new Error(error.message), {
          applicationId: owner.applicationId,
        });
        res.status(500).json({ error: "Could not load the France-Visas account" });
        return;
      }
      if (!account) {
        res.status(404).json({ error: "The France-Visas account has not been created yet" });
        return;
      }

      const email = decryptOrEmpty(account.official_account_email_encrypted);
      const password = decryptOrEmpty(account.official_account_password_encrypted);
      if (!email || !password) {
        logger.error("france_account_reveal_incomplete", new Error("missing or undecryptable login"), {
          applicationId: owner.applicationId,
        });
        res.status(500).json({ error: "The France-Visas account is incomplete" });
        return;
      }

      res.json({ email, password, revealedAt: new Date().toISOString() });
    } catch (err) {
      logger.error(
        "france_account_reveal_failed",
        err instanceof Error ? err : new Error(String(err)),
        { applicationId: owner.applicationId },
      );
      res.status(500).json({ error: "Could not reveal the France-Visas account" });
    }
  },
);

export default router;
