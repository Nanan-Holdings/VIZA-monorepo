#!/usr/bin/env npx tsx
/**
 * Generic gov-portal pre-auth mapper. Loads an entry URL through the Bright
 * Data residential proxy and auto-walks the "happy path" — at each step it
 * dumps the page (url, title, visible form controls, candidate next buttons,
 * gate/challenge markers), then clicks the most likely "continue/next" control
 * and repeats. Reveals the real pre-auth page sequence + selectors for a portal
 * without committing anything.
 *
 *   PROBE_URL=https://... PROBE_COUNTRY=gb PROBE_STEPS=6 \
 *     npx tsx scripts/portal-probe.ts
 *
 * Output: a JSON array of per-step snapshots on stdout (last line = "===PROBE_JSON===" then the JSON).
 */
import "dotenv/config";
import { launchStealthBrowser } from "../src/ceac/stealth-browser";

interface Snapshot {
  step: number;
  url: string;
  title: string;
  controls: Array<{ tag: string; type?: string; name?: string; id?: string; label?: string }>;
  buttons: string[];
  challenge: string | null;
  bodyLen: number;
  clicked: string | null;
}

async function main(): Promise<void> {
  const url = process.env.PROBE_URL;
  if (!url) throw new Error("PROBE_URL required");
  process.env.RECON_PROXY_COUNTRY = process.env.PROBE_COUNTRY ?? process.env.RECON_PROXY_COUNTRY ?? "in";
  const maxSteps = Number(process.env.PROBE_STEPS ?? 6);

  const { browser, page } = await launchStealthBrowser({ headless: true });
  const snapshots: Snapshot[] = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    for (let step = 0; step < maxSteps; step++) {
      // SPA-aware settle: wait for network to quiet, then for any form control
      // or a non-trivial body to appear.
      await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
      await page
        .waitForFunction(
          () => (document.body?.innerText ?? "").length > 200 || document.querySelectorAll("input,select,textarea").length > 0,
          { timeout: 20_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(2500);
      const snap = await page.evaluate(() => {
        const text = (document.body?.innerText ?? "").toLowerCase();
        const challenge =
          /captcha|are you a robot|verify you are human|access denied|forbidden|akamai|cloudflare|unusual traffic|rate limit/i.exec(
            document.body?.innerText ?? "",
          )?.[0] ?? null;
        const controls = Array.from(document.querySelectorAll("input,select,textarea"))
          .slice(0, 25)
          .map((e) => {
            const el = e as HTMLInputElement;
            const lbl =
              (el.labels && el.labels[0]?.innerText) ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              "";
            return { tag: el.tagName, type: el.type, name: el.name || undefined, id: el.id || undefined, label: lbl.slice(0, 40) || undefined };
          });
        const buttons = Array.from(document.querySelectorAll("button,a[role=button],input[type=submit],a.govuk-button"))
          .slice(0, 15)
          .map((b) => (b as HTMLElement).innerText?.trim() || (b as HTMLInputElement).value || (b as HTMLElement).getAttribute("name") || "")
          .filter(Boolean);
        return { title: document.title, controls, buttons, challenge, bodyLen: (document.body?.innerText ?? "").length };
      });
      const candidates = [
        'button:has-text("Continue")', 'button:has-text("Next")', 'button:has-text("Start now")',
        'button:has-text("Save and continue")', 'a:has-text("Start now")', 'button[name="submit"]',
        'input[type="submit"]', 'a.govuk-button', "button[type=submit]",
      ];
      let clicked: string | null = null;
      const hasInputs = snap.controls.some((c) => c.type !== "hidden" && c.tag !== "SELECT");
      // If the page wants real input we stop (that's where hardening begins).
      if (!hasInputs || snap.controls.length === 0) {
        for (const sel of candidates) {
          const ok = await page.click(sel, { timeout: 3000 }).then(() => true).catch(() => false);
          if (ok) { clicked = sel; break; }
        }
      }
      snapshots.push({ step, url: page.url(), title: snap.title, controls: snap.controls, buttons: snap.buttons, challenge: snap.challenge, bodyLen: snap.bodyLen, clicked });
      if (!clicked) break;
    }
  } finally {
    await browser.close().catch(() => {});
  }
  console.log("===PROBE_JSON===");
  console.log(JSON.stringify(snapshots, null, 2));
}

main().catch((err) => {
  console.log("===PROBE_JSON===");
  console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
