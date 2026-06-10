"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import { buildZip, type ZipEntry } from "@/lib/legal/zip-encoder";
import { AccountRateLimitError } from "@/lib/account/errors";

/**
 * Account-level data subject actions (LEGAL-004).
 *
 * - exportAccountData() — gathers all rows scoped to the signed-in
 *   user's applicant_profiles row and any uploaded files, returns a
 *   ZIP buffer. Audit-logged + rate-limited (1/hour).
 * - requestAccountDeletion() — stamps deletion_requested_at +
 *   deletion_scheduled_at = now + 7d, audit-logs. The retention
 *   purge worker honours this stamp.
 * - revokeAccountDeletion() — clears the stamps before the window
 *   closes.
 */

const EXPORT_RATE_WINDOW_S = 3600; // 1/hour
const DELETE_REQUEST_RATE_WINDOW_S = 86_400; // 1/day
const DELETION_GRACE_DAYS = 7;

async function readForensics() {
  const h = await headers();
  return {
    ip:
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
    ua: h.get("user-agent") ?? null,
  };
}

async function requireSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function rateLimitOrThrow(
  userId: string,
  action: string,
  windowSeconds: number,
): Promise<void> {
  await withAdmin("system", "actions/account:rateLimit", async (admin) => {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, error } = await admin
      .from("account_action_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", action)
      .eq("outcome", "ok")
      .gte("ts", since);
    if (error) {
      throw new Error(`rateLimit check failed: ${error.message}`);
    }
    if ((count ?? 0) > 0) {
      throw new AccountRateLimitError(action, windowSeconds);
    }
  });
}

async function logAccountAction(
  userId: string | null,
  applicantId: string | null,
  action: string,
  outcome: "ok" | "rejected" | "error",
  detail?: Record<string, unknown>,
): Promise<void> {
  const { ip, ua } = await readForensics();
  await withAdmin("system", "actions/account:log", async (admin) => {
    const { error } = await admin.from("account_action_log").insert({
      user_id: userId,
      applicant_id: applicantId,
      action,
      ip,
      ua,
      outcome,
      detail: detail ?? null,
    });
    if (error) {
      console.error("account_action_log insert failed", error);
    }
  });
}

interface ExportTable {
  table: string;
  filterCol: string;
}

const APPLICANT_TABLES: ExportTable[] = [
  { table: "applicant_profiles", filterCol: "id" },
  { table: "applications", filterCol: "applicant_id" },
  { table: "user_packages", filterCol: "auth_user_id" },
  { table: "consent_event", filterCol: "applicant_id" },
  { table: "secret_access_log", filterCol: "applicant_id" },
  { table: "pii_access_log", filterCol: "applicant_id" },
  { table: "account_action_log", filterCol: "applicant_id" },
];

const APPLICATION_TABLES: ExportTable[] = [
  { table: "visa_application_answers", filterCol: "application_id" },
  { table: "application_documents", filterCol: "application_id" },
  { table: "submission_queue", filterCol: "application_id" },
];

interface ExportResult {
  zip: Buffer;
  filename: string;
}

export async function exportAccountData(): Promise<ExportResult> {
  const { user } = await requireSession();

  try {
    await rateLimitOrThrow(user.id, "export", EXPORT_RATE_WINDOW_S);
  } catch (err) {
    if (err instanceof AccountRateLimitError) {
      await logAccountAction(user.id, null, "export", "rejected", {
        reason: "rate_limit",
      });
    }
    throw err;
  }

  return withAdmin("system", "actions/account:export", async (admin) => {
    const { data: profile, error: profErr } = await admin
      .from("applicant_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (profErr) throw new Error(`profile fetch: ${profErr.message}`);

    const applicantId = profile?.id ?? null;
    const entries: ZipEntry[] = [];

    const manifest: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      auth_user_id: user.id,
      applicant_id: applicantId,
      email: user.email ?? null,
      tables: {} as Record<string, number>,
      uploaded_files: [] as Array<{ path: string; sizeBytes: number }>,
    };

    if (!applicantId) {
      entries.push({ name: "manifest.json", data: JSON.stringify(manifest, null, 2) });
      const zip = buildZip(entries);
      const filename = `viza-export-${user.id}-${Date.now()}.zip`;
      await logAccountAction(user.id, null, "export", "ok", {
        bytes: zip.length,
        applicant: null,
      });
      return { zip, filename };
    }

    // Applicant-scoped tables
    for (const t of APPLICANT_TABLES) {
      const filterValue = t.filterCol === "auth_user_id" ? user.id : applicantId;
      const { data, error } = await admin
        .from(t.table)
        .select("*")
        .eq(t.filterCol, filterValue);
      if (error) {
        // Soft-fail: include an error row in the manifest rather than
        // aborting the entire export.
        entries.push({
          name: `data/${t.table}.error.json`,
          data: JSON.stringify({ error: error.message }, null, 2),
        });
        continue;
      }
      const rows = data ?? [];
      manifest.tables = {
        ...(manifest.tables as Record<string, number>),
        [t.table]: rows.length,
      };
      entries.push({
        name: `data/${t.table}.json`,
        data: JSON.stringify(rows, null, 2),
      });
    }

    // Application-scoped tables
    const { data: apps } = await admin
      .from("applications")
      .select("id")
      .eq("applicant_id", applicantId);
    const appIds = (apps ?? []).map((a: { id: string }) => a.id);
    if (appIds.length > 0) {
      for (const t of APPLICATION_TABLES) {
        const { data, error } = await admin
          .from(t.table)
          .select("*")
          .in("application_id", appIds);
        if (error) {
          entries.push({
            name: `data/${t.table}.error.json`,
            data: JSON.stringify({ error: error.message }, null, 2),
          });
          continue;
        }
        const rows = data ?? [];
        manifest.tables = {
          ...(manifest.tables as Record<string, number>),
          [t.table]: rows.length,
        };
        entries.push({
          name: `data/${t.table}.json`,
          data: JSON.stringify(rows, null, 2),
        });
      }
    }

    // Uploaded files from the submission-artifacts bucket.
    const { data: docs } = await admin
      .from("application_documents")
      .select("storage_path")
      .in("application_id", appIds);
    if (docs && docs.length > 0) {
      for (const doc of docs as Array<{ storage_path: string | null }>) {
        if (!doc.storage_path) continue;
        const { data: blob, error: blobErr } = await admin.storage
          .from("submission-artifacts")
          .download(doc.storage_path);
        if (blobErr || !blob) {
          entries.push({
            name: `files/${doc.storage_path}.error.txt`,
            data: blobErr?.message ?? "unknown error",
          });
          continue;
        }
        const arr = new Uint8Array(await blob.arrayBuffer());
        entries.push({ name: `files/${doc.storage_path}`, data: arr });
        (manifest.uploaded_files as Array<{ path: string; sizeBytes: number }>).push({
          path: doc.storage_path,
          sizeBytes: arr.byteLength,
        });
      }
    }

    entries.unshift({
      name: "manifest.json",
      data: JSON.stringify(manifest, null, 2),
    });

    const zip = buildZip(entries);
    const filename = `viza-export-${applicantId}-${Date.now()}.zip`;
    await logAccountAction(user.id, applicantId, "export", "ok", {
      bytes: zip.length,
      tables: manifest.tables,
      file_count: (manifest.uploaded_files as unknown[]).length,
    });
    return { zip, filename };
  });
}

export interface DeletionStatus {
  requestedAt: string | null;
  scheduledAt: string | null;
  deletedAt: string | null;
}

export async function requestAccountDeletion(): Promise<DeletionStatus> {
  const { user } = await requireSession();
  try {
    await rateLimitOrThrow(user.id, "delete_request", DELETE_REQUEST_RATE_WINDOW_S);
  } catch (err) {
    if (err instanceof AccountRateLimitError) {
      await logAccountAction(user.id, null, "delete_request", "rejected", {
        reason: "rate_limit",
      });
    }
    throw err;
  }

  return withAdmin("system", "actions/account:requestDeletion", async (admin) => {
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id, deletion_requested_at, deletion_scheduled_at, deleted_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const applicantId = profile?.id ?? null;
    if (!applicantId) {
      throw new Error("No applicant profile to delete");
    }
    const now = new Date();
    const scheduledAt = new Date(
      now.getTime() + DELETION_GRACE_DAYS * 24 * 3600 * 1000,
    );
    const requestedAt = profile?.deletion_requested_at ?? now.toISOString();
    const { error } = await admin
      .from("applicant_profiles")
      .update({
        deletion_requested_at: requestedAt,
        deletion_scheduled_at: scheduledAt.toISOString(),
      })
      .eq("id", applicantId);
    if (error) throw new Error(`requestAccountDeletion: ${error.message}`);
    await logAccountAction(user.id, applicantId, "delete_request", "ok", {
      grace_days: DELETION_GRACE_DAYS,
    });
    return {
      requestedAt: requestedAt,
      scheduledAt: scheduledAt.toISOString(),
      deletedAt: profile?.deleted_at ?? null,
    };
  });
}

export async function revokeAccountDeletion(): Promise<DeletionStatus> {
  const { user } = await requireSession();
  return withAdmin("system", "actions/account:revokeDeletion", async (admin) => {
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id, deletion_requested_at, deletion_scheduled_at, deleted_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const applicantId = profile?.id ?? null;
    if (!applicantId) {
      throw new Error("No applicant profile");
    }
    if (profile?.deleted_at) {
      throw new Error("Account already deleted");
    }
    const { error } = await admin
      .from("applicant_profiles")
      .update({ deletion_requested_at: null, deletion_scheduled_at: null })
      .eq("id", applicantId);
    if (error) throw new Error(`revokeAccountDeletion: ${error.message}`);
    await logAccountAction(user.id, applicantId, "delete_revoke", "ok");
    return { requestedAt: null, scheduledAt: null, deletedAt: null };
  });
}
