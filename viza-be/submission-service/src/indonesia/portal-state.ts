export type IndonesiaPortalStateId =
  | "landing_visible"
  | "visa_selection_visible"
  | "login_required"
  | "registration_required"
  | "account_registration_form_visible"
  | "official_application_started"
  | "captcha_required"
  | "application_form_visible"
  | "payment_required"
  | "submitted_or_approved"
  | "portal_blocked"
  | "unknown";

export interface IndonesiaPortalSnapshot {
  url: string;
  title?: string | null;
  text?: string | null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function classifyIndonesiaPortalSnapshot(
  snapshot: IndonesiaPortalSnapshot,
): IndonesiaPortalStateId {
  const text = normalizeText(`${snapshot.title ?? ""} ${snapshot.text ?? ""} ${snapshot.url}`);

  if (!text) return "unknown";
  if (
    text.includes("front/register/wna") ||
    text.includes("fill out the form to register an account") ||
    (text.includes("biography passport page") && text.includes("account information"))
  ) {
    return "account_registration_form_visible";
  }
  if (
    text.includes("visa-selection") ||
    text.includes("passport/country/region") ||
    text.includes("i want to explore & choose a visa") ||
    text.includes("the main purpose of my visit to indonesia is")
  ) {
    return "visa_selection_visible";
  }
  if (
    text.includes("application_add") ||
    text.includes("/step_1")
  ) {
    return "official_application_started";
  }
  if (
    text.includes("front/login") ||
    text.includes("/login")
  ) {
    return "login_required";
  }
  if (
    text.includes("visa application guideline") ||
    text.includes("track your application")
  ) {
    return "landing_visible";
  }
  if (
    text.includes("cf-ray") ||
    text.includes("checking your browser") ||
    text.includes("attention required") ||
    text.includes("access denied") ||
    text.includes("forbidden")
  ) {
    return "portal_blocked";
  }
  if (text.includes("captcha") || text.includes("recaptcha") || text.includes("turnstile")) {
    return "captcha_required";
  }
  if (
    text.includes("register") ||
    text.includes("create account") ||
    text.includes("sign up") ||
    text.includes("verification email")
  ) {
    return "registration_required";
  }
  if (
    text.includes("front/login") ||
    text.includes("/login") ||
    text.includes("login") ||
    text.includes("log in") ||
    text.includes("sign in") ||
    (text.includes("email") && text.includes("password"))
  ) {
    return "login_required";
  }
  if (
    text.includes("pay now") ||
    text.includes("proceed to payment") ||
    text.includes("make payment") ||
    text.includes("checkout") ||
    text.includes("credit card") ||
    text.includes("debit card")
  ) {
    return "payment_required";
  }
  if (
    text.includes("approved") ||
    text.includes("download e-visa") ||
    text.includes("download evisa") ||
    text.includes("application submitted") ||
    text.includes("reference number")
  ) {
    return "submitted_or_approved";
  }
  if (
    text.includes("passport") ||
    text.includes("travel document") ||
    text.includes("arrival date") ||
    text.includes("application form")
  ) {
    return "application_form_visible";
  }
  if (
    text.includes("the official e-visa website") ||
    text.includes("visa application guideline") ||
    text.includes("track your application")
  ) {
    return "landing_visible";
  }
  if (
    text.includes("evisa") ||
    text.includes("e-visa") ||
    text.includes("electronic visa") ||
    text.includes("visa on arrival")
  ) {
    return "landing_visible";
  }
  return "unknown";
}

export function actionForIndonesiaPortalState(
  state: IndonesiaPortalStateId,
): {
  actionType: string;
  instruction: string;
  implementationStatus: "partial" | "blocked";
} {
  switch (state) {
    case "login_required":
    case "registration_required":
      return {
        actionType: "official_account_automation_required",
        instruction:
          "VIZA reached the Indonesia official portal account gate. The next automation step is managed account login/registration plus email-worker verification.",
        implementationStatus: "partial",
      };
    case "account_registration_form_visible":
      return {
        actionType: "official_account_registration_form_reached",
        instruction:
          "VIZA reached the Indonesia official Foreigner account registration form. Continue by uploading passport/photo documents, filling account data, solving CAPTCHA when present, and using email-worker verification.",
        implementationStatus: "partial",
      };
    case "captcha_required":
      return {
        actionType: "captcha_required",
        instruction:
          "The Indonesia official portal displayed a CAPTCHA. Continue with the configured 2Captcha solver before filling the official form.",
        implementationStatus: "partial",
      };
    case "payment_required":
      return {
        actionType: "official_fee_payment_required",
        instruction:
          "The Indonesia official portal reached payment. Continue only with an authorized one-time card session; stop at 3DS or OTP.",
        implementationStatus: "partial",
      };
    case "submitted_or_approved":
      return {
        actionType: "official_result_capture_required",
        instruction:
          "The Indonesia official portal shows submitted or approved status. Capture the official reference and downloadable eVisa artifact.",
        implementationStatus: "partial",
      };
    case "portal_blocked":
      return {
        actionType: "official_portal_error",
        instruction:
          "The Indonesia official portal blocked or denied the browser session. Use Browser API/CDP recon or operator review before retrying.",
        implementationStatus: "blocked",
      };
    case "application_form_visible":
      return {
        actionType: "official_form_reached",
        instruction:
          "The Indonesia official application form is visible. Continue field mapping and document upload automation.",
        implementationStatus: "partial",
      };
    case "official_application_started":
      return {
        actionType: "official_application_started",
        instruction:
          "VIZA selected the requested Indonesia visa category on the official portal and reached the official application URL. Continue account, field, and upload automation without asking the applicant to click again.",
        implementationStatus: "partial",
      };
    case "visa_selection_visible":
      return {
        actionType: "official_visa_selection_reached",
        instruction:
          "VIZA reached the Indonesia official visa selection page. Continue by selecting the requested C1 or B1 official visa category automatically.",
        implementationStatus: "partial",
      };
    case "landing_visible":
    case "unknown":
    default:
      return {
        actionType: "live_portal_recon_required",
        instruction:
          "VIZA reached the Indonesia official portal. Continue selector recon for the next visible account or form step.",
        implementationStatus: "partial",
      };
  }
}
