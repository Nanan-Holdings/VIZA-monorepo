import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { extractAuto } from "../src/inbox/extractors";
import { inbox } from "../src/inbox/wait-for-message";
import { loadCanonicalAnswers } from "../src/queue/answers";
import { encryptSecret } from "../src/secret-cipher";
import { supabase } from "../src/supabase";

const applicationId = process.argv.find((value) => value.startsWith("--application-id="))?.split("=")[1];
if (!applicationId) throw new Error("--application-id is required.");
const phoneArgument = process.argv.find((value) => value.startsWith("--phone="))?.split("=")[1]?.replace(/\D/g, "");
const otpPortValue = process.argv.find((value) => value.startsWith("--otp-port="))?.split("=")[1];
const otpPort = otpPortValue ? Number.parseInt(otpPortValue, 10) : undefined;
if (otpPort !== undefined && (!Number.isInteger(otpPort) || otpPort < 1024 || otpPort > 65_535)) {
  throw new Error("--otp-port must be an integer between 1024 and 65535.");
}

async function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 15_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out because the remote browser session stopped responding.`)), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

async function waitForOtpOnLocalPort(port: number): Promise<string> {
  let settle: ((otp: string) => void) | undefined;
  const otpPromise = new Promise<string>((resolve) => {
    settle = resolve;
  });
  const server = createServer((request, response) => {
    if (request.socket.remoteAddress !== "127.0.0.1" && request.socket.remoteAddress !== "::1") {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== "POST" || request.url !== "/otp") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      if (body.length < 1_024) body += chunk;
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body) as { otp?: unknown };
        if (typeof payload.otp !== "string" || !/^\d{4,8}$/.test(payload.otp)) {
          response.writeHead(400).end();
          return;
        }
        response.writeHead(204).end();
        settle?.(payload.otp);
        settle = undefined;
      } catch {
        response.writeHead(400).end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`[jp-vfs-account] SMS OTP checkpoint ready on localhost port ${port}`);
  try {
    return await withTimeout(otpPromise, "VFS SMS OTP input", 270_000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main(): Promise<void> {
  process.env.JP_VFS_SG_BROWSERBASE_ENABLED = "true";
  process.env.JP_VFS_SG_BROWSERBASE_PROXIES = "true";
  process.env.JP_VFS_SG_BROWSERBASE_COUNTRY = "SG";
  process.env.JP_VFS_SG_BROWSERBASE_VERIFIED = process.argv.includes("--verified") ? "true" : "false";
  const { data: application, error } = await supabase.from("applications")
    .select("applicant_id,applicant_profiles!inner(auth_user_id)").eq("id", applicationId).single();
  if (error || !application?.applicant_id) throw new Error(`Test application lookup failed: ${error?.message ?? "missing applicant"}`);
  const profileValue = Array.isArray(application.applicant_profiles) ? application.applicant_profiles[0] : application.applicant_profiles;
  const authUserId = (profileValue as { auth_user_id?: string } | null)?.auth_user_id;
  if (!authUserId) throw new Error("Test application has no auth user.");
  const answers = await loadCanonicalAnswers(applicationId);
  const testPhone = (phoneArgument || answers.phone || answers.phone_number || answers.mobile || "")
    .replace(/^\+?65/, "")
    .replace(/\D/g, "");
  if (!testPhone) throw new Error("The application has no phone number for the real VFS SMS OTP.");
  const alias = (await ensureApplicantInboxAlias(application.applicant_id)).alias;
  const password = `V!zaT9${randomBytes(4).toString("hex")}`;
  const startedAt = new Date().toISOString();
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: "JP_VFS_SG" });
  console.log("[jp-vfs-account] Browserbase Singapore proxy connected");
  const artifactDir = path.resolve("artifacts", "jp-vfs-sg-placeholder-account");
  fs.mkdirSync(artifactDir, { recursive: true });
  try {
    await cloud.page.goto("https://visa.vfsglobal.com/sgp/en/jpn/register", { waitUntil: "domcontentloaded", timeout: 90_000 });
    console.log("[jp-vfs-account] registration page loaded");
    await cloud.page.waitForTimeout(2_000);
    const cookieButtons = cloud.page.locator("#onetrust-consent-sdk button");
    const visibleCookieButtons: string[] = [];
    for (let index = 0; index < await cookieButtons.count(); index += 1) {
      const button = cookieButtons.nth(index);
      if (await button.isVisible().catch(() => false)) visibleCookieButtons.push((await button.innerText().catch(() => "")).replace(/\s+/g, " ").trim());
    }
    console.log(`[jp-vfs-account] visible cookie buttons=${JSON.stringify(visibleCookieButtons.filter(Boolean))}`);
    const necessary = cloud.page.getByRole("button", { name: /^Accept Only Necessary$/i });
    if (await necessary.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await necessary.evaluate((element) => element.click());
      await cloud.page.waitForTimeout(500);
    }
    const bodyBefore = await cloud.page.locator("body").innerText().catch(() => "");
    if (/Temporary Connectivity Issue|Session Expired or Invalid|Access Denied/i.test(bodyBefore)) throw new Error("Browserbase reached an official VFS error page before registration.");
    try {
      await withTimeout((async () => {
        await cloud.page.locator("#inputEmail").fill(alias);
        await cloud.page.locator("#password").fill(password);
        await cloud.page.locator("#confirmPassword").fill(password);
        const dial = cloud.page.locator("mat-select#mat-select-0");
        const fillMobileNumber = async (timeout: number): Promise<boolean> => {
          if (!await dial.waitFor({ state: "attached", timeout }).then(() => true).catch(() => false)) return false;
          await dial.evaluate((element) => element.click());
          console.log("[jp-vfs-account] dial opened");
          const options = cloud.page.locator("mat-option");
          await options.first().waitFor({ state: "attached", timeout: 5_000 });
          const optionLabels = (await options.allTextContents()).map((label) => label.replace(/\s+/g, " ").trim()).filter(Boolean);
          console.log(`[jp-vfs-account] dial options=${JSON.stringify(optionLabels)}`);
          if (!optionLabels.some((label) => /Singapore|\(?65\)?/i.test(label))) throw new Error("Singapore (+65) dial-code option is unavailable.");
          const singaporeOption = options.filter({ hasText: /Singapore|\(?65\)?/i }).first();
          await singaporeOption.evaluate((element) => (element as HTMLElement).click());
          await cloud.page.waitForFunction(() => /65/.test(
            document.querySelector("mat-select#mat-select-0")?.textContent ?? "",
          ), undefined, { timeout: 5_000 });
          console.log(`[jp-vfs-account] dial selected text=${JSON.stringify((await dial.innerText()).replace(/\s+/g, " ").trim())}`);
          const mobile = cloud.page.locator("#mat-input-3");
          await mobile.fill(testPhone, { force: true });
          return true;
        };
        let mobileNumberFilled = await fillMobileNumber(5_000);
        const registrationConsents = cloud.page.locator("main input[id^='mat-mdc-checkbox-']");
        for (let index = 0; index < await registrationConsents.count(); index += 1) {
          const checkbox = registrationConsents.nth(index);
          const text = await checkbox.locator("xpath=ancestor::mat-checkbox[1]").innerText().catch(() => "");
          if (/marketing|promotion|offers|newsletter/i.test(text)) continue;
          await checkbox.evaluate((element) => element.click());
        }
        if (!mobileNumberFilled) mobileNumberFilled = await fillMobileNumber(25_000);
        if (!mobileNumberFilled) console.log("[jp-vfs-account] current VFS registration form has no mobile-number step");
        await cloud.page.waitForTimeout(1_500);
        const delayedNecessary = cloud.page.getByRole("button", { name: /^Accept Only Necessary$/i });
        if (await delayedNecessary.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await delayedNecessary.evaluate((element) => (element as HTMLElement).click());
          await cloud.page.locator("#onetrust-consent-sdk").waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
        }
        await cloud.page.waitForFunction(() => {
          const token = document.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")?.value ?? "";
          return token.trim().length > 0;
        }, undefined, { timeout: 60_000 });
      })(), "VFS registration interaction", 120_000);
      console.log("[jp-vfs-account] placeholder fields filled");
    } catch (fillError) {
      await cloud.page.screenshot({
        path: path.join(artifactDir, "fill-error-redacted.png"),
        fullPage: true,
        mask: [cloud.page.locator("input")],
      });
      const controls = await cloud.page.locator("input,select,[role='combobox']").evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName.toLowerCase(), type: element.getAttribute("type"), name: element.getAttribute("name"),
        id: element.id || null, placeholder: element.getAttribute("placeholder"), ariaLabel: element.getAttribute("aria-label"),
      })));
      throw new Error(`${fillError instanceof Error ? fillError.message : String(fillError)} controls=${JSON.stringify(controls)}`);
    }
    await cloud.page.screenshot({ path: path.join(artifactDir, "before-continue-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    const readiness = await cloud.page.evaluate(() => ({
      inputs: [...document.querySelectorAll<HTMLInputElement>("main input")].filter((input) => input.type !== "hidden").map((input) => ({ id: input.id, type: input.type, valid: input.validity.valid, valueLength: input.type === "checkbox" ? undefined : input.value.length, validationMessage: input.validationMessage || undefined, checked: input.type === "checkbox" ? input.checked : undefined })),
      dialText: document.querySelector("mat-select")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      dialControls: [...document.querySelectorAll<HTMLElement>("select,[role='combobox'],mat-select")].map((element) => ({
        tag: element.tagName.toLowerCase(), id: element.id || null, role: element.getAttribute("role"),
        ariaLabel: element.getAttribute("aria-label"), text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
      })),
      turnstileTokenPresent: Boolean((document.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")?.value ?? "").trim()),
      invalidMessages: [...document.querySelectorAll<HTMLElement>("mat-error,.mat-mdc-form-field-error")].map((element) => element.innerText.trim()).filter(Boolean),
    }));
    console.log(`[jp-vfs-account] readiness=${JSON.stringify(readiness)}`);
    const cookieOverlay = cloud.page.locator("#onetrust-consent-sdk .onetrust-pc-dark-filter");
    if (await cookieOverlay.isVisible().catch(() => false)) {
      const confirmChoices = cloud.page.getByRole("button", { name: /^(Accept Only Necessary|Confirm My Choices|Save Settings)$/i });
      if (await confirmChoices.isVisible().catch(() => false)) await confirmChoices.evaluate((element) => element.click());
      await cookieOverlay.waitFor({ state: "hidden", timeout: 5_000 });
    }
    const continueButton = cloud.page.getByRole("button", { name: /^continue$/i });
    await withTimeout(continueButton.click({ timeout: 8_000 }), "VFS registration Continue click", 12_000);
    console.log("[jp-vfs-account] Continue clicked");
    await cloud.page.waitForTimeout(3_000);
    const bodyAfter = await cloud.page.locator("body").innerText().catch(() => "");
    const phoneOtpRequired = /OTP has been sent to your mobile number|one time password\s*\(OTP\).*mobile number/i.test(bodyAfter);
    const explicitlyExisting = /(?:email|account).{0,60}(?:already registered|already exists)/i.test(bodyAfter);
    const accepted = phoneOtpRequired || /verification|activate|check your email|account.*created/i.test(bodyAfter) || explicitlyExisting;
    if (!accepted) throw new Error(`VFS did not show an accepted registration state: ${bodyAfter.replace(/\s+/g, " ").slice(0, 180)}`);
    let emailVerified = false;
    let status = phoneOtpRequired ? "phone_otp_required" : explicitlyExisting ? "existing_account" : "email_verification_required";
    if (phoneOtpRequired) {
      console.log("[jp-vfs-account] SMS OTP required; waiting for a one-time code on stdin");
      const otpArgument = process.argv.find((value) => value.startsWith("--otp="))?.split("=")[1]?.trim();
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      let otp = otpArgument;
      try {
        if (!otp) {
          otp = otpPort
            ? await waitForOtpOnLocalPort(otpPort)
            : await withTimeout(prompt.question("VFS SMS OTP: "), "VFS SMS OTP input", 270_000);
        }
      } finally {
        prompt.close();
      }
      if (!/^\d{4,8}$/.test(otp ?? "")) throw new Error("VFS SMS OTP must contain 4 to 8 digits.");
      const otpInput = cloud.page.locator("input[autocomplete='one-time-code'], input[name*='otp' i], input[formcontrolname*='otp' i], input[placeholder*='otp' i]").first();
      const fallbackOtpInput = cloud.page.locator("main input[type='text']").first();
      const targetOtpInput = await otpInput.isVisible({ timeout: 1_500 }).catch(() => false) ? otpInput : fallbackOtpInput;
      await targetOtpInput.fill(otp);
      otp = undefined;
      await cloud.page.waitForFunction(() => {
        const token = document.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")?.value ?? "";
        return token.trim().length > 0;
      }, undefined, { timeout: 35_000 }).catch(() => undefined);
      const registerButton = cloud.page.getByRole("button", { name: /^register$/i });
      await registerButton.click({ timeout: 15_000 });
      await cloud.page.waitForTimeout(3_000);
      const registrationResult = await cloud.page.locator("body").innerText().catch(() => "");
      if (/invalid|incorrect|expired|failed/i.test(registrationResult)) throw new Error("VFS rejected or expired the SMS OTP.");
      if (/account.*created|registration.*successful|successfully registered/i.test(registrationResult) || /\/login(?:\?|$)/i.test(cloud.page.url())) {
        status = "registered";
      } else if (/registration has been completed|almost done|sent you an email/i.test(registrationResult)) {
        status = "email_verification_required";
      } else {
        throw new Error(`VFS did not show a verified account-registration state: ${registrationResult.replace(/\s+/g, " ").slice(0, 180)}`);
      }
    }
    if (status === "email_verification_required") {
      const message = await inbox.waitForMessage(application.applicant_id, (candidate) => /vfsglobal\.com|vfshelpzone\.com/i.test(candidate.from_addr), 120_000, { since: startedAt, includeProcessed: true }).catch(() => null);
      if (message) {
        const parsed = extractAuto({ from: message.from_addr, subject: message.subject, text: message.text, html: message.html });
        if (parsed.link) {
          await cloud.page.goto(parsed.link, { waitUntil: "domcontentloaded", timeout: 90_000 });
          const activationDeadline = Date.now() + 60_000;
          let activationText = "";
          let loginVisible = false;
          while (Date.now() < activationDeadline) {
            activationText = await cloud.page.locator("body").innerText().catch(() => "");
            loginVisible = await cloud.page.getByLabel("Email*", { exact: true }).isVisible({ timeout: 1_000 }).catch(() => false);
            if (loginVisible || /invalid|expired|failed|activat(?:ed|ion).{0,40}(?:success|complete)|successfully activated/i.test(activationText)) break;
            await cloud.page.waitForTimeout(2_000);
          }
          emailVerified = !/invalid|expired|failed/i.test(activationText)
            && (loginVisible || /activat(?:ed|ion).{0,40}(?:success|complete)|successfully activated/i.test(activationText));
          status = emailVerified ? "registered" : "account_activation_required";
        }
      }
    }
    const payload = {
      user_id: authUserId, application_id: applicationId, country_code: "JP", portal: "vfs_japan_sg",
      account_email: alias, encrypted_account_password: status === "existing_account" ? null : encryptSecret(password), account_status: status,
      email_verified: emailVerified, metadata_redacted_json: { placeholderAccountTest: true, phone: "+65******00", browserbaseProxy: true }, updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("appointment_accounts").select("id").eq("application_id", applicationId).eq("portal", "vfs_japan_sg").maybeSingle();
    const write = existing?.id ? await supabase.from("appointment_accounts").update(payload).eq("id", existing.id) : await supabase.from("appointment_accounts").insert(payload);
    if (write.error) throw new Error(`Test account persistence failed: ${write.error.message}`);
    await cloud.page.screenshot({ path: path.join(artifactDir, "after-continue-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    console.log(JSON.stringify({ ok: true, submittedRegistration: true, accountCreated: status === "registered", phoneOtpRequired, emailVerified, accountStatus: status, browserbaseProxy: cloud.proxiesEnabled, replayAvailable: Boolean(cloud.replayUrl) }));
  } finally { await cloud.browser.close().catch(() => undefined); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
