import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/**
 * Contact-form intake for the marketing site.
 *
 * The marketing site has no backend of its own (per its CLAUDE.md), so
 * its `/api/contact` route proxies the visitor's submission here
 * server-to-server. We validate, then forward the enquiry as an email
 * to the ops inbox via Resend — no DB table involved, mirroring how
 * other transactional mail is sent (lib/email/resend.ts).
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
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
