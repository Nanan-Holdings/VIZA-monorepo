/**
 * Diagnostic probe #2: inspect the post-CAPTCHA page (ConfirmApplicationID
 * / SecureQuestion). We need to see the heading, the Application ID, the
 * security-question dropdown options, and the continue button so we can
 * extend the orchestrator to handle this step.
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
config({ path: path.join(__dirname, "../../.env") });

import { startCeacSession } from "./session";

const OUT_DIR = path.join(__dirname, "../../diag-out");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const session = await startCeacSession({ headless: true, runId: "diag2" });
  try {
    const page = session.page;
    console.log(`[diag2] Landed at: ${page.url()}`);

    // Capture heading (h1, h2, h3)
    const headings = await page.evaluate(`
      (function() {
        var hs = document.querySelectorAll('h1, h2, h3');
        var out = [];
        for (var i = 0; i < hs.length; i++) out.push({ tag: hs[i].tagName, text: (hs[i].textContent || '').trim() });
        return out;
      })()
    `) as Array<{ tag: string; text: string }>;
    console.log("[diag2] Headings:", JSON.stringify(headings, null, 2));

    // Capture Application ID (usually in a label / span with "ApplicationID")
    const appIdCandidates = await page.evaluate(`
      (function() {
        var nodes = document.querySelectorAll('[id*="Application"], [id*="AppID"], [id*="applicationId" i]');
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          out.push({ id: n.id, tag: n.tagName, text: (n.textContent || '').trim().slice(0, 100) });
        }
        return out;
      })()
    `) as unknown[];
    console.log("[diag2] Application ID candidates:", JSON.stringify(appIdCandidates, null, 2));

    // Capture all selects (dropdowns) with their options
    const selects = await page.evaluate(`
      (function() {
        var ss = document.querySelectorAll('select');
        var out = [];
        for (var i = 0; i < ss.length; i++) {
          var s = ss[i];
          var opts = [];
          for (var j = 0; j < s.options.length && j < 30; j++) {
            opts.push({ value: s.options[j].value, text: s.options[j].text.trim() });
          }
          out.push({ id: s.id, name: s.name, optionCount: s.options.length, firstOpts: opts });
        }
        return out;
      })()
    `) as unknown[];
    console.log("[diag2] Selects:", JSON.stringify(selects, null, 2));

    // Capture all text inputs
    const inputs = await page.evaluate(`
      (function() {
        var ii = document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
        var out = [];
        for (var i = 0; i < ii.length; i++) {
          out.push({ id: ii[i].id, name: ii[i].name, type: ii[i].type, placeholder: ii[i].placeholder });
        }
        return out;
      })()
    `) as unknown[];
    console.log("[diag2] Text inputs:", JSON.stringify(inputs, null, 2));

    // Capture all submit buttons / links
    const buttons = await page.evaluate(`
      (function() {
        var bs = document.querySelectorAll('input[type="submit"], a[id*="Continue"], a[id*="lnkNext"], a[id*="btnContinue"]');
        var out = [];
        for (var i = 0; i < bs.length; i++) {
          out.push({ id: bs[i].id, tag: bs[i].tagName, text: (bs[i].textContent || bs[i].value || '').trim().slice(0, 60) });
        }
        return out;
      })()
    `) as unknown[];
    console.log("[diag2] Buttons/links:", JSON.stringify(buttons, null, 2));

    // Full page body text (first 2000 chars)
    const bodyText = await page.locator("body").innerText({ timeout: 5000 });
    fs.writeFileSync(path.join(OUT_DIR, "post-captcha-body.txt"), bodyText);
    console.log(`[diag2] Body text first 800 chars:\n${bodyText.slice(0, 800)}`);

    // Save HTML
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, "post-captcha.html"), html);
    console.log(`[diag2] Saved HTML (${html.length} bytes)`);

    // Screenshot
    await page.screenshot({ path: path.join(OUT_DIR, "post-captcha.png"), fullPage: true });
  } finally {
    await session.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
