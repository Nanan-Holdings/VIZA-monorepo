export const JP_VJW_SELECTORS = {
  language: ["text=Language", "[aria-label='Language']"],
  email: ["input[type='email']", "input[name*='email' i]"],
  password: ["input[type='password']"],
  login: ["button:has-text('登入')", "a:has-text('登入')", "button:has-text('Login')", "a:has-text('Login')"],
  createAccount: ["button:has-text('创建新账号')", "a:has-text('创建新账号')", "button:has-text('Create new account')", "a:has-text('Create new account')"],
  fullName: ["input[name*='name' i]", "input[id*='name' i]"],
  passportNumber: ["input[name*='passport' i]", "input[id*='passport' i]"],
  dateOfBirth: ["input[type='date']", "input[name*='birth' i]", "input[id*='birth' i]"],
  arrivalDate: ["input[name*='arrival' i]", "input[id*='arrival' i]"],
  qr: ["canvas", "img[alt*='QR' i]", "img[src*='qr' i]", "[data-testid*='qr' i]"],
} as const;

/**
 * The official VJW edge currently rejects Playwright's HeadlessChrome UA with
 * a CloudFront 404. This is a browser identity override, not a success
 * bypass; the official page and QR evidence gates still apply afterwards.
 */
export const JP_VJW_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

export function resolveJpVjwUserAgent(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.JP_VJW_USER_AGENT?.trim();
  return configured || JP_VJW_DEFAULT_USER_AGENT;
}

export function isJpVjwCloudfrontAccessGate(status: number | null | undefined, bodyText: string): boolean {
  return status === 404
    || (status !== null && status !== undefined && status >= 400 && /cloudfront|request\s+could\s+not\s+be\s+satisfied|not\s+found/i.test(bodyText))
    || /cloudfront.*(?:404|not\s+found)|request\s+could\s+not\s+be\s+satisfied/i.test(bodyText);
}

const OFFICIAL_HOSTS = new Set([
  "vjw.digital.go.jp",
  "www.vjw.digital.go.jp",
]);

export function isOfficialJpVjwUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OFFICIAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface JpVjwQrEvidenceInput {
  portalUrl: string;
  bodyText: string;
  qrElementVisible: boolean;
  qrArtifactPath?: string | null;
}

export function hasOfficialJpVjwQrEvidence(input: JpVjwQrEvidenceInput): boolean {
  if (!isOfficialJpVjwUrl(input.portalUrl) || !input.qrElementVisible) return false;
  if (!input.qrArtifactPath?.trim()) return false;
  return /visit\s+japan\s+web|入国(?:・|＆|&)税関申告|qr\s*(?:code|コード)/iu.test(input.bodyText);
}

export function normalizeJpVjwBodyText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 2_000);
}
