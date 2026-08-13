import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Page } from "@playwright/test";

export interface TwContractFixture {
  capturedAt: string;
  phase: string;
  urlPath: string;
  title: string;
  visibleControls: Array<{ name: string; type: string; tag: string; options?: Array<{ value: string; labelKind: string }> }>;
  modalHeadings: string[];
  validationKeys: string[];
  emailStructureKinds: string[];
  error: string;
}

export async function writeTwContractFixture(input: {
  page: Page;
  outputDir?: string;
  runId?: string;
  phase: string;
  error: unknown;
}): Promise<string | undefined> {
  const outputDir = input.outputDir ?? path.join(os.tmpdir(), "viza-tw-contract-fixtures");
  const fixture = await buildTwContractFixture(input.page, input.phase, input.error);
  await fs.mkdir(outputDir, { recursive: true });
  const safeRunId = (input.runId ?? `tw-${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
  const filePath = path.join(outputDir, `${safeRunId}-${input.phase}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  return filePath;
}

async function buildTwContractFixture(page: Page, phase: string, error: unknown): Promise<TwContractFixture> {
  const [title, visibleControls, modalHeadings, validationKeys, emailStructureKinds] = await Promise.all([
    page.title().catch(() => ""),
    page.locator("input:not([type='hidden']), select, textarea")
      .evaluateAll((nodes) => nodes.map((node) => {
        const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const options = el.tagName.toLowerCase() === "select"
          ? Array.from((el as HTMLSelectElement).options).slice(0, 30).map((option: HTMLOptionElement) => ({
              value: option.value,
              labelKind: classifyOptionLabel(option.textContent ?? ""),
            }))
          : undefined;
        return {
          name: el.getAttribute("name") ?? el.id ?? "",
          type: el.getAttribute("type") ?? el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          ...(options ? { options } : {}),
        };
      }).filter((item) => item.name).slice(0, 120))
      .catch(() => []),
    page.locator('[role="dialog"]:visible, .modal:visible, .modal-dialog:visible, .modal-content:visible')
      .evaluateAll((nodes) => nodes.map((node) => classifyModal((node.textContent ?? "").replace(/\s+/g, " ").trim())).filter(Boolean).slice(0, 20))
      .catch(() => []),
    page.locator(".invalid-feedback:visible, .text-danger:visible, .error:visible, [role='alert']:visible")
      .evaluateAll((nodes) => nodes.map((node) => classifyValidation((node.textContent ?? "").replace(/\s+/g, " ").trim())).filter(Boolean).slice(0, 60))
      .catch(() => []),
    page.locator("body").innerText({ timeout: 2_000 }).then(classifyEmailStructureKinds).catch(() => []),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    phase,
    urlPath: safePath(page.url()),
    title: redactText(title),
    visibleControls,
    modalHeadings: modalHeadings.length ? [...new Set(modalHeadings)] : [],
    validationKeys: validationKeys.length ? [...new Set(validationKeys)] : [],
    emailStructureKinds,
    error: error instanceof Error ? error.message : String(error),
  };
}

function classifyModal(text: string): string {
  if (/同意上述條款|同意上述条款/.test(text)) return "terms";
  if (/照片規格|照片规格/.test(text)) return "photo_spec";
  if (/驗證碼|验证码|captcha/i.test(text)) return "captcha_or_otp";
  if (/登入|登录|密碼|密码/.test(text)) return "login";
  return text ? "unknown_modal" : "";
}

function classifyValidation(text: string): string {
  if (/必填|required|請輸入|請選擇|请选择/i.test(text)) return "required";
  if (/驗證碼|验证码|captcha/i.test(text)) return "captcha";
  if (/錯誤|错误|不正確|invalid/i.test(text)) return "invalid";
  return text ? "unknown" : "";
}

function classifyEmailStructureKinds(text: string): string[] {
  const kinds = new Set<string>();
  if (/e-?mail|電子郵件|电子邮件/i.test(text)) kinds.add("email_field");
  if (/寄送驗證碼|寄送验证码/.test(text)) kinds.add("send_code_control");
  if (/verifyCode|驗證碼|验证码/i.test(text)) kinds.add("verification_code_control_or_text");
  if (/captchaToken|請輸入驗證碼|captcha/i.test(text)) kinds.add("captcha_control_or_text");
  return [...kinds];
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function redactText(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").slice(0, 160);
}

function classifyOptionLabel(text: string): string {
  const normalized = text.replace(/\s+/g, "").trim();
  if (!normalized) return "blank";
  if (/請選擇|请选择/.test(normalized)) return "placeholder";
  if (/^[\u4e00-\u9fff]{2,8}[市縣县區区鎮镇鄉乡]$/.test(normalized)) return "tw_admin_area";
  if (/^[A-Za-z0-9_-]{1,12}$/.test(normalized)) return "code";
  return "other";
}
