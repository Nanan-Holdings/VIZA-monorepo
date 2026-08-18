import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Contact-form intake for the marketing site.
 *
 * The marketing site has no backend of its own (per its CLAUDE.md), so
 * its `/api/contact` route proxies the visitor's submission here
 * server-to-server. We validate, persist a durable lead, and send an email
 * notification. The database record is the operational source of truth.
 *
 * Env:
 *   CONTACT_INBOX_EMAIL — destination inbox (falls back to NOTIFY_FROM_EMAIL).
 *   NOTIFY_FROM_EMAIL   — Resend-verified from address.
 */

interface ContactPayload {
  fullName: string;
  email: string;
  phone?: string;
  preferredChannel?: string;
  passportNationality?: string;
  destination?: string;
  reasons?: string[];
  message: string;
  locale?: string;
  /** Honeypot — bots fill it, humans never see it. */
  website?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: pretend success so bots don't adapt.
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const fullName = clean(body.fullName, 120);
  const email = clean(body.email, 200).toLowerCase();
  const message = clean(body.message, 5000);
  if (!fullName || !EMAIL_RE.test(email) || !message) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const to =
    process.env.CONTACT_INBOX_EMAIL ?? process.env.NOTIFY_FROM_EMAIL;
  const from =
    process.env.NOTIFY_FROM_EMAIL ?? "VIZA <noreply@viza.it.com>";
  if (!to) {
    console.error("[contact] CONTACT_INBOX_EMAIL / NOTIFY_FROM_EMAIL not set");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const reasons = Array.isArray(body.reasons)
    ? body.reasons.map((r) => clean(r, 60)).filter(Boolean).slice(0, 10)
    : [];
  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("marketing_leads")
    .insert({
      full_name: fullName,
      email,
      phone: clean(body.phone, 40) || null,
      preferred_channel: clean(body.preferredChannel, 40) || null,
      passport_nationality: clean(body.passportNationality, 80) || null,
      destination: clean(body.destination, 80) || null,
      reasons,
      message,
      locale: clean(body.locale, 10) || null,
      source: "marketing_contact",
    })
    .select("id")
    .single();
  if (leadError) {
    console.error("[contact] durable lead insert failed:", leadError.message);
  } else if (lead) {
    const { error: workError } = await admin.from("admin_work_items").insert({
      source_type: "marketing_leads",
      source_id: lead.id,
      dedupe_key: `marketing_leads:${lead.id}`,
      kind: "lead_followup",
      title: "New marketing enquiry",
      description: clean(body.destination, 80) || "Destination not specified",
      priority: "p2",
      owning_team: "customer_support",
      due_at: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
      checklist: [
        { label: "Review destination, nationality, intent, and message", completed: false },
        { label: "Assign an owner and reply through the preferred channel", completed: false },
        { label: "Qualify, convert, or record a specific loss reason", completed: false },
      ],
    });
    if (workError) console.error("[contact] lead work item insert failed:", workError.message);
  }

  const lines = [
    `Name: ${fullName}`,
    `Email: ${email}`,
    body.phone ? `Phone: ${clean(body.phone, 40)}` : null,
    body.preferredChannel
      ? `Preferred channel: ${clean(body.preferredChannel, 40)}`
      : null,
    body.passportNationality
      ? `Passport nationality: ${clean(body.passportNationality, 80)}`
      : null,
    body.destination ? `Destination: ${clean(body.destination, 80)}` : null,
    reasons.length ? `Reasons: ${reasons.join(", ")}` : null,
    body.locale ? `Locale: ${clean(body.locale, 10)}` : null,
    "",
    "Message:",
    message,
  ].filter((l): l is string => l !== null);

  try {
    await sendEmail({
      from,
      to,
      subject: `[VIZA contact] ${fullName} — ${reasons[0] ?? "enquiry"}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("[contact] send failed:", err);
    if (lead?.id) {
      await admin.from("marketing_leads").update({ email_delivery_status: "failed", updated_at: new Date().toISOString() }).eq("id", lead.id);
    }
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  if (lead?.id) {
    await admin.from("marketing_leads").update({ email_delivery_status: "sent", updated_at: new Date().toISOString() }).eq("id", lead.id);
  }

  return NextResponse.json({ ok: true });
}
