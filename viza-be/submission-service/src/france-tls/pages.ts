export type FranceTlsPageId =
  | "unknown"
  | "login"
  | "application_reference"
  | "center_selection"
  | "slot_calendar"
  | "payment"
  | "confirmation"
  | "manual_gate";

export interface FranceTlsPageDetection {
  id: FranceTlsPageId;
  url: string;
  reason: string;
}

export function detectFranceTlsPageFromText(input: { url: string; text: string }): FranceTlsPageDetection {
  const text = input.text.toLowerCase();
  if (/captcha|cloudflare|verify you are human|access denied/u.test(text)) {
    return { id: "manual_gate", url: input.url, reason: "captcha_or_waf_text" };
  }
  if (/confirmation|appointment confirmed|rendez-vous confirmé/u.test(text)) {
    return { id: "confirmation", url: input.url, reason: "confirmation_text" };
  }
  if (/payment|card number|service fee|frais de service/u.test(text)) {
    return { id: "payment", url: input.url, reason: "payment_text" };
  }
  if (/available appointment|calendar|appointment date|créneau/u.test(text)) {
    return { id: "slot_calendar", url: input.url, reason: "calendar_text" };
  }
  if (/visa application centre|select your visa application centre|tlscontact centre/u.test(text)) {
    return { id: "center_selection", url: input.url, reason: "center_selection_text" };
  }
  if (/france-visas reference|application reference|reference number/u.test(text)) {
    return { id: "application_reference", url: input.url, reason: "reference_text" };
  }
  if (/sign in|log in|password|email/u.test(text)) {
    return { id: "login", url: input.url, reason: "login_text" };
  }
  return { id: "unknown", url: input.url, reason: "no_marker" };
}
