import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wizard prefill hand-off from the marketing /apply funnel.
 *
 * The marketing wizard OCRs the visitor's passport and collects trip
 * preferences before deep-linking into the guest checkout. That payload
 * arrives as a base64url-encoded JSON blob in the `prefill` query param
 * (the marketing site has no backend of its own, per its CLAUDE.md).
 * Both guest checkout actions decode it server-side and persist it so
 * the visitor's OCR work isn't thrown away:
 *
 *   - passport identity  → applicant_profiles columns
 *   - arrival date       → applications.arrival_date
 *   - speed tier/add-ons → visa_application_answers key-values
 *
 * Everything is optional and best-effort: a malformed or missing blob
 * must never block checkout.
 */

export interface CheckoutPrefill {
  surname?: string;
  givenNames?: string;
  passportNumber?: string;
  /** ISO dates (YYYY-MM-DD). */
  dob?: string;
  expiryDate?: string;
  issueDate?: string;
  /** ISO 3166-1 alpha-3, as read from the MRZ. */
  nationality?: string;
  issuingCountry?: string;
  sex?: string;
  /** E.164-ish, dial code included (e.g. "+65 8123 4567"). */
  phone?: string;
  /** Requested arrival date, ISO (YYYY-MM-DD). */
  arrivalDate?: string;
  speed?: "standard" | "express" | "superrush";
  addons?: string[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPEEDS = new Set(["standard", "express", "superrush"]);

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t && t.length <= max ? t : undefined;
}

function isoDate(v: unknown): string | undefined {
  const s = str(v, 10);
  return s && ISO_DATE_RE.test(s) ? s : undefined;
}

/**
 * Decode + sanitise the marketing-side prefill blob. Returns null on
 * any parse failure — the caller treats that as "no prefill".
 */
export function decodeCheckoutPrefill(raw: string | undefined | null): CheckoutPrefill | null {
  if (!raw || raw.length > 4096) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  const speed = str(p.speed, 16);
  const addons = Array.isArray(p.addons)
    ? p.addons
        .map((a) => str(a, 32))
        .filter((a): a is string => Boolean(a))
        .slice(0, 8)
    : undefined;

  const out: CheckoutPrefill = {
    surname: str(p.surname, 80),
    givenNames: str(p.givenNames, 120),
    passportNumber: str(p.passportNumber, 20),
    dob: isoDate(p.dob),
    expiryDate: isoDate(p.expiryDate),
    issueDate: isoDate(p.issueDate),
    nationality: str(p.nationality, 3),
    issuingCountry: str(p.issuingCountry, 3),
    sex: str(p.sex, 10),
    phone: str(p.phone, 24),
    arrivalDate: isoDate(p.arrivalDate),
    speed: speed && SPEEDS.has(speed) ? (speed as CheckoutPrefill["speed"]) : undefined,
    addons: addons && addons.length ? addons : undefined,
  };
  return Object.values(out).some((v) => v !== undefined) ? out : null;
}

/**
 * Persist a decoded prefill against the freshly upserted applicant +
 * draft application. Best-effort by design: failures are swallowed so a
 * profile hiccup never blocks the payment redirect.
 */
export async function applyCheckoutPrefill(
  admin: SupabaseClient,
  ids: { applicantId: string; applicationId: string },
  prefill: CheckoutPrefill,
): Promise<void> {
  try {
    const profilePatch: Record<string, unknown> = {};
    if (prefill.passportNumber) profilePatch.passport_number = prefill.passportNumber;
    if (prefill.expiryDate) profilePatch.passport_expiry_date = prefill.expiryDate;
    if (prefill.issueDate) profilePatch.passport_issue_date = prefill.issueDate;
    if (prefill.issuingCountry) profilePatch.passport_issuing_country = prefill.issuingCountry;
    if (prefill.nationality) profilePatch.nationality = prefill.nationality;
    if (prefill.dob) profilePatch.date_of_birth = prefill.dob;
    if (prefill.sex) profilePatch.gender = prefill.sex;
    if (prefill.phone) profilePatch.phone = prefill.phone;
    if (Object.keys(profilePatch).length > 0) {
      profilePatch.updated_at = new Date().toISOString();
      await admin
        .from("applicant_profiles")
        .update(profilePatch)
        .eq("id", ids.applicantId);
    }

    if (prefill.arrivalDate) {
      await admin
        .from("applications")
        .update({
          arrival_date: prefill.arrivalDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ids.applicationId);
    }

    const answers: Array<{
      application_id: string;
      field_name: string;
      value_text?: string;
      value_json?: unknown;
    }> = [];
    if (prefill.surname || prefill.givenNames) {
      answers.push({
        application_id: ids.applicationId,
        field_name: "passport_name",
        value_json: { surname: prefill.surname ?? null, givenNames: prefill.givenNames ?? null },
      });
    }
    if (prefill.speed) {
      answers.push({
        application_id: ids.applicationId,
        field_name: "speed_tier",
        value_text: prefill.speed,
      });
    }
    if (prefill.addons) {
      answers.push({
        application_id: ids.applicationId,
        field_name: "addons",
        value_json: prefill.addons,
      });
    }
    if (answers.length > 0) {
      await admin
        .from("visa_application_answers")
        .upsert(answers, { onConflict: "application_id,field_name" });
    }
  } catch (err) {
    console.error("[checkout] prefill persist failed (non-fatal):", err);
  }
}
