"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface DlqRow {
  id: string;
  source_event_id: number | null;
  applicant_id: string | null;
  application_id: string | null;
  template_key: string;
  channel: string;
  recipient: string | null;
  error: string;
  retry_count: number;
  created_at: string;
  replayed_at: string | null;
}

async function assertStaff(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const role = row?.role as string | undefined;
  if (role !== "admin" && role !== "staff") return { ok: false, reason: "Staff role required" };
  return { ok: true };
}

export async function listDlq(): Promise<{ rows?: DlqRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.ok) return { error: guard.reason };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("notification_dlq")
    .select(
      "id, source_event_id, applicant_id, application_id, template_key, channel, recipient, error, retry_count, created_at, replayed_at",
    )
    .is("replayed_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { error: error.message };
  return { rows: (data ?? []) as DlqRow[] };
}

export async function replayDlqRow(dlqId: string): Promise<{ ok: boolean; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.ok) return { ok: false, reason: guard.reason };
  const adminClient = createAdminClient();
  const { data: row, error: fetchErr } = await adminClient
    .from("notification_dlq")
    .select("applicant_id, application_id, template_key, channel, recipient, payload")
    .eq("id", dlqId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, reason: fetchErr?.message ?? "DLQ row not found" };

  const { error: insErr } = await adminClient.from("notification_event_log").insert({
    applicant_id: row.applicant_id,
    application_id: row.application_id,
    event: row.template_key,
    template_key: row.template_key,
    channel: row.channel,
    recipient: row.recipient,
    payload: row.payload,
    outcome: "queued",
    retry_count: 0,
    next_attempt_at: new Date().toISOString(),
  });
  if (insErr) return { ok: false, reason: insErr.message };

  await adminClient
    .from("notification_dlq")
    .update({ replayed_at: new Date().toISOString() })
    .eq("id", dlqId);

  return { ok: true };
}
