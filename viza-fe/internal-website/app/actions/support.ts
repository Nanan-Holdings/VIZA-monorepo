"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SupportTicketRow {
  id: string;
  applicant_id: string;
  application_id: string | null;
  subject: string;
  body: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessageRow {
  id: string;
  ticket_id: string;
  author_kind: "applicant" | "staff";
  author_id: string | null;
  body: string;
  created_at: string;
}

async function getApplicantProfileId(): Promise<{ id?: string; userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) return { error: "No applicant profile" };
  return { id: profile.id as string, userId: user.id };
}

async function isStaff(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("users")
    .select("role")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.role === "staff" || data?.role === "admin";
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
  applicationId?: string;
}): Promise<{ ticketId?: string; error?: string }> {
  if (input.subject.trim().length < 3) return { error: "Subject required" };
  if (input.body.trim().length < 10) return { error: "Body must be ≥10 characters" };

  const me = await getApplicantProfileId();
  if (!me.id) return { error: me.error };

  const adminClient = createAdminClient();
  const { data: row, error } = await adminClient
    .from("support_ticket")
    .insert({
      applicant_id: me.id,
      application_id: input.applicationId ?? null,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: "unresolved",
      priority: "p2",
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  // Acknowledgement notification — queued for the NOTIFY-001 worker.
  await adminClient.from("notification_event_log").insert({
    applicant_id: me.id,
    application_id: input.applicationId ?? null,
    event: "ticket_received",
    template_key: "ticket_received",
    channel: "email",
    outcome: "queued",
    payload: { subject: input.subject, ticket_id: row.id },
  });

  revalidatePath("/client/support/requests");
  revalidatePath("/admin/support");
  revalidatePath("/admin/cs");

  return { ticketId: row.id as string };
}

export async function listMyTickets(): Promise<{ rows?: SupportTicketRow[]; error?: string }> {
  const me = await getApplicantProfileId();
  if (!me.id) return { error: me.error };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("support_ticket")
    .select("*")
    .eq("applicant_id", me.id)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { rows: (data ?? []) as SupportTicketRow[] };
}

export async function loadTicketThread(
  ticketId: string,
): Promise<{ ticket?: SupportTicketRow; messages?: SupportMessageRow[]; error?: string }> {
  const me = await getApplicantProfileId();
  if (!me.id) return { error: me.error };
  const adminClient = createAdminClient();
  const { data: ticket, error: ticketErr } = await adminClient
    .from("support_ticket")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr || !ticket) return { error: ticketErr?.message ?? "Not found" };
  const staff = me.userId ? await isStaff(me.userId) : false;
  if (!staff && ticket.applicant_id !== me.id) return { error: "Unauthorized" };

  const { data: messages, error: msgErr } = await adminClient
    .from("support_message")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (msgErr) return { error: msgErr.message };
  return { ticket: ticket as SupportTicketRow, messages: (messages ?? []) as SupportMessageRow[] };
}

export async function postTicketMessage(input: {
  ticketId: string;
  body: string;
}): Promise<{ messageId?: string; error?: string }> {
  if (input.body.trim().length === 0) return { error: "Empty message" };
  const me = await getApplicantProfileId();
  if (!me.id || !me.userId) return { error: me.error };
  const staff = await isStaff(me.userId);

  const adminClient = createAdminClient();
  const { data: ticket } = await adminClient
    .from("support_ticket")
    .select("applicant_id")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!ticket) return { error: "Ticket not found" };
  if (!staff && ticket.applicant_id !== me.id) return { error: "Unauthorized" };

  const { data: row, error } = await adminClient
    .from("support_message")
    .insert({
      ticket_id: input.ticketId,
      author_kind: staff ? "staff" : "applicant",
      author_id: me.userId,
      body: input.body.trim(),
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  await adminClient
    .from("support_ticket")
    .update({ updated_at: new Date().toISOString(), status: staff ? "in_progress" : "unresolved" })
    .eq("id", input.ticketId);

  return { messageId: row.id as string };
}
