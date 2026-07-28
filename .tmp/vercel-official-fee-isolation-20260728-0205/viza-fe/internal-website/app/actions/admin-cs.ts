"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isSupportTableMissing,
  listStoredTicketMessages,
  listStoredTicketsForTab,
  postStoredTicketMessage,
  resolveStoredSupportTicket,
} from "./support-storage";

export type TicketTab = "open" | "p2" | "mine" | "unassigned" | "breaching";

export interface AdminTicketRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  applicant_id: string;
  application_id: string | null;
  assigned_to: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSupportTicketRow extends AdminTicketRow {
  applicantName: string;
  applicantEmail: string | null;
  applicationLabel: string;
}

export interface AdminSupportMessageRow {
  id: string;
  ticket_id: string;
  author_kind: "applicant" | "staff";
  author_id: string | null;
  body: string;
  created_at: string;
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
      "id, subject, body, status, priority, applicant_id, application_id, assigned_to, first_response_at, sla_due_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (tab === "open") query = query.neq("status", "resolved").neq("status", "closed");
  else if (tab === "p2") {
    query = query.eq("priority", "p2").neq("status", "resolved").neq("status", "closed");
  } else if (tab === "mine") {
    query = query.eq("assigned_to", guard.userId).neq("status", "resolved").neq("status", "closed");
  } else if (tab === "unassigned") {
    query = query.is("assigned_to", null).neq("status", "resolved").neq("status", "closed");
  }
  else if (tab === "breaching") {
    query = query.is("first_response_at", null).lt("sla_due_at", new Date().toISOString());
  }

  const { data, error } = await query;
  if (isSupportTableMissing(error)) {
    return { rows: (await listStoredTicketsForTab(tab, guard.userId)) as AdminTicketRow[] };
  }
  if (error) return { error: error.message };
  return { rows: (data ?? []) as AdminTicketRow[] };
}

export async function listAdminSupportInbox(
  tab: TicketTab,
): Promise<{ rows?: AdminSupportTicketRow[]; error?: string }> {
  const result = await listAdminTickets(tab);
  if (result.error || !result.rows) return { error: result.error };

  const rows = result.rows;
  const adminClient = createAdminClient();
  const applicantIds = [...new Set(rows.map((row) => row.applicant_id).filter(Boolean))];
  const applicationIds = [...new Set(rows.map((row) => row.application_id).filter(Boolean))] as string[];

  const profilesById = new Map<string, { full_name: string | null; email: string | null }>();
  if (applicantIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("applicant_profiles")
      .select("id, full_name, email")
      .in("id", applicantIds);
    for (const profile of profiles ?? []) {
      profilesById.set(profile.id as string, {
        full_name: (profile.full_name as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      });
    }
  }

  const applicationsById = new Map<string, { country: string | null; visa_type: string | null }>();
  if (applicationIds.length > 0) {
    const { data: applications } = await adminClient
      .from("applications")
      .select("id, country, visa_type")
      .in("id", applicationIds);
    for (const application of applications ?? []) {
      applicationsById.set(application.id as string, {
        country: (application.country as string | null) ?? null,
        visa_type: (application.visa_type as string | null) ?? null,
      });
    }
  }

  return {
    rows: rows.map((row) => {
      const profile = profilesById.get(row.applicant_id);
      const application = row.application_id ? applicationsById.get(row.application_id) : null;
      const applicationLabel =
        application?.country || application?.visa_type
          ? [application.country, application.visa_type].filter(Boolean).join(" · ")
          : "General support";

      return {
        ...row,
        applicantName: profile?.full_name || profile?.email || "Unnamed applicant",
        applicantEmail: profile?.email ?? null,
        applicationLabel,
      };
    }),
  };
}

export async function listAdminTicketMessages(
  ticketId: string,
): Promise<{ rows?: AdminSupportMessageRow[]; error?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { error: guard.error };

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("support_message")
    .select("id, ticket_id, author_kind, author_id, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (isSupportTableMissing(error)) {
    return { rows: (await listStoredTicketMessages(ticketId)) as AdminSupportMessageRow[] };
  }
  if (error) return { error: error.message };
  return { rows: (data ?? []) as AdminSupportMessageRow[] };
}

export async function postAdminTicketReply(input: {
  ticketId: string;
  body: string;
}): Promise<{ ok: boolean; message?: AdminSupportMessageRow; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Reply is empty" };

  const adminClient = createAdminClient();
  const { data: message, error } = await adminClient
    .from("support_message")
    .insert({
      ticket_id: input.ticketId,
      author_kind: "staff",
      author_id: guard.userId,
      body,
    })
    .select("id, ticket_id, author_kind, author_id, body, created_at")
    .single();

  if (isSupportTableMissing(error)) {
    const result = await postStoredTicketMessage({
      ticketId: input.ticketId,
      authorKind: "staff",
      authorId: guard.userId,
      body,
    });
    return result.message
      ? { ok: true, message: result.message as AdminSupportMessageRow }
      : { ok: false, reason: result.error };
  }
  if (error || !message) return { ok: false, reason: error?.message ?? "Reply failed" };

  await adminClient
    .from("support_ticket")
    .update({
      assigned_to: guard.userId,
      first_response_at: new Date().toISOString(),
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticketId)
    .is("first_response_at", null);

  await adminClient
    .from("support_ticket")
    .update({
      assigned_to: guard.userId,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticketId);

  return { ok: true, message: message as AdminSupportMessageRow };
}

export async function closeAdminTicket(ticketId: string): Promise<{ ok: boolean; reason?: string }> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("support_ticket")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (isSupportTableMissing(error)) return resolveStoredSupportTicket(ticketId);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
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
  const resolved = rows.filter((r) => r.status === "resolved" || r.status === "closed").length;
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
