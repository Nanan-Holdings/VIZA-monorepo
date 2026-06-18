/**
 * Submission Result Routes
 *
 * User-facing endpoints that surface artifacts captured by the
 * submission-service runners. All endpoints validate that the requesting
 * user owns the application before returning anything sensitive.
 *
 * GET /api/applications/:id/uk-portal-credentials
 *   Decrypts and returns the UK portal password for the owner. Never logs the
 *   plaintext. Cipher lives in applications.submission_result.generatedPasswordCipher.
 *
 * GET /api/applications/:id/artifact-url?path=<storage-path>
 *   Mints a 1-hour signed URL for a Supabase Storage object, after verifying
 *   the path matches one of the application's known artifact paths.
 *
 * POST /api/applications/:id/retry-submission
 *   Resets submission_result_status to 'waiting' and re-queues the application.
 */

import { Router, Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";
import { decryptSecret } from "../utils/secret-cipher.js";
import type { SubmissionResult } from "../types/submission-result.js";

const router = Router();
const logger = new Logger({ serviceName: "SubmissionResultRoutes" });

const ARTIFACT_BUCKET = "submission-artifacts";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

interface ResolvedOwnership {
  authUserId: string;
  applicantId: string;
  applicationId: string;
  submissionResult: SubmissionResult | null;
  submissionResultStatus: string | null;
}

/**
 * Validate the bearer JWT and confirm the requester owns the application.
 * Attaches the resolved row to res.locals.ownership.
 */
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      res.status(500).json({ error: "Supabase auth not configured" });
      return;
    }

    // User-scoped client for token validation. We do NOT reuse this for the
    // ownership query because RLS could mask the row; the service-role
    // client is used for the join after we know the auth uid.
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
      .select(
        "id, applicant_id, submission_result, submission_result_status, applicant_profiles!inner(auth_user_id)",
      )
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

    res.locals.ownership = {
      authUserId,
      applicantId: app.applicant_id as string,
      applicationId: app.id as string,
      submissionResult: (app.submission_result as SubmissionResult | null) ?? null,
      submissionResultStatus: (app.submission_result_status as string | null) ?? null,
    } satisfies ResolvedOwnership;

    next();
  } catch (err) {
    logger.error(
      "ownership_check_failed",
      err instanceof Error ? err : new Error(String(err)),
      { applicationId: req.params.id },
    );
    res.status(500).json({ error: "Ownership check failed" });
  }
}

/**
 * GET /api/applications/:id/uk-portal-credentials
 *
 * Returns the decrypted UK portal password to the application owner. Never
 * logs the plaintext. Returns 404 if there's no UK result on file.
 */
router.get(
  "/:id/uk-portal-credentials",
  requireApplicationOwner,
  async (_req: Request, res: Response): Promise<void> => {
    const ownership = res.locals.ownership as ResolvedOwnership;
    const result = ownership.submissionResult;
    if (!result || result.country !== "UK") {
      res.status(404).json({ error: "No UK submission result on this application" });
      return;
    }
    if (!result.generatedPasswordCipher) {
      res.status(404).json({ error: "No portal password captured for this application" });
      return;
    }
    try {
      const password = decryptSecret(result.generatedPasswordCipher);
      res.json({ password });
    } catch (err) {
      logger.error(
        "uk_credentials_decrypt_failed",
        err instanceof Error ? err : new Error(String(err)),
        { applicationId: ownership.applicationId },
      );
      res.status(500).json({ error: "Decrypt failed" });
    }
  },
);

/**
 * GET /api/applications/:id/artifact-url?path=...
 *
 * Mints a 1h signed URL for the given storage path. The path must match one
 * of the artifact paths recorded on the application's submission_result —
 * we never sign arbitrary user-supplied paths.
 */
router.get(
  "/:id/artifact-url",
  requireApplicationOwner,
  async (req: Request, res: Response): Promise<void> => {
    const ownership = res.locals.ownership as ResolvedOwnership;
    const path = req.query.path;
    if (typeof path !== "string" || !path) {
      res.status(400).json({ error: "path query param required" });
      return;
    }

    const allowedPaths = collectArtifactPaths(ownership.submissionResult);
    if (!allowedPaths.includes(path)) {
      res.status(403).json({ error: "Path not associated with this application" });
      return;
    }

    const admin = getSupabaseClient();
    const { data, error } = await admin.storage
      .from(ARTIFACT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      logger.error(
        "artifact_signed_url_failed",
        new Error(error?.message ?? "unknown"),
        { applicationId: ownership.applicationId, path },
      );
      res.status(500).json({ error: "Failed to mint signed URL" });
      return;
    }
    res.json({ url: data.signedUrl });
  },
);

/**
 * POST /api/applications/:id/retry-submission
 *
 * Resets `submission_result_status` to `waiting` so the FE re-renders the
 * WaitingCard. The poller picks the queue row back up on its next tick if
 * its status was reset to a *_prefill_pending value. We do not auto-reset
 * the queue row here — operators may want to inspect first.
 */
router.post(
  "/:id/retry-submission",
  requireApplicationOwner,
  async (_req: Request, res: Response): Promise<void> => {
    const ownership = res.locals.ownership as ResolvedOwnership;
    const admin = getSupabaseClient();
    const { error } = await admin
      .from("applications")
      .update({
        submission_result_status: "waiting",
        submission_result: null,
        submission_result_updated_at: new Date().toISOString(),
      })
      .eq("id", ownership.applicationId);
    if (error) {
      logger.error(
        "retry_submission_failed",
        new Error(error.message),
        { applicationId: ownership.applicationId },
      );
      res.status(500).json({ error: "Failed to reset submission status" });
      return;
    }
    res.json({ ok: true });
  },
);

function collectArtifactPaths(result: SubmissionResult | null): string[] {
  if (!result) return [];
  const paths: string[] = [];
  if (result.country === "US") {
    if (result.datStoragePath) paths.push(result.datStoragePath);
    if (result.confirmationPdfStoragePath) paths.push(result.confirmationPdfStoragePath);
    if (result.applicationPdfStoragePath) paths.push(result.applicationPdfStoragePath);
    if (result.emailConfirmationPdfStoragePath) paths.push(result.emailConfirmationPdfStoragePath);
  }
  if (result.country === "FR" && result.printablePdfStoragePath) paths.push(result.printablePdfStoragePath);
  return paths;
}

export default router;
