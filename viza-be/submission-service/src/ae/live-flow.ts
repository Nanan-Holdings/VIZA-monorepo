import type { Page } from "@playwright/test";
import type { AeDocumentKey } from "./field-mappings.js";

export const AE_OFFICIAL_HOST = "smartservices.icp.gov.ae";

export function isOfficialAePortalUrl(value: string | URL): boolean {
  try {
    const url = value instanceof URL ? value : new URL(value);
    return url.protocol === "https:" &&
      url.hostname.toLowerCase() === AE_OFFICIAL_HOST &&
      !url.port &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export function requireOfficialAePortalUrl(value: string, boundary: string): string {
  if (!isOfficialAePortalUrl(value)) {
    throw new Error(`ICP ${boundary} left the verified official host`);
  }
  return value;
}

export const AE_PUBLIC_FEE_SCHEDULE_AED = {
  request_fee: 100,
  issuance_fee: 500,
  security_deposit: 3025,
  e_services_fee: 28,
  icp_fee: 22,
  smart_services_fee: 100,
} as const;

export const AE_PUBLIC_LISTED_TOTAL_AED = 3775;

export type AeFeeComponentKey = keyof typeof AE_PUBLIC_FEE_SCHEDULE_AED;

export interface AeObservedFeeComponent {
  key: AeFeeComponentKey;
  amount: number;
  currency: "AED";
}

const AE_FEE_LABELS: Record<AeFeeComponentKey, RegExp> = {
  request_fee: /request(?:\s+fee)?/i,
  issuance_fee: /issu(?:e|ance)(?:\s+fee)?/i,
  security_deposit: /security\s+deposit/i,
  e_services_fee: /e[- ]?services?(?:\s+fee)?/i,
  icp_fee: /icp(?:\s+fee(?:s)?)?/i,
  smart_services_fee: /smart\s+services?(?:\s+fee)?/i,
};

export function parseAeFeeComponents(bodyText: string): AeObservedFeeComponent[] {
  const body = bodyText.replace(/\s+/g, " ").trim();
  const components: AeObservedFeeComponent[] = [];
  for (const [key, label] of Object.entries(AE_FEE_LABELS) as Array<[AeFeeComponentKey, RegExp]>) {
    const labelSource = label.source.replace(/^\//, "").replace(/\/$/, "");
    const before = new RegExp(`${labelSource}.{0,80}?(?:AED\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(?:AED)?`, "i");
    const after = new RegExp(`(?:AED\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(?:AED)?.{0,30}?${labelSource}`, "i");
    const match = before.exec(body) ?? after.exec(body);
    if (!match) continue;
    const amount = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(amount)) components.push({ key, amount, currency: "AED" });
  }
  return components;
}

export function isCompleteAeFeeCheckpoint(components: readonly AeObservedFeeComponent[]): boolean {
  const byKey = new Map(components.map((component) => [component.key, component]));
  return (Object.keys(AE_PUBLIC_FEE_SCHEDULE_AED) as AeFeeComponentKey[]).every((key) => {
    const component = byKey.get(key);
    return component?.currency === "AED" && Number.isFinite(component.amount) && component.amount >= 0;
  });
}

export interface AeLiveConfig {
  preSubmitEnabled: boolean;
  authenticatedCdpEnabled: boolean;
  documentUploadEnabled: boolean;
  paymentCheckpointEnabled: boolean;
  sessionMode: string | null;
  providerAccountEligibility: string | null;
}

export function readAeLiveConfig(env: NodeJS.ProcessEnv = process.env): AeLiveConfig {
  const enabled = (name: string): boolean => env[name]?.trim().toLowerCase() === "true";
  return {
    preSubmitEnabled: enabled("AE_PRE_SUBMIT_QA_ENABLED"),
    authenticatedCdpEnabled: enabled("AE_AUTHENTICATED_CDP_ENABLED"),
    documentUploadEnabled: enabled("AE_DOCUMENT_UPLOAD_ENABLED"),
    paymentCheckpointEnabled: enabled("AE_PAYMENT_CHECKPOINT_ENABLED"),
    sessionMode: env.AE_SESSION_MODE?.trim().toLowerCase() || null,
    providerAccountEligibility: env.AE_PROVIDER_ACCOUNT_ELIGIBILITY?.trim().toLowerCase() || null,
  };
}

const AE_PROVIDER_ACCOUNT_ELIGIBILITY = new Set([
  "uae_or_gcc_citizen_or_resident",
  "corporate_guarantor_file",
  "establishment",
  "typing_center",
]);

export function validateAeLiveConfig(
  config: AeLiveConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const blockers: string[] = [];
  if (config.authenticatedCdpEnabled && !env.AE_CDP_ENDPOINT?.trim() && !env.AE_CHROME_CDP_ENDPOINT?.trim()) {
    blockers.push("AE_CDP_ENDPOINT");
  }
  if (config.authenticatedCdpEnabled && !["uae_pass", "eligible_provider_account"].includes(config.sessionMode ?? "")) {
    blockers.push("AE_SESSION_MODE");
  }
  if (
    config.authenticatedCdpEnabled &&
    config.sessionMode === "eligible_provider_account" &&
    !AE_PROVIDER_ACCOUNT_ELIGIBILITY.has(config.providerAccountEligibility ?? "")
  ) {
    blockers.push("AE_PROVIDER_ACCOUNT_ELIGIBILITY");
  }
  if ((config.documentUploadEnabled || config.paymentCheckpointEnabled) && !config.authenticatedCdpEnabled) {
    blockers.push("AE_AUTHENTICATED_CDP_ENABLED");
  }
  if (config.paymentCheckpointEnabled && !config.documentUploadEnabled) {
    blockers.push("AE_DOCUMENT_UPLOAD_ENABLED");
  }
  return blockers;
}

export function aeAuthorizedCdpConnectionError(_cause: unknown): Error {
  return new Error("UAE authorized CDP endpoint was not reachable");
}

export type AePortalCheckpoint =
  | "applicant_form"
  | "document_upload"
  | "guest_service_shell"
  | "identity_session_required"
  | "maintenance"
  | "payment"
  | "session_expired"
  | "wrong_product"
  | "selector_drift";

export interface AePortalState {
  checkpoint: AePortalCheckpoint;
  message: string;
  observedAmount?: string;
  observedCurrency?: string;
  observedComponents?: string[];
}

export function classifyAePortalState(input: {
  url: string;
  title: string;
  bodyText: string;
  hasDocumentInput?: boolean;
  hasApplicantControl?: boolean;
  hasIdentityControl?: boolean;
  hasPaymentControl?: boolean;
  productVerified?: boolean;
}): AePortalState {
  if (!isOfficialAePortalUrl(input.url)) {
    return {
      checkpoint: "selector_drift",
      message: "ICP navigation left the verified official host.",
    };
  }
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  const haystack = `${input.url} ${input.title} ${body}`.toLowerCase();
  if (/coming back soon|سنعود بعد قليل|maintenance|temporarily unavailable/.test(haystack)) {
    return { checkpoint: "maintenance", message: "ICP is showing its official maintenance page." };
  }
  if (/session (?:has )?expired|your session is invalid|انتهت الجلسة|جلسة غير صالحة/i.test(body)) {
    return { checkpoint: "session_expired", message: "The authorized ICP/UAE Pass session has expired." };
  }
  const feeComponents = parseAeFeeComponents(body);
  if (
    input.productVerified === true &&
    input.hasPaymentControl === true &&
    /payment|pay now|fees summary|رسوم|ضمان مالي|guarantee/i.test(body) &&
    isCompleteAeFeeCheckpoint(feeComponents)
  ) {
    const observedTotal = feeComponents.reduce((total, component) => total + component.amount, 0);
    return {
      checkpoint: "payment",
      message: "ICP fee/guarantee summary is visible; no payment action was taken.",
      observedAmount: observedTotal.toFixed(2),
      observedCurrency: "AED",
      observedComponents: feeComponents.map((component) => component.key),
    };
  }
  if (input.hasDocumentInput && /passport|photo|attachment|upload|مرفق/i.test(body)) {
    return { checkpoint: "document_upload", message: "ICP transaction 783 document controls are visible." };
  }
  if (input.hasApplicantControl && /beneficiary|passport|applicant|المستفيد/i.test(body)) {
    return { checkpoint: "applicant_form", message: "ICP transaction 783 applicant form is visible." };
  }
  if (/783/.test(input.url) && /multiple entry|long-term tourism|5 years|خمس سنوات/i.test(body)) {
    return {
      checkpoint: "guest_service_shell",
      message: "ICP transaction 783 guest service shell is visible; an authorized identity session is required before applicant controls are exposed.",
    };
  }
  if (input.hasIdentityControl || /uae pass|الهوية الرقمية/i.test(body)) {
    return {
      checkpoint: "identity_session_required",
      message: "ICP requires an authorized UAE PASS or eligible provider session; ordinary foreign tourist username registration is not an eligible fallback.",
    };
  }
  if (/issueVisa\/request\/\d+/i.test(input.url) && !/issueVisa\/request\/783/i.test(input.url)) {
    return { checkpoint: "wrong_product", message: "ICP opened a visa transaction other than transaction 783." };
  }
  return { checkpoint: "selector_drift", message: "ICP transaction 783 page state is not recognized." };
}

/** Upload only through selectors captured from an authorized transaction-783 session. */
export async function uploadAeDocuments(input: {
  page: Page;
  paths: Partial<Record<AeDocumentKey, string>>;
  selectors: Partial<Record<AeDocumentKey, string>>;
  requiredKeys: readonly AeDocumentKey[];
}): Promise<void> {
  requireOfficialAePortalUrl(input.page.url(), "document upload");
  for (const key of input.requiredKeys) {
    requireOfficialAePortalUrl(input.page.url(), `document upload (${key})`);
    const filePath = input.paths[key];
    const selector = input.selectors[key];
    if (!filePath) throw new Error(`ICP transaction 783 is missing local document ${key}`);
    if (!selector) throw new Error(`ICP transaction 783 has no verified upload selector for ${key}`);
    const control = input.page.locator(selector);
    if ((await control.count()) !== 1) throw new Error(`ICP transaction 783 ${key} upload selector drift`);
    await control.setInputFiles(filePath);
    requireOfficialAePortalUrl(input.page.url(), `document upload transition (${key})`);
    const fileCount = await control.evaluate((element) => (element as HTMLInputElement).files?.length ?? 0);
    if (fileCount !== 1) throw new Error(`ICP transaction 783 ${key} was not attached`);
  }
}
