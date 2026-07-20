import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import { extractAuto } from "../src/inbox/extractors";
import { inbox } from "../src/inbox/wait-for-message";
import { encryptSecret } from "../src/secret-cipher";
import { supabase } from "../src/supabase";

const applicationId = process.argv.find((value) => value.startsWith("--application-id="))?.split("=")[1];
if (!applicationId) throw new Error("--application-id is required.");
const activationAlreadyConsumed = process.argv.includes("--activation-already-consumed");

type CloudPage = Awaited<ReturnType<typeof connectBrowserbaseCloudBrowser>>["page"];

async function clickVisible(page: CloudPage, labels: RegExp): Promise<boolean> {
  for (const locator of [
    page.getByRole("button", { name: labels }).first(),
    page.getByRole("link", { name: labels }).first(),
    page.getByText(labels).first(),
  ]) {
    if (!await locator.isVisible({ timeout: 1_500 }).catch(() => false)) continue;
    if (await locator.evaluate((element) => {
      (element as HTMLElement).click();
      return true;
    }).catch(() => false)) return true;
  }
  return false;
}

async function waitForTurnstile(page: CloudPage): Promise<void> {
  if (!await page.locator("input[name='cf-turnstile-response']").count()) return;
  await page.waitForFunction(() => {
    const token = document.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")?.value ?? "";
    return token.trim().length > 0;
  }, undefined, { timeout: 35_000 });
}

async function main(): Promise<void> {
  process.env.JP_VFS_SG_BROWSERBASE_ENABLED = "true";
  process.env.JP_VFS_SG_BROWSERBASE_PROXIES = "true";
  process.env.JP_VFS_SG_BROWSERBASE_COUNTRY = "SG";
  process.env.JP_VFS_SG_BROWSERBASE_VERIFIED = "false";

  const { data: application, error } = await supabase.from("applications")
    .select("applicant_id,applicant_profiles!inner(auth_user_id,inbox_alias)")
    .eq("id", applicationId)
    .single();
  if (error || !application?.applicant_id) throw new Error(`Application lookup failed: ${error?.message ?? "missing application"}`);
  const profileValue = Array.isArray(application.applicant_profiles) ? application.applicant_profiles[0] : application.applicant_profiles;
  const profile = profileValue as { auth_user_id?: string; inbox_alias?: string };
  if (!profile.auth_user_id || !profile.inbox_alias) throw new Error("The application has no VIZA inbox alias.");

  let activationLink: string | undefined;
  if (!activationAlreadyConsumed) {
    const welcome = await inbox.waitForMessage(
      application.applicant_id,
      (message) => /vfsglobal\.com|vfshelpzone\.com/i.test(message.from_addr) && /welcome|activate|registration/i.test(message.subject ?? ""),
      5_000,
      { since: new Date(Date.now() - 30 * 60_000).toISOString(), includeProcessed: true, markProcessed: false },
    );
    activationLink = extractAuto({ from: welcome.from_addr, subject: welcome.subject, text: welcome.text, html: welcome.html }).link;
    if (!activationLink) throw new Error("The VFS welcome email did not contain an activation link.");
  }

  const artifactDir = path.resolve("artifacts", "jp-vfs-sg-account-recovery");
  fs.mkdirSync(artifactDir, { recursive: true });
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: "JP_VFS_SG" });
  const browserDiagnostics: Array<Record<string, unknown>> = [];
  const safeResource = (rawUrl: string): { host: string; path: string } => {
    try {
      const parsed = new URL(rawUrl);
      return { host: parsed.host, path: parsed.pathname };
    } catch {
      return { host: "invalid", path: "" };
    }
  };
  cloud.page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch" && response.status() < 400) return;
    browserDiagnostics.push({ kind: "response", status: response.status(), resourceType, ...safeResource(response.url()) });
  });
  cloud.page.on("requestfailed", (request) => {
    browserDiagnostics.push({ kind: "requestfailed", resourceType: request.resourceType(), error: request.failure()?.errorText?.slice(0, 120), ...safeResource(request.url()) });
  });
  cloud.page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    browserDiagnostics.push({ kind: "console", level: message.type(), message: message.text().slice(0, 180) });
  });
  console.log("[jp-vfs-recovery] Browserbase Singapore proxy connected");
  try {
    if (!activationAlreadyConsumed) {
      await cloud.page.goto(activationLink!.replace(/&amp;/g, "&"), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await cloud.page.waitForTimeout(2_500);
      const activationText = await cloud.page.locator("body").innerText().catch(() => "");
      if (/invalid|expired|activation failed/i.test(activationText)) throw new Error("VFS rejected the account activation link.");
      await cloud.page.screenshot({ path: path.join(artifactDir, "activation-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
      console.log("[jp-vfs-recovery] activation link accepted");
    } else {
      console.log("[jp-vfs-recovery] activation link was already consumed");
    }

    console.log("[jp-vfs-recovery] continuing in the same Browserbase session");
    const portalBase = "https://visa.vfsglobal.com/sgp/en/jpn";
    await cloud.page.goto(`${portalBase}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cloud.page.waitForTimeout(1_000);
    await cloud.page.goto(`${portalBase}/apply-visa`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cloud.page.waitForTimeout(1_000);
    await cloud.page.goto(`${portalBase}/book-an-appointment`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cloud.page.waitForTimeout(1_000);
    await cloud.page.goto(`${portalBase}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const necessary = cloud.page.getByRole("button", { name: /^Accept Only Necessary$/i });
    if (await necessary.isVisible({ timeout: 1_500 }).catch(() => false)) await necessary.evaluate((element) => (element as HTMLElement).click());
    try {
      await cloud.page.getByLabel("Email*", { exact: true }).waitFor({ state: "visible", timeout: 60_000 });
    } catch {
      await cloud.page.screenshot({ path: path.join(artifactDir, "login-timeout-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
      console.log(`[jp-vfs-recovery] login diagnostics=${JSON.stringify(browserDiagnostics.slice(-80))}`);
      throw new Error("VFS login component did not render before timeout.");
    }
    await cloud.page.screenshot({ path: path.join(artifactDir, "login-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    if (!await clickVisible(cloud.page, /forgot.*password/i)) {
      const controls = await cloud.page.locator("a,button").evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
        visible: Boolean((element as HTMLElement).offsetWidth || (element as HTMLElement).offsetHeight),
      })).filter((control) => control.visible));
      throw new Error(`VFS forgot-password entry was not found. controls=${JSON.stringify(controls)}`);
    }
    await cloud.page.waitForTimeout(1_500);

    const email = cloud.page.getByLabel(/email/i).first();
    await email.fill(profile.inbox_alias);
    await waitForTurnstile(cloud.page);
    const resetRequestedAt = new Date().toISOString();
    if (!await clickVisible(cloud.page, /submit|continue|reset|send/i)) throw new Error("VFS reset-password submit control was not found.");
    await cloud.page.waitForTimeout(2_000);
    const resetRequestText = await cloud.page.locator("body").innerText().catch(() => "");
    if (/invalid|failed|not found/i.test(resetRequestText)) throw new Error("VFS rejected the password-reset request.");
    console.log("[jp-vfs-recovery] password reset email requested");

    const resetMessage = await inbox.waitForMessage(
      application.applicant_id,
      (message) => /vfsglobal\.com|vfshelpzone\.com/i.test(message.from_addr) && !/welcome/i.test(message.subject ?? ""),
      120_000,
      { since: resetRequestedAt, includeProcessed: true },
    );
    const reset = extractAuto({ from: resetMessage.from_addr, subject: resetMessage.subject, text: resetMessage.text, html: resetMessage.html });
    if (!reset.link) throw new Error("The VFS password-reset email did not contain a reset link.");

    await cloud.page.goto(reset.link.replace(/&amp;/g, "&"), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cloud.page.waitForTimeout(2_000);
    const newPassword = `V!zaT9${randomBytes(6).toString("hex")}`;
    const passwordInputs = cloud.page.locator("input[type='password']");
    if (await passwordInputs.count() < 2) throw new Error("VFS password-reset fields were not found.");
    await passwordInputs.nth(0).fill(newPassword);
    await passwordInputs.nth(1).fill(newPassword);
    await waitForTurnstile(cloud.page);
    if (!await clickVisible(cloud.page, /submit|continue|reset|save/i)) throw new Error("VFS password-reset confirmation control was not found.");
    await cloud.page.waitForTimeout(3_000);
    const resetResult = await cloud.page.locator("body").innerText().catch(() => "");
    if (/invalid|expired|failed|do not match/i.test(resetResult)) throw new Error("VFS did not accept the new account password.");
    if (!/success|login|password.*(?:changed|reset|updated)/i.test(resetResult) && !/\/login(?:\?|$)/i.test(cloud.page.url())) {
      throw new Error(`VFS did not show a verified password-reset state: ${resetResult.replace(/\s+/g, " ").slice(0, 180)}`);
    }

    const payload = {
      user_id: profile.auth_user_id,
      application_id: applicationId,
      country_code: "JP",
      portal: "vfs_japan_sg",
      account_email: profile.inbox_alias,
      encrypted_account_password: encryptSecret(newPassword),
      account_status: "registered",
      email_verified: true,
      metadata_redacted_json: { aliasManagedByViza: true, browserbaseProxy: true, recoveredAfterOtpRegistration: true },
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("appointment_accounts")
      .select("id").eq("application_id", applicationId).eq("portal", "vfs_japan_sg").maybeSingle();
    const write = existing?.id
      ? await supabase.from("appointment_accounts").update(payload).eq("id", existing.id)
      : await supabase.from("appointment_accounts").insert(payload);
    if (write.error) throw new Error(`VFS account persistence failed: ${write.error.message}`);
    await cloud.page.screenshot({ path: path.join(artifactDir, "password-reset-redacted.png"), fullPage: true, mask: [cloud.page.locator("input")] });
    console.log(JSON.stringify({ ok: true, accountStatus: "registered", emailVerified: true, browserbaseProxy: cloud.proxiesEnabled, replayAvailable: Boolean(cloud.replayUrl) }));
  } finally {
    await cloud.browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
