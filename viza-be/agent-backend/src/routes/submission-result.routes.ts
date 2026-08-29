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
import { applicantVault } from "../db/applicant-vault.js";
import type { SubmissionResult } from "../types/submission-result.js";
import {
  getJpVjwCredentialKeys,
  hasAuthoritativeJpVjwResult,
  JP_VJW_LEGACY_CREDENTIAL_KEYS,
  JP_VJW_OFFICIAL_PORTAL_URL,
  resolveJpVjwStoredCredentials,
} from "./jp-vjw-credentials.js";
import { readSupabaseUserAuthConfig } from "./supabase-user-auth-config.js";

const router = Router();
const logger = new Logger({ serviceName: "SubmissionResultRoutes" });

const ARTIFACT_BUCKET = "submission-artifacts";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

interface ResolvedOwnership {
  authUserId: string;
  applicantId: string;
  applicationId: string;
  country: string | null;
  visaType: string | null;
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

    const authConfig = readSupabaseUserAuthConfig();
    if (!authConfig) {
      res.status(500).json({ error: "Supabase auth not configured" });
      return;
    }

    // User-scoped client for token validation. We do NOT reuse this for the
    // ownership query because RLS could mask the row; the service-role
    // client is used for the join after we know the auth uid.
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
      .select(
        "id, applicant_id, country, visa_type, submission_result, submission_result_status, applicant_profiles!inner(auth_user_id)",
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
      country: (app.country as string | null) ?? null,
      visaType: (app.visa_type as string | null) ?? null,
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
 * POST /api/applications/:id/jp-vjw/account/reveal
 *
 * Explicit owner-only credential reveal. Plaintext is never logged, cached,
 * included in submission_result, or returned by a GET request.
 */
router.post(
  "/:id/jp-vjw/account/reveal",
  requireApplicationOwner,
  async (_req: Request, res: Response): Promise<void> => {
    res.set({
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    const ownership = res.locals.ownership as ResolvedOwnership;
    const normalizedCountry = ownership.country?.trim().toLowerCase();
    if (
      ownership.visaType !== "JP_VISIT_JAPAN_WEB"
      || (normalizedCountry !== "japan" && normalizedCountry !== "jp")
    ) {
      res.status(409).json({ error: "This application is not a Visit Japan Web declaration" });
      return;
    }
    if (!hasAuthoritativeJpVjwResult(ownership.submissionResult)) {
      res.status(409).json({ error: "Visit Japan Web credentials are available only after the official QR is ready" });
      return;
    }

    try {
      const admin = getSupabaseClient();
      const { data: aliasRow, error: aliasError } = await admin
        .from("application_inbox_aliases")
        .select("alias")
        .eq("application_id", ownership.applicationId)
        .eq("applicant_id", ownership.applicantId)
        .is("retired_at", null)
        .maybeSingle();
      if (aliasError || !aliasRow?.alias) {
        res.status(409).json({ error: "The Visit Japan Web managed account is not available" });
        return;
      }

      const opts = {
        actor: "agent-backend:jp-vjw-owner-reveal",
        correlationId: ownership.applicationId,
      };
      const scopedKeys = getJpVjwCredentialKeys(ownership.applicationId);
      const [scopedEmail, scopedPassword, scopedRegistrationState] = await Promise.all([
        applicantVault.get(ownership.applicantId, scopedKeys.email, opts),
        applicantVault.get(ownership.applicantId, scopedKeys.password, opts),
        applicantVault.get(ownership.applicantId, scopedKeys.registrationState, opts),
      ]);
      const scopedHasData = Boolean(scopedEmail || scopedPassword || scopedRegistrationState);
      const [legacyEmail, legacyPassword, legacyRegistrationState] = scopedHasData
        ? [null, null, null]
        : await Promise.all([
            applicantVault.get(ownership.applicantId, JP_VJW_LEGACY_CREDENTIAL_KEYS.email, opts),
            applicantVault.get(ownership.applicantId, JP_VJW_LEGACY_CREDENTIAL_KEYS.password, opts),
            applicantVault.get(ownership.applicantId, JP_VJW_LEGACY_CREDENTIAL_KEYS.registrationState, opts),
          ]);
      const resolved = resolveJpVjwStoredCredentials({
        alias: aliasRow.alias as string,
        scoped: {
          email: scopedEmail,
          password: scopedPassword,
          registrationState: scopedRegistrationState,
        },
        legacy: {
          email: legacyEmail,
          password: legacyPassword,
          registrationState: legacyRegistrationState,
        },
      });
      if (!resolved.ok) {
        res.status(409).json({ error: "The Visit Japan Web managed account is not ready" });
        return;
      }

      res.json({
        email: resolved.email,
        password: resolved.password,
        portalUrl: JP_VJW_OFFICIAL_PORTAL_URL,
        revealedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        "jp_vjw_credentials_reveal_failed",
        err instanceof Error ? err : new Error(String(err)),
        { applicationId: ownership.applicationId },
      );
      res.status(500).json({ error: "Could not reveal the Visit Japan Web managed account" });
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
