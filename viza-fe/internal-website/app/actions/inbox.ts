"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { presignR2Get } from "@/lib/inbox/r2-presign";
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
  action: (admin: SupabaseClient, alias: string) => Promise<T>,
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
