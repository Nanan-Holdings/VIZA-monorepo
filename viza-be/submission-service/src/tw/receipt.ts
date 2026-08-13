import type { Page } from "@playwright/test";

export type TwOfficialReceiptEvidenceSource =
  | "official_success_page_with_application_number";

export interface TwOfficialReceiptEvidence {
  source: TwOfficialReceiptEvidenceSource;
  capturedAt: string;
  portalUrl: string;
  caseNumber: string;
  confirmationText?: string;
}

const CASE_NUMBER_PATTERNS = [
  /(?:申請案號|申請編號|送件編號|收件編號|案件編號|案號|申請號碼|收件號碼)\s*[:：]?\s*([A-Z0-9-]{8,32})/i,
  /(?:Application|Case|Receipt|Reference)\s*(?:No\.?|Number|ID)?\s*[:：#]?\s*([A-Z0-9-]{8,32})/i,
];

const CONFIRMATION_PATTERNS = [
  /申請(?:資料)?(?:已)?(?:送出|提交)成功/,
  /(?:送件|收件)(?:成功|完成)/,
  /(?:Application|Submission)\s+(?:submitted|received)\s+successfully/i,
];

const NEGATIVE_PATTERNS = [
  /驗證碼|captcha/i,
  /請輸入/,
  /錯誤|失敗|不正確/,
];

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseTwOfficialReceiptEvidence(
  text: string,
  portalUrl: string,
  capturedAt = new Date().toISOString(),
): TwOfficialReceiptEvidence | null {
  const normalized = normalizeSpace(text);
  if (!normalized) return null;

  const hasConfirmation = CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasNegative = NEGATIVE_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hasConfirmation || hasNegative) return null;

  for (const pattern of CASE_NUMBER_PATTERNS) {
    const match = pattern.exec(normalized);
    const caseNumber = match?.[1]?.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
    if (caseNumber && caseNumber.length >= 8) {
      return {
        source: "official_success_page_with_application_number",
        capturedAt,
        portalUrl,
        caseNumber,
        confirmationText: normalized.slice(0, 240),
      };
    }
  }

  return null;
}

export async function readTwOfficialReceiptEvidence(page: Page): Promise<TwOfficialReceiptEvidence | null> {
  const body = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  return parseTwOfficialReceiptEvidence(body, page.url());
}
