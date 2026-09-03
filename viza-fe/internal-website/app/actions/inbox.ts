"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
import {
  generateInboxAiMeta,
  isInboxAiConfigured,
  type InboxAiMeta,
} from "@/lib/inbox/ai-summary";
import {
  buildAttachmentsMeta,
  extractAttachmentPart,
  isAttachmentsMeta,
  type InboxAttachmentInfo,
  type InboxAttachmentPart,
} from "@/lib/inbox/attachments";
import {
  categorizeInboundEmail,
  isInboxCategory,
  type InboxCategory,
} from "@/lib/inbox/categorize";
import {
  bestPlainText,
  chunkParagraphs,
  emailParagraphs,
  emailSnippet,
} from "@/lib/inbox/email-text";
import { presignR2Get } from "@/lib/inbox/r2-presign";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";
import { translateManyWithGoogleV2 } from "@/lib/translation/google-translate-v2";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InboxRow {
  id: string;
  to_addr: string;
  from_addr: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  r2_key: string | null;
  raw_size: number;
  spam_score: number | null;
  received_at: string;
  processed: boolean;
}

async function withAuthorizedInbox<T>(
  actor: string,
  action: (
    admin: SupabaseClient,
    alias: string,
    applicantId: string,
  ) => Promise<T>,
): Promise<T | null> {
  const session = await getClientSessionWithFallback();
  if (!session) {
    throw new Error("Authentication required");
  }

  return withAdmin("system", actor, async (admin) => {
    const profileColumns = "id, inbox_alias, inbox_alias_retired_at";
    const { data: profileById, error: profileByIdError } = await admin
      .from("applicant_profiles")
      .select(profileColumns)
      .eq("id", session.userId)
      .maybeSingle();
    if (profileByIdError) {
      throw new Error("Applicant inbox profile lookup failed");
    }

    let profile = profileById;
    if (!profile) {
      const legacyAuthUserId = session.authUserId ?? session.userId;
      const { data: profileByAuthUserId, error: profileByAuthUserIdError } =
        await admin
          .from("applicant_profiles")
          .select(profileColumns)
          .eq("auth_user_id", legacyAuthUserId)
          .maybeSingle();
      if (profileByAuthUserIdError) {
        throw new Error("Applicant inbox profile lookup failed");
      }
      profile = profileByAuthUserId;
    }

    if (!profile?.inbox_alias || profile.inbox_alias_retired_at) {
      return null;
    }
    return action(
      admin,
      String(profile.inbox_alias).trim().toLowerCase(),
      String(profile.id),
    );
  });
}

/**
 * Inbox listing for the signed-in applicant. Authentication supports both
 * Supabase Auth and the signed legacy VIZA session. The server resolves the
 * exact active inbox alias before using service-role access, so ownership does
 * not depend on an anonymous Data API table grant.
 */
export async function listClientInbox(limit = 100): Promise<InboxRow[]> {
  return (
    (await withAuthorizedInbox(
      "actions/inbox:listClient",
      async (admin, alias) => {
        const { data, error } = await admin
          .from("inbound_email")
          .select(
            "id, to_addr, from_addr, subject, text, html, r2_key, raw_size, spam_score, received_at, processed",
          )
          .eq("to_addr", alias)
          .eq("quarantined", false)
          .order("received_at", { ascending: false })
          .limit(limit);
        if (error) {
          throw new Error(`listClientInbox failed: ${error.message}`);
        }
        return (data ?? []) as InboxRow[];
      },
    )) ?? []
  );
}

/** Staff variant — reads through service role for the named applicant. */
export async function listApplicantInboxAsStaff(
  applicantId: string,
  limit = 200,
): Promise<InboxRow[]> {
  return withAdmin("admin", "actions/inbox:listAsStaff", async (admin) => {
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("inbox_alias")
      .eq("id", applicantId)
      .maybeSingle();
    if (!profile?.inbox_alias) return [];
    const { data, error } = await admin
      .from("inbound_email")
      .select(
        "id, to_addr, from_addr, subject, text, html, r2_key, raw_size, spam_score, received_at, processed",
      )
      .eq("to_addr", profile.inbox_alias.toLowerCase())
      .order("received_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(`listApplicantInboxAsStaff failed: ${error.message}`);
    }
    return (data ?? []) as InboxRow[];
  });
}

/**
 * Returns a 5-minute presigned R2 GET URL for the raw .eml stored under
 * `r2_key`. Throws when the row has no R2 key (body was inlined and
 * there is no separate attachment). The caller (client or staff page)
 * is responsible for presenting the URL as a download link.
 */
export async function getInboundEmailDownloadUrl(
  messageId: string,
): Promise<{ url: string; expiresIn: number }> {
  const data = await withAuthorizedInbox(
    "actions/inbox:download",
    async (admin, alias) => {
      const { data: message, error } = await admin
        .from("inbound_email")
        .select("id, r2_key")
        .eq("id", messageId)
        .eq("to_addr", alias)
        .eq("quarantined", false)
        .maybeSingle();
      if (error) throw new Error(`download lookup failed: ${error.message}`);
      return message;
    },
  );
  if (!data) {
    throw new Error("Message not found or not visible to caller");
  }
  if (!data.r2_key) {
    throw new Error("Message has no R2-stored body (inline only)");
  }
  const expiresIn = 300;
  return { url: presignR2Get({ key: data.r2_key, expiresIn }), expiresIn };
}

/* -------------------------------------------------------------------------
 * Client mailbox (/client/settings/inbox)
 *
 * Everything below follows the same trust model as the reads above: the
 * caller's session resolves to the active inbox alias first, and every row
 * touch re-filters on `to_addr = alias AND quarantined = false`, so
 * service-role access never widens beyond the caller's own mailbox.
 * ---------------------------------------------------------------------- */

const INBOX_SUPPORTED_LOCALES = ["en", "zh", "vi", "es"] as const;
type InboxLocale = (typeof INBOX_SUPPORTED_LOCALES)[number];

function normalizeInboxLocale(locale: string): InboxLocale {
  const lower = (locale ?? "").toLowerCase();
  const match = INBOX_SUPPORTED_LOCALES.find((candidate) =>
    lower.startsWith(candidate),
  );
  return match ?? "en";
}

/** Google Cloud Translation targets for the portal locales. */
function googleTargetFor(locale: InboxLocale): string {
  return locale === "zh" ? "zh-CN" : locale;
}

interface StoredTranslation {
  paragraphs: string[];
  provider: string;
  translatedAt: string;
}

function parseStoredTranslations(
  value: unknown,
): Record<string, StoredTranslation> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, StoredTranslation> = {};
  for (const [lang, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Partial<StoredTranslation>;
    if (
      Array.isArray(candidate.paragraphs) &&
      candidate.paragraphs.every((p) => typeof p === "string")
    ) {
      out[lang] = {
        paragraphs: candidate.paragraphs,
        provider:
          typeof candidate.provider === "string" ? candidate.provider : "google",
        translatedAt:
          typeof candidate.translatedAt === "string"
            ? candidate.translatedAt
            : "",
      };
    }
  }
  return out;
}

function parseStoredAiMeta(value: unknown): InboxAiMeta | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<InboxAiMeta>;
  if (candidate.v !== 1 || typeof candidate.summary !== "string") return null;
  return {
    v: 1,
    lang: typeof candidate.lang === "string" ? candidate.lang : "en",
    model: typeof candidate.model === "string" ? candidate.model : "",
    generatedAt:
      typeof candidate.generatedAt === "string" ? candidate.generatedAt : "",
    summary: candidate.summary,
    details: Array.isArray(candidate.details)
      ? candidate.details.filter(
          (d): d is { label: string; value: string } =>
            typeof d === "object" &&
            d !== null &&
            typeof d.label === "string" &&
            typeof d.value === "string",
        )
      : [],
    category: isInboxCategory(candidate.category) ? candidate.category : null,
    needsAction: candidate.needsAction === true,
  };
}

function resolveCategory(
  row: {
    from_addr: string;
    subject: string | null;
    text: string | null;
    html: string | null;
  },
  ai: InboxAiMeta | null,
): { category: InboxCategory; needsAction: boolean } {
  const heuristic = categorizeInboundEmail({
    fromAddr: row.from_addr,
    subject: row.subject,
    snippet: emailSnippet(row.text, row.html, 400),
  });
  return {
    category: ai?.category ?? heuristic.category,
    needsAction: ai ? ai.needsAction : heuristic.needsAction,
  };
}

export interface ClientInboxListItem {
  id: string;
  from_addr: string;
  subject: string | null;
  received_at: string;
  snippet: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
  category: InboxCategory;
  needsAction: boolean;
  hasOriginal: boolean;
  attachmentCount: number | null;
}

export interface ClientInboxOverview {
  alias: string | null;
  items: ClientInboxListItem[];
}

interface ClientStateRow {
  id: string;
  from_addr: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  r2_key: string | null;
  received_at: string;
  read_at: string | null;
  starred: boolean;
  archived_at: string | null;
  ai_meta: unknown;
  attachments_meta: unknown;
}

const OVERVIEW_COLUMNS =
  "id, from_addr, subject, text, html, r2_key, received_at, read_at, starred, archived_at, ai_meta, attachments_meta";

export async function getClientInboxOverview(
  limit = 200,
): Promise<ClientInboxOverview> {
  const overview = await withAuthorizedInbox(
    "actions/inbox:overview",
    async (admin, alias) => {
      const { data, error } = await admin
        .from("inbound_email")
        .select(OVERVIEW_COLUMNS)
        .eq("to_addr", alias)
        .eq("quarantined", false)
        .order("received_at", { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(`getClientInboxOverview failed: ${error.message}`);
      }
      const items = ((data ?? []) as ClientStateRow[]).map(
        (row): ClientInboxListItem => {
          const ai = parseStoredAiMeta(row.ai_meta);
          const { category, needsAction } = resolveCategory(row, ai);
          const attachments = isAttachmentsMeta(row.attachments_meta)
            ? row.attachments_meta.attachments.length
            : null;
          return {
            id: row.id,
            from_addr: row.from_addr,
            subject: row.subject,
            received_at: row.received_at,
            snippet: emailSnippet(row.text, row.html),
            read: row.read_at !== null,
            starred: row.starred === true,
            archived: row.archived_at !== null,
            category,
            needsAction,
            hasOriginal: row.r2_key !== null,
            attachmentCount: attachments,
          };
        },
      );
      return { alias, items };
    },
  );
  return overview ?? { alias: null, items: [] };
}

export interface ClientInboxReply {
  id: string;
  kind: "reply" | "consultant_flag";
  body: string | null;
  status: string;
  created_at: string;
}

export interface ClientInboxMessage {
  id: string;
  from_addr: string;
  subject: string | null;
  received_at: string;
  html: string | null;
  text: string | null;
  raw_size: number;
  read: boolean;
  starred: boolean;
  archived: boolean;
  category: InboxCategory;
  needsAction: boolean;
  hasOriginal: boolean;
  ai: InboxAiMeta | null;
  translations: Record<string, string[]>;
  attachments: InboxAttachmentInfo[] | null;
  replies: ClientInboxReply[];
}

const MESSAGE_COLUMNS =
  "id, from_addr, subject, text, html, r2_key, raw_size, received_at, read_at, starred, archived_at, ai_meta, translations, attachments_meta";

async function fetchOwnedMessage(
  admin: SupabaseClient,
  alias: string,
  messageId: string,
  columns: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("inbound_email")
    .select(columns)
    .eq("id", messageId)
    .eq("to_addr", alias)
    .eq("quarantined", false)
    .maybeSingle();
  if (error) {
    throw new Error(`inbox message lookup failed: ${error.message}`);
  }
  return (data as Record<string, unknown> | null) ?? null;
}

export async function getClientInboxMessage(
  messageId: string,
): Promise<ClientInboxMessage | null> {
  return (
    (await withAuthorizedInbox(
      "actions/inbox:message",
      async (admin, alias) => {
        const row = (await fetchOwnedMessage(
          admin,
          alias,
          messageId,
          MESSAGE_COLUMNS,
        )) as (ClientStateRow & { raw_size: number; translations: unknown }) | null;
        if (!row) return null;

        const { data: replyRows, error: repliesError } = await admin
          .from("inbound_email_replies")
          .select("id, kind, body, status, created_at")
          .eq("email_id", messageId)
          .order("created_at", { ascending: true });
        if (repliesError) {
          throw new Error(`inbox replies lookup failed: ${repliesError.message}`);
        }

        const ai = parseStoredAiMeta(row.ai_meta);
        const { category, needsAction } = resolveCategory(row, ai);
        const translations = parseStoredTranslations(row.translations);
        return {
          id: row.id,
          from_addr: row.from_addr,
          subject: row.subject,
          received_at: row.received_at,
          html: row.html,
          text: row.text,
          raw_size: row.raw_size,
          read: row.read_at !== null,
          starred: row.starred === true,
          archived: row.archived_at !== null,
          category,
          needsAction,
          hasOriginal: row.r2_key !== null,
          ai,
          translations: Object.fromEntries(
            Object.entries(translations).map(([lang, entry]) => [
              lang,
              entry.paragraphs,
            ]),
          ),
          attachments: isAttachmentsMeta(row.attachments_meta)
            ? row.attachments_meta.attachments
            : null,
          replies: ((replyRows ?? []) as ClientInboxReply[]).map((reply) => ({
            id: reply.id,
            kind: reply.kind === "consultant_flag" ? "consultant_flag" : "reply",
            body: reply.body,
            status: reply.status,
            created_at: reply.created_at,
          })),
        } satisfies ClientInboxMessage;
      },
    )) ?? null
  );
}

async function updateOwnedMessage(
  actor: string,
  messageId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const updated = await withAuthorizedInbox(actor, async (admin, alias) => {
    const { data, error } = await admin
      .from("inbound_email")
      .update(patch)
      .eq("id", messageId)
      .eq("to_addr", alias)
      .eq("quarantined", false)
      .select("id");
    if (error) {
      throw new Error(`inbox state update failed: ${error.message}`);
    }
    return (data ?? []).length > 0;
  });
  if (!updated) {
    throw new Error("Message not found or not visible to caller");
  }
}

export async function setInboxMessageRead(
  messageId: string,
  read: boolean,
): Promise<{ ok: true }> {
  await updateOwnedMessage("actions/inbox:setRead", messageId, {
    read_at: read ? new Date().toISOString() : null,
  });
  return { ok: true };
}

export async function setInboxMessageStarred(
  messageId: string,
  starred: boolean,
): Promise<{ ok: true }> {
  await updateOwnedMessage("actions/inbox:setStarred", messageId, {
    starred,
  });
  return { ok: true };
}

export async function setInboxMessageArchived(
  messageId: string,
  archived: boolean,
): Promise<{ ok: true }> {
  await updateOwnedMessage("actions/inbox:setArchived", messageId, {
    archived_at: archived ? new Date().toISOString() : null,
  });
  return { ok: true };
}

export async function markAllInboxRead(): Promise<{ updated: number }> {
  const result = await withAuthorizedInbox(
    "actions/inbox:markAllRead",
    async (admin, alias) => {
      const { data, error } = await admin
        .from("inbound_email")
        .update({ read_at: new Date().toISOString() })
        .eq("to_addr", alias)
        .eq("quarantined", false)
        .is("read_at", null)
        .select("id");
      if (error) {
        throw new Error(`markAllInboxRead failed: ${error.message}`);
      }
      return { updated: (data ?? []).length };
    },
  );
  return result ?? { updated: 0 };
}

const REPLY_MAX_CHARS = 10_000;

export type QueueInboxReplyResult =
  | { ok: true; reply: ClientInboxReply }
  | { ok: false; code: "empty" | "too_long" | "rate_limited" | "not_found" };

/**
 * Applicant replies are queued for VIZA review, not sent directly: the alias
 * domain has no verified outbound sender, and outbound mail to embassies is a
 * staff-reviewed step by design.
 */
export async function queueInboxReply(
  messageId: string,
  body: string,
): Promise<QueueInboxReplyResult> {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return { ok: false, code: "empty" };
  if (trimmed.length > REPLY_MAX_CHARS) return { ok: false, code: "too_long" };

  const result = await withAuthorizedInbox(
    "actions/inbox:queueReply",
    async (admin, alias, applicantId): Promise<QueueInboxReplyResult> => {
      if (
        !consumeFormAssistantRateLimit(`inbox-reply:${applicantId}`, {
          limit: 5,
          windowMs: 60_000,
        })
      ) {
        return { ok: false, code: "rate_limited" };
      }
      const row = await fetchOwnedMessage(admin, alias, messageId, "id");
      if (!row) return { ok: false, code: "not_found" };

      const session = await getClientSessionWithFallback();
      const { data, error } = await admin
        .from("inbound_email_replies")
        .insert({
          email_id: messageId,
          applicant_id: applicantId,
          kind: "reply",
          body: trimmed,
          status: "queued",
          created_by_auth_user_id: session?.authUserId ?? null,
        })
        .select("id, kind, body, status, created_at")
        .single();
      if (error || !data) {
        throw new Error(`queueInboxReply failed: ${error?.message ?? "no row"}`);
      }
      return { ok: true, reply: data as ClientInboxReply };
    },
  );
  return result ?? { ok: false, code: "not_found" };
}

/**
 * "Ask my consultant" / "Forward to consultant": records a durable
 * consultant-attention flag on the message. Idempotent per message while a
 * flag is still queued.
 */
export async function flagInboxEmailForConsultant(
  messageId: string,
): Promise<{ ok: boolean }> {
  const result = await withAuthorizedInbox(
    "actions/inbox:flagConsultant",
    async (admin, alias, applicantId) => {
      if (
        !consumeFormAssistantRateLimit(`inbox-flag:${applicantId}`, {
          limit: 10,
          windowMs: 60_000,
        })
      ) {
        return false;
      }
      const row = await fetchOwnedMessage(admin, alias, messageId, "id");
      if (!row) return false;

      const { data: existing, error: existingError } = await admin
        .from("inbound_email_replies")
        .select("id")
        .eq("email_id", messageId)
        .eq("kind", "consultant_flag")
        .eq("status", "queued")
        .limit(1);
      if (existingError) {
        throw new Error(
          `consultant flag lookup failed: ${existingError.message}`,
        );
      }
      if ((existing ?? []).length > 0) return true;

      const session = await getClientSessionWithFallback();
      const { error } = await admin.from("inbound_email_replies").insert({
        email_id: messageId,
        applicant_id: applicantId,
        kind: "consultant_flag",
        body: null,
        status: "queued",
        created_by_auth_user_id: session?.authUserId ?? null,
      });
      if (error) {
        throw new Error(`flagInboxEmailForConsultant failed: ${error.message}`);
      }
      return true;
    },
  );
  return { ok: result === true };
}

export type EnsureInboxAiSummaryResult =
  | { ok: true; ai: InboxAiMeta }
  | { ok: false; code: "unavailable" | "failed" | "not_found" | "rate_limited" };

export async function ensureInboxAiSummary(
  messageId: string,
  locale: string,
): Promise<EnsureInboxAiSummaryResult> {
  const target = normalizeInboxLocale(locale);
  if (!isInboxAiConfigured()) return { ok: false, code: "unavailable" };

  const result = await withAuthorizedInbox(
    "actions/inbox:aiSummary",
    async (admin, alias, applicantId): Promise<EnsureInboxAiSummaryResult> => {
      const row = (await fetchOwnedMessage(
        admin,
        alias,
        messageId,
        "id, from_addr, subject, text, html, ai_meta",
      )) as
        | {
            id: string;
            from_addr: string;
            subject: string | null;
            text: string | null;
            html: string | null;
            ai_meta: unknown;
          }
        | null;
      if (!row) return { ok: false, code: "not_found" };

      const cached = parseStoredAiMeta(row.ai_meta);
      if (cached && cached.lang === target) return { ok: true, ai: cached };

      const bodyText = bestPlainText(row.text, row.html);
      if (!bodyText) return { ok: false, code: "failed" };

      if (
        !consumeFormAssistantRateLimit(`inbox-ai:${applicantId}`, {
          limit: 10,
          windowMs: 60_000,
        })
      ) {
        return { ok: false, code: "rate_limited" };
      }

      const ai = await generateInboxAiMeta({
        fromAddr: row.from_addr,
        subject: row.subject,
        bodyText,
        locale: target,
      });
      if (!ai) return { ok: false, code: "failed" };

      const { error } = await admin
        .from("inbound_email")
        .update({ ai_meta: ai })
        .eq("id", messageId)
        .eq("to_addr", alias);
      if (error) {
        throw new Error(`ai_meta persist failed: ${error.message}`);
      }
      return { ok: true, ai };
    },
  );
  return result ?? { ok: false, code: "not_found" };
}

export type EnsureInboxTranslationResult =
  | { ok: true; paragraphs: string[] }
  | { ok: false; code: "unavailable" | "failed" | "not_found" | "rate_limited" };

export async function ensureInboxTranslation(
  messageId: string,
  locale: string,
): Promise<EnsureInboxTranslationResult> {
  const target = normalizeInboxLocale(locale);

  const result = await withAuthorizedInbox(
    "actions/inbox:translate",
    async (admin, alias, applicantId): Promise<EnsureInboxTranslationResult> => {
      const row = (await fetchOwnedMessage(
        admin,
        alias,
        messageId,
        "id, text, html, translations",
      )) as
        | {
            id: string;
            text: string | null;
            html: string | null;
            translations: unknown;
          }
        | null;
      if (!row) return { ok: false, code: "not_found" };

      const stored = parseStoredTranslations(row.translations);
      const cached = stored[target];
      if (cached) return { ok: true, paragraphs: cached.paragraphs };

      const paragraphs = emailParagraphs(row.text, row.html);
      if (paragraphs.length === 0) return { ok: false, code: "failed" };

      if (
        !consumeFormAssistantRateLimit(`inbox-translate:${applicantId}`, {
          limit: 10,
          windowMs: 60_000,
        })
      ) {
        return { ok: false, code: "rate_limited" };
      }

      const translated: string[] = [];
      for (const batch of chunkParagraphs(paragraphs)) {
        const outcome = await translateManyWithGoogleV2({
          texts: batch,
          targetLanguage: googleTargetFor(target),
          fieldType: "email_body",
        });
        if (!outcome.ok) {
          return {
            ok: false,
            code:
              outcome.code === "provider_unavailable" ? "unavailable" : "failed",
          };
        }
        translated.push(...outcome.translatedTexts);
      }
      if (translated.length === 0) return { ok: false, code: "failed" };

      const nextTranslations: Record<string, StoredTranslation> = {
        ...stored,
        [target]: {
          paragraphs: translated,
          provider: "google",
          translatedAt: new Date().toISOString(),
        },
      };
      const { error } = await admin
        .from("inbound_email")
        .update({ translations: nextTranslations })
        .eq("id", messageId)
        .eq("to_addr", alias);
      if (error) {
        throw new Error(`translations persist failed: ${error.message}`);
      }
      return { ok: true, paragraphs: translated };
    },
  );
  return result ?? { ok: false, code: "not_found" };
}

export type ListInboxAttachmentsResult =
  | { ok: true; attachments: InboxAttachmentInfo[] }
  | { ok: false; code: "no_original" | "failed" };

export async function listInboxAttachments(
  messageId: string,
): Promise<ListInboxAttachmentsResult> {
  const result = await withAuthorizedInbox(
    "actions/inbox:attachments",
    async (admin, alias): Promise<ListInboxAttachmentsResult> => {
      const row = (await fetchOwnedMessage(
        admin,
        alias,
        messageId,
        "id, r2_key, attachments_meta",
      )) as
        | { id: string; r2_key: string | null; attachments_meta: unknown }
        | null;
      if (!row) return { ok: false, code: "failed" };
      if (isAttachmentsMeta(row.attachments_meta)) {
        return { ok: true, attachments: row.attachments_meta.attachments };
      }
      if (!row.r2_key) return { ok: false, code: "no_original" };

      const meta = await buildAttachmentsMeta(row.r2_key);
      if (!meta) return { ok: false, code: "failed" };

      const { error } = await admin
        .from("inbound_email")
        .update({ attachments_meta: meta })
        .eq("id", messageId)
        .eq("to_addr", alias);
      if (error) {
        throw new Error(`attachments_meta persist failed: ${error.message}`);
      }
      return { ok: true, attachments: meta.attachments };
    },
  );
  return result ?? { ok: false, code: "failed" };
}

/**
 * Route-handler helper (app/api/inbox/[id]/attachment/[index]): re-derives a
 * single MIME part after the same ownership check as every other read.
 */
export async function getInboundEmailAttachment(
  messageId: string,
  index: number,
): Promise<InboxAttachmentPart | null> {
  return (
    (await withAuthorizedInbox(
      "actions/inbox:attachmentDownload",
      async (admin, alias) => {
        const row = (await fetchOwnedMessage(
          admin,
          alias,
          messageId,
          "id, r2_key",
        )) as { id: string; r2_key: string | null } | null;
        if (!row?.r2_key) return null;
        return extractAttachmentPart(row.r2_key, index);
      },
    )) ?? null
  );
}
