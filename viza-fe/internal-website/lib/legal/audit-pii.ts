"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Audit a PII read (LEGAL-005).
 *
 * Wrap server-action reads of passport / photo / form-answer rows in
 * `auditPiiRead(actor, applicantId, fields, opts?)` so we can prove
 * who saw what after an incident.
 *
 * The helper is intentionally fire-and-forget at the call site:
 * a logger failure must NOT block the underlying read. Errors are
 * console.error()'d with enough context to reconstruct the event.
 *
 * Field vocabulary (stable; extend with care):
 *   passport, photo, form_answers, contact, address, payment.
 */

export type PiiField =
  | "passport"
  | "photo"
  | "form_answers"
  | "contact"
  | "address"
  | "payment";

export interface AuditPiiOpts {
  applicationId?: string;
  /** Why the read happened (admin_review, self_view, submission_runner, ...). */
  purpose?: string;
}

async function readForensics() {
  try {
    const h = await headers();
    return {
      ip:
        h.get("cf-connecting-ip") ??
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null,
      ua: h.get("user-agent") ?? null,
    };
  } catch {
    return { ip: null, ua: null };
  }
}

export async function auditPiiRead(
  actor: string,
  applicantId: string,
  fields: PiiField[],
  opts: AuditPiiOpts = {},
): Promise<void> {
  if (!applicantId || fields.length === 0) return;

  let actorUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorUserId = user?.id ?? null;
  } catch {
    actorUserId = null;
  }

  const { ip, ua } = await readForensics();

  try {
    await withAdmin("system", "lib/legal/audit-pii:auditPiiRead", async (admin) => {
      const { error } = await admin.from("pii_access_log").insert({
        applicant_id: applicantId,
        application_id: opts.applicationId ?? null,
        actor_user_id: actorUserId,
        actor,
        purpose: opts.purpose ?? "unspecified",
        fields,
        ip,
        ua,
      });
      if (error) {
        console.error("[audit-pii] insert failed", error.message, {
          actor,
          applicantId,
          fields,
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[audit-pii] threw", msg, { actor, applicantId, fields });
  }
}
