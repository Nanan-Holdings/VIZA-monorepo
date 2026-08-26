export const JP_VJW_SELECTORS = {
  language: ["text=Language", "[aria-label='Language']"],
  email: ["input[type='email']", "input[name*='email' i]"],
  password: ["input[type='password']"],
  login: ["button:has-text('登入')", "a:has-text('登入')", "button:has-text('Login')", "a:has-text('Login')"],
  createAccount: [
    "button:has-text('创建新账号')",
    "a:has-text('创建新账号')",
    "button:has-text('Create new account')",
    "a:has-text('Create new account')",
    "button:has-text('Create an account')",
    "a:has-text('Create an account')",
    "button:has-text('新規アカウント作成')",
    "a:has-text('新規アカウント作成')",
  ],
  fullName: ["input[name*='name' i]", "input[id*='name' i]"],
  passportNumber: ["input[name*='passport' i]", "input[id*='passport' i]"],
  dateOfBirth: ["input[type='date']", "input[name*='birth' i]", "input[id*='birth' i]"],
  arrivalDate: ["input[name*='arrival' i]", "input[id*='arrival' i]"],
  qr: ["canvas", "img[alt*='QR' i]", "img[src*='qr' i]", "[data-testid*='qr' i]"],
} as const;

export const JP_VJW_CREATE_ACCOUNT_NAME =
  /创建新账号|创建账号|Create (?:new|an) account|新規アカウント作成|アカウントを作成/i;

export const JP_VJW_ACCOUNT_CREATED_NAME =
  /账号已成功创建|帳號已成功建立|Your account has been successfully created|アカウントの作成が完了/i;

export const JP_VJW_GO_TO_LOGIN_NAME =
  /前往登录画面|前往登入畫面|Go To Login Screen|ログイン画面へ/i;

export const JP_VJW_YOUR_DETAILS_NAME =
  /您的资料|您的資料|Your details|本人の情報/i;

export const JP_VJW_OPTIONAL_MFA_HEADING =
  /设置多因素认证|設定多因素驗證|Setting up Multi[-‐‑‒–—―\s]*Factor Authentication|多要素認証の設定/i;

export const JP_VJW_OPTIONAL_MFA_QUESTION =
  /是否设置多因素认证|是否設定多因素驗證|Do you want to set up multi[-‐‑‒–—―\s]*factor authentication\??|多要素認証を設定しますか/i;

export const JP_VJW_MFA_NO_NAME = /^(?:否|No|いいえ)$/i;

export const JP_VJW_JAPANESE_PASSPORT_QUESTION =
  /日本政府签发的护照|日本政府簽發的護照|passport issued by the Japanese government|日本国政府発行の旅券/i;

export const JP_VJW_REENTRY_PERMISSION_QUESTION =
  /再入境许可|再入境許可|re[-‐‑‒–—―\s]*entry permission|再入国許可/i;

export const JP_VJW_TAX_FREE_QR_QUESTION =
  /免税二维码|免稅二維碼|tax[-‐‑‒–—―\s]*free QR|免税QR/i;

export const JP_VJW_MANUAL_PASSPORT_NAME =
  /自行输入|自行輸入|手动输入|手動輸入|Enter information yourself|Enter manually|自分で入力/i;

export const JP_VJW_PROFILE_COMPLETE_NAME =
  /登记完成|登記完成|Registration complete|登録完了/i;

export const JP_VJW_CONFIRM_ENTERED_DETAILS_NAME =
  /确认输入的详细信息|確認輸入的詳細資訊|Confirm entered details|入力内容の確認/i;

export const JP_VJW_NEW_TRIP_NAME =
  /登记新的入境.*回国计划|登記新的入境.*回國計劃|Register new planned entry.*return|New registration|新規登録/i;

export const JP_VJW_NO_COPY_TRIP_NAME =
  /不复制.*继续登记|不複製.*繼續登記|Proceed to registration without copying details|引き継がずに登録を進める/i;

export const JP_VJW_TRIP_REGISTERED_NAME =
  /已登记.*入境.*回国计划|已登記.*入境.*回國計劃|Registered planned entry\/return|入国・帰国予定を登録しました|入国・帰国予定の登録が完了しました/i;

export const JP_VJW_TO_ENTRY_PROCEDURE_NAME =
  /前往入境.*回国手续|前往入境.*回國手續|To entry\/return procedure|入国・帰国手続へ/i;

export const JP_VJW_NEXT_NAME = /^(?:下一步|Next|次へ)$/i;

export const JP_VJW_DECLARATION_COMPLETE_NAME =
  /登记完成|登記完成|Registration complete|登録完了/i;

export const JP_VJW_BACK_TO_ENTRY_PROCEDURE_NAME =
  /返回入境.*回国手续|返回入境.*回國手續|Back to Entry\/Return Procedure|入国・帰国手続に戻る/i;

export const JP_VJW_DECLARATION_NOT_REGISTERED_NAME =
  /未登记|未登記|Not registered|未登録/i;

export const JP_VJW_DECLARATION_REGISTERED_NAME =
  /已登记|已登記|Registered|登録済み|登録済/i;

export function isJpVjwDeclarationRegistered(value: string): boolean {
  return !JP_VJW_DECLARATION_NOT_REGISTERED_NAME.test(value)
    && JP_VJW_DECLARATION_REGISTERED_NAME.test(value);
}

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
  return /visit\s+japan\s+web|入国(?:・|＆|&)税関申告|入境审查.*海关申报|入境審查.*海關申報|qr\s*(?:code|コード|码|碼)/iu.test(input.bodyText);
}

export function normalizeJpVjwBodyText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 2_000);
}
