// Usage: node scripts/screens.mjs <base-url> [out-dir] [--only /path,/path]
// Full-page screenshots at 1440 and 390 (and 1000 with --tablet) for the design-system review, saved to
// docs/design-system/screens/. Also reports horizontal overflow. Playwright is loaded from
// PLAYWRIGHT_DIR (default ../../../viza-reference), so this package does not depend on it.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const base = (args[0] ?? "http://localhost:3100").replace(/\/$/, "");
const out = resolve(args[1] && !args[1].startsWith("--") ? args[1] : "docs/design-system/screens");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const widths = args.includes("--tablet") ? [1440, 1000, 390] : [1440, 390];
const require = createRequire(join(resolve(process.env.PLAYWRIGHT_DIR ?? "../../../viza-reference"), "package.json"));
const { chromium } = require("playwright");

const PAGES = only ?? ["/", "/about", "/contact", "/zh-CN/"];
mkdirSync(out, { recursive: true });
// Falls back to the installed Google Chrome when Playwright's own browser is not downloaded.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    // Scroll through once so lazy images load, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = (path === "/" ? "home" : path.replace(/^\/|\/$/g, "").replace(/\//g, "-")) + `-${width}.jpg`;
    await page.screenshot({ path: join(out, name), fullPage: true, type: "jpeg", quality: 70 });
    console.log(`${name}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ""}`);
  }
  await ctx.close();
}
await browser.close();
