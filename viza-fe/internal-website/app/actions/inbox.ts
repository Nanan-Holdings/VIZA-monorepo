"use server";

import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import { presignR2Get } from "@/lib/inbox/r2-presign";

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

/**
 * Inbox listing for the signed-in applicant. Reads through the
 * authenticated Supabase client so RLS scopes the query to rows whose
 * `to_addr` matches the user's `applicant_profiles.inbox_alias`
 * (policy from migration 0046).
 */
export async function listClientInbox(limit = 100): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbound_email")
    .select(
      "id, to_addr, from_addr, subject, text, html, r2_key, raw_size, spam_score, received_at, processed",
    )
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`listClientInbox failed: ${error.message}`);
  }
  return (data ?? []) as InboxRow[];
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
  // RLS-aware read so an applicant cannot mint a URL for someone else's row.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbound_email")
    .select("id, r2_key")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw new Error(`download lookup failed: ${error.message}`);
  if (!data) throw new Error("Message not found or not visible to caller");
  if (!data.r2_key) {
    throw new Error("Message has no R2-stored body (inline only)");
  }
  const expiresIn = 300;
  return { url: presignR2Get({ key: data.r2_key, expiresIn }), expiresIn };
}
