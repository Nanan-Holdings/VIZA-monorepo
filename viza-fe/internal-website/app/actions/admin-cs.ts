"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TicketTab = "open" | "mine" | "unassigned" | "breaching";

export interface AdminTicketRow {
  id: string;
  subject: string;
  status: string;
  applicant_id: string;
  application_id: string | null;
  assigned_to: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}

async function assertStaff(): Promise<{ userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (row?.role !== "admin" && row?.role !== "staff") return { error: "Staff role required" };
  return { userId: user.id };
}

export async function listAdminTickets(
  tab: TicketTab,
): Promise<{ rows?: AdminTicketRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };
  const adminClient = createAdminClient();
  let query = adminClient
    .from("support_ticket")
    .select(
      "id, subject, status, applicant_id, application_id, assigned_to, first_response_at, sla_due_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (tab === "open") query = query.neq("status", "closed");
  else if (tab === "mine") query = query.eq("assigned_to", guard.userId).neq("status", "closed");
  else if (tab === "unassigned") query = query.is("assigned_to", null).neq("status", "closed");
  else if (tab === "breaching") {
    query = query.is("first_response_at", null).lt("sla_due_at", new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { rows: (data ?? []) as AdminTicketRow[] };
}

export async function assignTicket(input: {
  ticketId: string;
  assignToUserId: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("support_ticket")
    .update({ assigned_to: input.assignToUserId, updated_at: new Date().toISOString() })
    .eq("id", input.ticketId);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function markFirstResponse(ticketId: string): Promise<void> {
  const guard = await assertStaff();
  if (!guard.userId) return;
  const adminClient = createAdminClient();
  await adminClient
    .from("support_ticket")
    .update({ first_response_at: new Date().toISOString() })
    .eq("id", ticketId)
    .is("first_response_at", null);
}

// ---------------------------- macros ----------------------------

export interface SupportMacroRow {
  id: string;
  country: string;
  title: string;
  body: string;
  locale: string;
  is_active: boolean;
}

export async function listMacros(country: string): Promise<{ rows?: SupportMacroRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("support_macro")
    .select("id, country, title, body, locale, is_active")
    .eq("is_active", true)
    .or(`country.eq.${country.toUpperCase()},country.eq.ANY`)
    .order("title");
  if (error) return { error: error.message };
  return { rows: (data ?? []) as SupportMacroRow[] };
}

export async function saveMacro(input: {
  id?: string;
  country: string;
  title: string;
  body: string;
  locale: string;
}): Promise<{ ok: boolean; macroId?: string; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  if (input.title.trim().length < 3 || input.body.trim().length < 5) {
    return { ok: false, reason: "title ≥3, body ≥5 chars" };
  }
  const adminClient = createAdminClient();
  if (input.id) {
    const { error } = await adminClient
      .from("support_macro")
      .update({
        country: input.country.toUpperCase(),
        title: input.title.trim(),
        body: input.body.trim(),
        locale: input.locale,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true, macroId: input.id };
  }
  const { data, error } = await adminClient
    .from("support_macro")
    .insert({
      country: input.country.toUpperCase(),
      title: input.title.trim(),
      body: input.body.trim(),
      locale: input.locale,
      created_by: guard.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: error?.message ?? "insert failed" };
  return { ok: true, macroId: data.id as string };
}

// ---------------------------- internal notes ----------------------------

export interface InternalNoteRow {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export async function listInternalNotes(ticketId: string): Promise<{ rows?: InternalNoteRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("support_internal_note")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as InternalNoteRow[] };
}

export async function postInternalNote(input: {
  ticketId: string;
  body: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  if (!input.body.trim()) return { ok: false, reason: "empty" };
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("support_internal_note").insert({
    ticket_id: input.ticketId,
    author_id: guard.userId,
    body: input.body.trim(),
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

// ---------------------------- KPIs ----------------------------

export interface KpiSnapshot {
  windowDays: number;
  totalTickets: number;
  firstResponseMedianMinutes: number | null;
  resolutionRate: number;
  slaBreachCount: number;
  weekOverWeekDelta: number;
}

export async function loadKpis(windowDays: number = 7): Promise<{ snapshot?: KpiSnapshot; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };
  const adminClient = createAdminClient();
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const prevCutoff = new Date(Date.now() - 2 * windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: current } = await adminClient
    .from("support_ticket")
    .select("status, created_at, first_response_at, sla_due_at")
    .gte("created_at", cutoff);
  const { data: previous } = await adminClient
    .from("support_ticket")
    .select("id")
    .gte("created_at", prevCutoff)
    .lt("created_at", cutoff);

  const rows = (current ?? []) as Array<{
    status: string;
    created_at: string;
    first_response_at: string | null;
    sla_due_at: string | null;
  }>;
  const responseTimes = rows
    .filter((r) => r.first_response_at)
    .map((r) => (Date.parse(r.first_response_at!) - Date.parse(r.created_at)) / 60_000);
  responseTimes.sort((a, b) => a - b);
  const median =
    responseTimes.length === 0
      ? null
      : responseTimes[Math.floor(responseTimes.length / 2)];
  const resolved = rows.filter((r) => r.status === "closed").length;
  const slaBreach = rows.filter((r) => !r.first_response_at && r.sla_due_at && Date.parse(r.sla_due_at) < Date.now()).length;
  const wow = previous && previous.length > 0 ? (rows.length - previous.length) / previous.length : 0;

  return {
    snapshot: {
      windowDays,
      totalTickets: rows.length,
      firstResponseMedianMinutes: median !== null ? Math.round(median) : null,
      resolutionRate: rows.length === 0 ? 0 : resolved / rows.length,
      slaBreachCount: slaBreach,
      weekOverWeekDelta: wow,
    },
  };
}
