/**
 * UK account registration endpoint.
 *
 * POST /api/applications/:id/uk-account
 *   Body: { email, password, resumeUrl }
 *   Persists encrypted password + forceResume URL to uk_accounts so the
 *   submission-service worker can drive the post-auth resume walk.
 *
 * Owner-validated via the same bearer-JWT pattern as
 * submission-result.routes.ts.
 */

import { Router, Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import { encryptSecret } from "../utils/secret-cipher.js";

const router = Router();
const logger = new Logger({ serviceName: "UkAccountRoutes" });

interface UkAccountResolved {
  authUserId: string;
  applicantId: string;
  applicationId: string;
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      res.status(500).json({ error: "Supabase auth not configured" });
      return;
    }

    const userClient = createClient(supabaseUrl, anonKey, {
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
      .select("id, applicant_id, applicant_profiles!inner(auth_user_id)")
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
    const { applicantId } = res.locals.uk as UkAccountResolved;
    const { email, password, resumeUrl } = req.body as {
      email?: string;
      password?: string;
      resumeUrl?: string;
    };

    if (!email || !password || !resumeUrl) {
      res.status(400).json({ error: "email, password, and resumeUrl are required" });
      return;
    }
    if (!/^https:\/\/visas-immigration\.service\.gov\.uk\/forceResume\//.test(resumeUrl)) {
      res.status(400).json({ error: "resumeUrl must be a visas-immigration.service.gov.uk forceResume URL" });
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
          email,
          password_encrypted: passwordEncrypted,
          resume_url: resumeUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "applicant_id,email" },
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

export default router;
