"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActorKind = "applicant" | "staff" | "system";

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
  const { data, error } = await adminClient
    .from("application_status_history")
    .select("from_status, to_status, actor_kind, reason, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) return { entries: [], error: error.message };
  return { entries: data ?? [] };
}
