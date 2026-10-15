"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/rbac";

export type ActorKind = "applicant" | "staff" | "system";

/**
 * Authorize an actor for a given application. Staff/admin (present in the
 * `users` table with a live, revocation-aware session via `getCurrentUser`)
 * may act on any application; an applicant may only act on an application
 * whose `applicant_id` maps to their own profile. Prevents an authenticated
 * IDOR where any signed-in user could read/mutate arbitrary applications.
 */
async function isAuthorizedForApplication(
  authUserId: string,
  applicantId: string | null,
): Promise<boolean> {
  const staff = await getCurrentUser();
  if (staff) return true;
  if (!applicantId) return false;
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return Boolean(profile && profile.id === applicantId);
}

export interface UpdateStatusArgs {
  applicationId: string;
  newStatus: string;
  actorKind?: ActorKind;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface StatusUpdateResult {
  ok: boolean;
  fromStatus?: string | null;
  toStatus?: string;
  reason?: string;
}

/**
 * Single transactional path for changing applications.status.
 * Writes both the row update AND the history entry; every callsite that
 * mutates status should route through here so the timeline stays the
 * source of truth.
 */
export async function updateApplicationStatus(args: UpdateStatusArgs): Promise<StatusUpdateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app, error: fetchErr } = await adminClient
    .from("applications")
    .select("id, status, applicant_id")
    .eq("id", args.applicationId)
    .maybeSingle();
  if (fetchErr || !app) return { ok: false, reason: fetchErr?.message ?? "Application not found" };

  if (!(await isAuthorizedForApplication(user.id, app.applicant_id as string | null))) {
    return { ok: false, reason: "Unauthorized" };
  }

  const fromStatus = app.status as string | null;
  if (fromStatus === args.newStatus) {
    return { ok: true, fromStatus, toStatus: args.newStatus };
  }

  const { error: updErr } = await adminClient
    .from("applications")
    .update({ status: args.newStatus, updated_at: new Date().toISOString() })
    .eq("id", args.applicationId);
  if (updErr) return { ok: false, reason: updErr.message };

  const { error: histErr } = await adminClient.from("application_status_history").insert({
    application_id: args.applicationId,
    from_status: fromStatus,
    to_status: args.newStatus,
    actor_id: user.id,
    actor_kind: args.actorKind ?? "system",
    reason: args.reason ?? null,
    metadata: args.metadata ?? null,
  });
  if (histErr) return { ok: false, reason: histErr.message };

  return { ok: true, fromStatus, toStatus: args.newStatus };
}

export async function loadStatusTimeline(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { entries: [] as Array<{ to_status: string; created_at: string; reason: string | null }>, error: "Not authenticated" };
  const adminClient = createAdminClient();

  const { data: app } = await adminClient
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { entries: [], error: "Application not found" };
  if (!(await isAuthorizedForApplication(user.id, app.applicant_id as string | null))) {
    return { entries: [], error: "Unauthorized" };
  }

  const { data, error } = await adminClient
    .from("application_status_history")
    .select("from_status, to_status, actor_kind, reason, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) return { entries: [], error: error.message };
  return { entries: data ?? [] };
}
