import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketTab } from "./admin-cs";
import type { SupportMessageRow, SupportTicketRow } from "./support";

const SUPPORT_BUCKET = "support-tickets";
const TABLE_MISSING_CODE = "PGRST205";
let bucketReady = false;

export interface StoredSupportTicket extends SupportTicketRow {
  assigned_to: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  messages: SupportMessageRow[];
}

interface CreateStoredTicketInput {
  applicantId: string;
  applicationId?: string | null;
  subject: string;
  body: string;
}

interface PostStoredMessageInput {
  ticketId: string;
  authorKind: "applicant" | "staff";
  authorId: string | null;
  body: string;
}

function ticketPath(ticketId: string) {
  return `${ticketId}.json`;
}

function nowIso() {
  return new Date().toISOString();
}

function rowFromTicket(ticket: StoredSupportTicket): SupportTicketRow {
  return {
    id: ticket.id,
    applicant_id: ticket.applicant_id,
    application_id: ticket.application_id,
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    priority: ticket.priority,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}

function isOpenStatus(status: string) {
  return status !== "resolved" && status !== "closed";
}

function matchesTab(ticket: StoredSupportTicket, tab: TicketTab, staffUserId: string) {
  if (tab === "open") return isOpenStatus(ticket.status);
  if (tab === "p2") return ticket.priority === "p2" && isOpenStatus(ticket.status);
  if (tab === "mine") return ticket.assigned_to === staffUserId && isOpenStatus(ticket.status);
  if (tab === "unassigned") return !ticket.assigned_to && isOpenStatus(ticket.status);
  return !ticket.first_response_at && ticket.sla_due_at !== null && Date.parse(ticket.sla_due_at) < Date.now();
}

async function ensureSupportBucket() {
  if (bucketReady) return;
  const adminClient = createAdminClient();
  const { data: buckets, error: listError } = await adminClient.storage.listBuckets();
  if (listError) throw new Error(listError.message);
  if (!buckets.some((bucket) => bucket.name === SUPPORT_BUCKET)) {
    const { error } = await adminClient.storage.createBucket(SUPPORT_BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
      allowedMimeTypes: ["application/json"],
    });
    if (error) throw new Error(error.message);
  }
  bucketReady = true;
}

async function saveTicket(ticket: StoredSupportTicket) {
  await ensureSupportBucket();
  const adminClient = createAdminClient();
  const { error } = await adminClient.storage
    .from(SUPPORT_BUCKET)
    .upload(ticketPath(ticket.id), Buffer.from(JSON.stringify(ticket, null, 2)), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export function isSupportTableMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === TABLE_MISSING_CODE ||
        error.message?.includes("Could not find the table 'public.support_ticket'") ||
        error.message?.includes("Could not find the table 'public.support_message'")),
  );
}

export async function createStoredSupportTicket(
  input: CreateStoredTicketInput,
): Promise<{ ticketId?: string; error?: string }> {
  const createdAt = nowIso();
  const ticket: StoredSupportTicket = {
    id: randomUUID(),
    applicant_id: input.applicantId,
    application_id: input.applicationId ?? null,
    subject: input.subject,
    body: input.body,
    status: "unresolved",
    priority: "p2",
    assigned_to: null,
    first_response_at: null,
    sla_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: createdAt,
    updated_at: createdAt,
    messages: [],
  };

  try {
    await saveTicket(ticket);
    return { ticketId: ticket.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Storage ticket write failed" };
  }
}

export async function readStoredSupportTicket(ticketId: string): Promise<StoredSupportTicket | null> {
  await ensureSupportBucket();
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage.from(SUPPORT_BUCKET).download(ticketPath(ticketId));
  if (error || !data) return null;
  return JSON.parse(await data.text()) as StoredSupportTicket;
}

export async function listStoredSupportTickets(): Promise<StoredSupportTicket[]> {
  await ensureSupportBucket();
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage.from(SUPPORT_BUCKET).list("", {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return [];

  const tickets = await Promise.all(
    data
      .filter((item) => item.name.endsWith(".json"))
      .map(async (item) => readStoredSupportTicket(item.name.replace(/\.json$/, ""))),
  );
  return tickets
    .filter((ticket): ticket is StoredSupportTicket => ticket !== null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function listStoredTicketsByApplicant(applicantId: string): Promise<SupportTicketRow[]> {
  const tickets = await listStoredSupportTickets();
  return tickets.filter((ticket) => ticket.applicant_id === applicantId).map(rowFromTicket);
}

export async function listStoredTicketsForTab(
  tab: TicketTab,
  staffUserId: string,
): Promise<
  Array<
    SupportTicketRow & {
      assigned_to: string | null;
      first_response_at: string | null;
      sla_due_at: string | null;
    }
  >
> {
  const tickets = await listStoredSupportTickets();
  return tickets.filter((ticket) => matchesTab(ticket, tab, staffUserId)).map((ticket) => ({
    ...rowFromTicket(ticket),
    assigned_to: ticket.assigned_to,
    first_response_at: ticket.first_response_at,
    sla_due_at: ticket.sla_due_at,
  }));
}

export async function listStoredTicketMessages(ticketId: string): Promise<SupportMessageRow[]> {
  const ticket = await readStoredSupportTicket(ticketId);
  return ticket?.messages ?? [];
}

export async function postStoredTicketMessage(
  input: PostStoredMessageInput,
): Promise<{ message?: SupportMessageRow; error?: string }> {
  const ticket = await readStoredSupportTicket(input.ticketId);
  if (!ticket) return { error: "Ticket not found" };

  const createdAt = nowIso();
  const message: SupportMessageRow = {
    id: randomUUID(),
    ticket_id: input.ticketId,
    author_kind: input.authorKind,
    author_id: input.authorId,
    body: input.body,
    created_at: createdAt,
  };

  ticket.messages.push(message);
  ticket.updated_at = createdAt;
  if (input.authorKind === "staff") {
    ticket.assigned_to = input.authorId;
    ticket.first_response_at = ticket.first_response_at ?? createdAt;
    ticket.status = "in_progress";
  } else {
    ticket.status = "unresolved";
  }

  try {
    await saveTicket(ticket);
    return { message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Storage message write failed" };
  }
}

export async function resolveStoredSupportTicket(ticketId: string): Promise<{ ok: boolean; reason?: string }> {
  const ticket = await readStoredSupportTicket(ticketId);
  if (!ticket) return { ok: false, reason: "Ticket not found" };
  ticket.status = "resolved";
  ticket.updated_at = nowIso();
  try {
    await saveTicket(ticket);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Storage ticket update failed" };
  }
}
