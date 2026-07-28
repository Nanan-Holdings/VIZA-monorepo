export type AppointmentFreeSmokeVerdict = "pass" | "conditional" | "proxy_required";

export interface AppointmentPortalStateInput {
  status: number | null;
  url: string;
  title: string;
  bodyText: string;
  expectedMarker: RegExp;
}

export interface AppointmentPortalState {
  verdict: AppointmentFreeSmokeVerdict;
  reason: string;
  captchaDetected: boolean;
  wafDetected: boolean;
  entryDetected: boolean;
}

const CAPTCHA_PATTERN = /captcha|recaptcha|hcaptcha|turnstile|verify you are human|i am not a robot/i;
const WAF_PATTERN = /access denied|request rejected|forbidden|geo(?:graphic)?(?:al)? restriction|not available in your (?:country|region)|error\s*(?:403|1020)/i;
const TRANSIENT_SECURITY_PATTERN = /just a moment|checking your browser|security verification|attention required|cloudflare/i;

export function redactOfficialUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "[REDACTED]";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[REDACTED]";
  }
}

export function classifyAppointmentPortalState(
  input: AppointmentPortalStateInput,
): AppointmentPortalState {
  const text = `${input.title}\n${input.bodyText}`.replace(/\s+/g, " ").trim();
  const captchaDetected = CAPTCHA_PATTERN.test(text);
  const transientSecurityDetected = TRANSIENT_SECURITY_PATTERN.test(text);
  const entryDetected = input.expectedMarker.test(text);
  const hardWafDetected = WAF_PATTERN.test(text)
    || input.status === 401
    || (input.status === 403
      && !captchaDetected
      && !transientSecurityDetected
      && !entryDetected);

  if (hardWafDetected) {
    return {
      verdict: "proxy_required",
      reason: "The proxy-free cloud session was rejected by an access or region policy.",
      captchaDetected,
      wafDetected: true,
      entryDetected,
    };
  }
  if (captchaDetected || transientSecurityDetected) {
    return {
      verdict: "conditional",
      reason: captchaDetected
        ? "The official entry is reachable but a CAPTCHA must be solved separately."
        : "The official entry is reachable but remains behind a security or waiting-room checkpoint.",
      captchaDetected,
      wafDetected: transientSecurityDetected,
      entryDetected,
    };
  }
  const unresolvedHttpError = (input.status ?? 200) >= 400 && input.status !== 403;
  if (unresolvedHttpError || !entryDetected) {
    return {
      verdict: "conditional",
      reason: "The official page responded, but the expected login or registration entry was not verified.",
      captchaDetected,
      wafDetected: false,
      entryDetected,
    };
  }
  return {
    verdict: "pass",
    reason: "The proxy-free cloud session reached the expected official login or registration entry.",
    captchaDetected,
    wafDetected: false,
    entryDetected,
  };
}

export function findMissingAppointmentFields(
  answers: Record<string, string>,
  requiredFields: readonly string[],
): string[] {
  return requiredFields.filter((field) => !answers[field]?.trim());
}
