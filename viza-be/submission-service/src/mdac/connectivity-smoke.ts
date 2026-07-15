import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createArrivalCardBrowserSession } from "../arrival-card-browser";
import { MDAC_OFFICIAL_PORTAL_URL } from "./normalize";

async function main(): Promise<void> {
  const session = await createArrivalCardBrowserSession({ prefix: "MDAC", headless: true });
  const evidenceDir = process.env.MDAC_CONNECTIVITY_EVIDENCE_DIR
    ? path.resolve(process.env.MDAC_CONNECTIVITY_EVIDENCE_DIR)
    : fs.mkdtempSync(path.join(os.tmpdir(), "viza-mdac-connectivity-"));
  fs.mkdirSync(evidenceDir, { recursive: true });
  try {
    await session.page.goto(MDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await session.page.waitForTimeout(3_000);
    const text = await session.page.locator("body").innerText().catch(() => "");
    const blocked = /web page blocked|url you requested has been blocked|attack id/i.test(text);
    const captcha = /captcha|slider|turnstile/i.test(text);
    const register = session.page.locator("a[href*='registerMain'], a, button", { hasText: /register|registration/i }).first();
    const registrationEntryVisible = await register.isVisible().catch(() => false);
    const landing = path.join(evidenceDir, "mdac-landing.png");
    await session.page.screenshot({ path: landing, fullPage: true });
    console.log(JSON.stringify({ provider: session.provider, blocked, captcha, registrationEntryVisible, screenshots: [landing] }, null, 2));
  } finally {
    await session.close();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
