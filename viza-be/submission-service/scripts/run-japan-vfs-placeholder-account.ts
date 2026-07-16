import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { extractAuto } from "../src/inbox/extractors";
import { inbox } from "../src/inbox/wait-for-message";
import { encryptSecret } from "../src/secret-cipher";
import { supabase } from "../src/supabase";

const applicationId = process.argv.find((value) => value.startsWith("--application-id="))?.split("=")[1];
if (!applicationId) throw new Error("--application-id is required.");

async function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 15_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out because the remote browser session stopped responding.`)), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
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
    const reject = cloud.page.getByRole("button", { name: /reject|decline|necessary only|accept only necessary/i }).first();
    if (await reject.isVisible({ timeout: 1_000 }).catch(() => false)) await reject.click();
    const bodyBefore = await cloud.page.locator("body").innerText().catch(() => "");
    if (/Temporary Connectivity Issue|Session Expired or Invalid|Access Denied/i.test(bodyBefore)) throw new Error("Browserbase reached an official VFS error page before registration.");
    try {
      await withTimeout((async () => {
        await cloud.page.locator("#inputEmail").fill(alias);
        await cloud.page.locator("#password").fill(password);
        await cloud.page.locator("#confirmPassword").fill(password);
        const mobile = cloud.page.locator("#mat-input-3");
        if (await mobile.isVisible({ timeout: 750 }).catch(() => false)) await mobile.fill("90000000");
        const dial = cloud.page.locator("mat-select").first();
        if (await dial.isVisible({ timeout: 750 }).catch(() => false)) {
          await dial.click();
          const singapore = cloud.page.getByRole("option", { name: /Singapore.*\+65/i }).first();
          if (await singapore.isVisible({ timeout: 2_000 }).catch(() => false)) await singapore.click();
        }
        const registrationConsents = cloud.page.locator("main input[id^='mat-mdc-checkbox-']");
        for (let index = 0; index < await registrationConsents.count(); index += 1) {
          const checkbox = registrationConsents.nth(index);
          const text = await checkbox.locator("xpath=ancestor::mat-checkbox[1]").innerText().catch(() => "");
          if (/marketing|promotion|offers|newsletter/i.test(text)) continue;
          await checkbox.locator("xpath=ancestor::mat-checkbox[1]").click({ force: true });
        }
        await cloud.page.waitForTimeout(4_000);
      })(), "VFS registration interaction");
      console.log("[jp-vfs-account] placeholder fields filled");
    } catch (fillError) {
      const controls = await cloud.page.locator("input,select,[role='combobox']").evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName.toLowerCase(), type: element.getAttribute("type"), name: element.getAttribute("name"),
        id: element.id || null, placeholder: element.getAttribute("placeholder"), ariaLabel: element.getAttribute("aria-label"),
      })));
      throw new Error(`${fillError instanceof Error ? fillError.message : String(fillError)} controls=${JSON.stringify(controls)}`);
    }
    await cloud.page.screenshot({ path: path.join(artifactDir, "before-continue-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    const readiness = await cloud.page.evaluate(() => ({
      inputs: [...document.querySelectorAll<HTMLInputElement>("main input")].filter((input) => input.type !== "hidden").map((input) => ({ id: input.id, type: input.type, valid: input.validity.valid, checked: input.type === "checkbox" ? input.checked : undefined })),
      turnstileTokenPresent: Boolean((document.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")?.value ?? "").trim()),
      invalidMessages: [...document.querySelectorAll<HTMLElement>("mat-error,.mat-mdc-form-field-error")].map((element) => element.innerText.trim()).filter(Boolean),
    }));
    console.log(`[jp-vfs-account] readiness=${JSON.stringify(readiness)}`);
    const continueButton = cloud.page.getByRole("button", { name: /^continue$/i });
    await withTimeout(continueButton.click({ timeout: 8_000 }), "VFS registration Continue click", 12_000);
    console.log("[jp-vfs-account] Continue clicked");
    await cloud.page.waitForTimeout(3_000);
    const bodyAfter = await cloud.page.locator("body").innerText().catch(() => "");
    const accepted = /verify|verification|activate|check your email|success|account.*created|already registered|already exists/i.test(bodyAfter);
    if (!accepted) throw new Error(`VFS did not show an accepted registration state: ${bodyAfter.replace(/\s+/g, " ").slice(0, 180)}`);
    let emailVerified = false;
    let status = /already registered|already exists/i.test(bodyAfter) ? "existing_account" : "email_verification_required";
    if (!/already registered|already exists/i.test(bodyAfter)) {
      const message = await inbox.waitForMessage(application.applicant_id, (candidate) => /vfsglobal\.com|vfshelpzone\.com/i.test(candidate.from_addr), 120_000, { since: startedAt, includeProcessed: true }).catch(() => null);
      if (message) {
        const parsed = extractAuto({ from: message.from_addr, subject: message.subject, text: message.text, html: message.html });
        if (parsed.link) {
          await cloud.page.goto(parsed.link, { waitUntil: "domcontentloaded", timeout: 90_000 });
          await cloud.page.waitForTimeout(2_000);
          const activationText = await cloud.page.locator("body").innerText().catch(() => "");
          emailVerified = !/invalid|expired|failed/i.test(activationText);
          status = emailVerified ? "registered" : "email_verification_required";
        }
      }
    }
    const payload = {
      user_id: authUserId, application_id: applicationId, country_code: "JP", portal: "vfs_japan_sg",
      account_email: alias, encrypted_account_password: encryptSecret(password), account_status: status,
      email_verified: emailVerified, metadata_redacted_json: { placeholderAccountTest: true, phone: "+65******00", browserbaseProxy: true }, updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("appointment_accounts").select("id").eq("application_id", applicationId).eq("portal", "vfs_japan_sg").maybeSingle();
    const write = existing?.id ? await supabase.from("appointment_accounts").update(payload).eq("id", existing.id) : await supabase.from("appointment_accounts").insert(payload);
    if (write.error) throw new Error(`Test account persistence failed: ${write.error.message}`);
    await cloud.page.screenshot({ path: path.join(artifactDir, "after-continue-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    console.log(JSON.stringify({ ok: true, submittedRegistration: true, emailVerified, accountStatus: status, browserbaseProxy: cloud.proxiesEnabled, replayAvailable: Boolean(cloud.replayUrl) }));
  } finally { await cloud.browser.close().catch(() => undefined); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
