/// <reference lib="dom" />
/**
 * Egypt e-Visa public-page recon — Phase A QA helper for the EG_E_VISA schema.
 *
 * Drives visa2egypt.gov.eg with a stealth-patched Chromium and walks every
 * public (unauthenticated) page reachable from the landing URL — Home, Visa
 * Types, eligibility, FAQ, supporting documents, Register form (read-only),
 * Login form. Captures full-page screenshots, raw HTML, and parsed form
 * field metadata for every page.
 *
 * Phase A scope (this script):
 *   - Read-only navigation of public pages
 *   - NO account registration (would create real-portal state)
 *   - NO form submissions
 *   - Outputs: eg-recon-out/page-NN-*.{png,html} + summary.json
 *
 * Phase B (future) — drive the authenticated application form once a real
 * Visa2Egypt account is provisioned. Stop here in Phase A.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/egypt/form-recon.ts
 *
 * Env knobs:
 *   EG_RECON_HEADFUL=1   show the browser (default: headless)
 *   EG_RECON_BASE_URL=https://visa2egypt.gov.eg   override base URL
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";

const OUT_DIR = path.resolve(__dirname, "../../eg-recon-out");
const BASE_URL = process.env.EG_RECON_BASE_URL || "https://visa2egypt.gov.eg";
const HEADLESS = process.env.EG_RECON_HEADFUL !== "1";
const NAV_TIMEOUT = 60_000;

interface FieldCapture {
  page: string;
  index: number;
  field_id?: string;
  field_name?: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; text: string }>;
}

interface PageWalk {
  slug: string;
  url: string;
  title: string;
  status: "ok" | "blocked" | "not_found" | "error";
  fields: number;
  notes?: string;
}

/**
 * Real navigation paths discovered from the home page header (JSF/PrimeFaces
 * 6.0 routing — every link carries a jsessionid + VISTK token; we click
 * through rather than goto to preserve session continuity).
 */
const TARGET_PAGES: Array<{ slug: string; linkSelector?: string; description: string }> = [
  { slug: "01-home", linkSelector: undefined, description: "Public landing — captured via direct goto" },
  { slug: "02-about-egypt", linkSelector: 'a[href*="/About-Egypt"]', description: "About Egypt — tourist info" },
  { slug: "03-how-to-apply", linkSelector: 'a[href*="/HowDoIApply"]', description: "How to Apply — step-by-step + supporting docs" },
  { slug: "04-disclaimer", linkSelector: 'a[href*="/Disclaimer"]', description: "Disclaimer — eligibility + scope" },
  { slug: "05-faq", linkSelector: 'a[href*="/FAQ"]', description: "FAQ — visa types, fees, processing time" },
  { slug: "06-contact-us", linkSelector: 'a[href*="/ContactUs"]', description: "Contact Us — support form" },
  { slug: "07-terms-of-use", linkSelector: 'a[href*="/TermsOfUse"]', description: "Terms of Use" },
  { slug: "08-sign-in", linkSelector: 'a[href*="/SignIn"]', description: "Sign In form (read-only)" },
  { slug: "09-sign-up", linkSelector: 'a[href*="/SignUp"]', description: "Sign Up / registration form (read-only, no submit)" },
];

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(page: Page, slug: string): Promise<void> {
  const file = path.join(OUT_DIR, `${slug}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, timeout: 15_000 });
    console.log(`  screenshot → ${path.relative(process.cwd(), file)}`);
  } catch (err) {
    console.log(`  screenshot failed: ${(err as Error).message}`);
  }
}

async function dumpHtml(page: Page, slug: string): Promise<void> {
  const file = path.join(OUT_DIR, `${slug}.html`);
  try {
    const html = await page.content();
    await fs.writeFile(file, html, "utf8");
    console.log(`  html       → ${path.relative(process.cwd(), file)} (${html.length} bytes)`);
  } catch (err) {
    console.log(`  html dump failed: ${(err as Error).message}`);
  }
}

/**
 * Generic field extraction — Visa2Egypt is built on an older ASP.NET MVC
 * stack (Microsoft Bootstrap-style markup), not Ant Design. Walk every
 * <form> on the page and pull every <input>/<select>/<textarea>.
 */
async function extractFields(page: Page, pageSlug: string): Promise<FieldCapture[]> {
  return await page.evaluate((slug: string) => {
    // tsx injects __name; stub for browser context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f: unknown) => f;

    const findLabel = (el: HTMLElement): string => {
      // Prefer <label for="id">
      const id = el.id;
      if (id) {
        const lab = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
        if (lab) return (lab.textContent || "").trim();
      }
      // Climb to closest .form-group or .form-row and look for a <label>
      let cur: HTMLElement | null = el.parentElement;
      while (cur && cur !== document.body) {
        const lab = cur.querySelector<HTMLLabelElement>("label");
        if (lab) {
          const t = (lab.textContent || "").trim();
          if (t) return t;
        }
        if (cur.classList.contains("form-group") || cur.classList.contains("row")) break;
        cur = cur.parentElement;
      }
      // Fall back to placeholder or aria-label
      return (
        el.getAttribute("aria-label") ||
        (el as HTMLInputElement).placeholder ||
        ""
      );
    };

    const isRequired = (el: HTMLElement): boolean => {
      if ((el as HTMLInputElement).required) return true;
      if (el.getAttribute("aria-required") === "true") return true;
      if (el.getAttribute("data-val-required")) return true;
      // Visa2Egypt commonly marks required with a sibling <span class="required">*</span>
      const parent = el.parentElement;
      if (parent && parent.querySelector(".required, .req, .text-danger")) return true;
      return false;
    };

    const captures: Array<{
      page: string;
      index: number;
      field_id?: string;
      field_name?: string;
      label: string;
      field_type: string;
      required: boolean;
      placeholder?: string;
      options?: Array<{ value: string; text: string }>;
    }> = [];

    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(
        "form input:not([type=hidden]), form select, form textarea",
      ),
    );

    inputs.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      let field_type = tag;

      if (tag === "input") {
        field_type = type === "checkbox" ? "checkbox"
          : type === "radio" ? "radio"
          : type === "email" ? "email"
          : type === "tel" ? "tel"
          : type === "number" ? "number"
          : type === "password" ? "password"
          : type === "date" ? "date"
          : type === "submit" || type === "button" ? "button"
          : "text";
      }
      // Skip submit/button "fields" — they're not user inputs.
      if (field_type === "button") return;

      let options: Array<{ value: string; text: string }> | undefined;
      if (tag === "select") {
        options = Array.from((el as HTMLSelectElement).options).map((o) => ({
          value: o.value,
          text: (o.textContent || "").trim(),
        }));
      }
      if (field_type === "radio" || field_type === "checkbox") {
        // Group sibling radios/checkboxes with the same name once.
        const name = (el as HTMLInputElement).name;
        if (name) {
          const seenName = `__seen_${name}`;
          const memo = (window as unknown as Record<string, boolean>);
          if (memo[seenName]) return;
          memo[seenName] = true;
          const sibs = Array.from(
            document.querySelectorAll<HTMLInputElement>(
              `input[type=${field_type}][name="${CSS.escape(name)}"]`,
            ),
          );
          options = sibs.map((s) => ({
            value: s.value,
            text:
              (document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(s.id)}"]`)?.textContent ||
                s.parentElement?.textContent ||
                s.value).trim(),
          }));
        }
      }

      captures.push({
        page: slug,
        index: idx,
        field_id: el.id || undefined,
        field_name: (el as HTMLInputElement).name || undefined,
        label: findLabel(el),
        field_type,
        required: isRequired(el),
        placeholder: (el as HTMLInputElement).placeholder || undefined,
        options,
      });
    });

    return captures;
  }, pageSlug);
}

/**
 * Detect Cloudflare challenge / bot block / 404 / generic error.
 * Returns the status string we record in the page walk log.
 */
async function classifyPage(page: Page): Promise<"ok" | "blocked" | "not_found" | "error"> {
  const html = await page.content();
  const lower = html.toLowerCase();
  if (lower.includes("checking your browser") || lower.includes("just a moment") || lower.includes("cf-challenge")) {
    return "blocked";
  }
  if (lower.includes("page not found") || lower.includes("404 — file or directory not found") || lower.includes("the resource cannot be found")) {
    return "not_found";
  }
  if (lower.includes("server error") || lower.includes("runtime error")) {
    return "error";
  }
  return "ok";
}

async function walkLandingDirect(
  page: Page,
  slug: string,
): Promise<{ walk: PageWalk; fields: FieldCapture[] }> {
  const url = `${BASE_URL}/eVisa/Home`;
  console.log(`\n→ [${slug}] Public landing (direct goto)\n  ${url}`);
  const walk: PageWalk = { slug, url, title: "", status: "error", fields: 0 };
  let fields: FieldCapture[] = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await sleep(2_500);
    for (let i = 0; i < 4; i++) {
      const s = await classifyPage(page);
      if (s !== "blocked") break;
      console.log("  Cloudflare interstitial — waiting 5s");
      await sleep(5_000);
    }
    walk.title = await page.title();
    walk.status = await classifyPage(page);
    await shot(page, slug);
    await dumpHtml(page, slug);
    if (walk.status === "ok") {
      fields = await extractFields(page, slug);
      walk.fields = fields.length;
    }
    console.log(`  status=${walk.status}  title="${walk.title}"  url=${page.url()}  fields=${fields.length}`);
  } catch (err) {
    walk.status = "error";
    walk.notes = (err as Error).message;
    console.log(`  navigation failed: ${walk.notes}`);
  }
  return { walk, fields };
}

async function walkViaLinkClick(
  page: Page,
  slug: string,
  linkSelector: string,
  description: string,
): Promise<{ walk: PageWalk; fields: FieldCapture[] }> {
  console.log(`\n→ [${slug}] ${description}  (click ${linkSelector})`);
  const walk: PageWalk = { slug, url: "", title: "", status: "error", fields: 0 };
  let fields: FieldCapture[] = [];
  try {
    // Always re-anchor to the landing first so VISTK token is fresh and
    // sidebar links carry valid jsessionid in their hrefs.
    if (!page.url().includes("/eVisa/Home")) {
      await page.goto(`${BASE_URL}/eVisa/Home`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await sleep(1_500);
    }
    const link = page.locator(linkSelector).first();
    if (!(await link.count())) {
      walk.status = "not_found";
      walk.notes = `link not present on landing: ${linkSelector}`;
      walk.url = page.url();
      console.log(`  ${walk.notes}`);
      return { walk, fields };
    }
    await link.click({ timeout: 8_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: NAV_TIMEOUT }).catch(() => {});
    await sleep(2_500);
    walk.url = page.url();
    walk.title = await page.title();
    walk.status = await classifyPage(page);
    await shot(page, slug);
    await dumpHtml(page, slug);
    if (walk.status === "ok") {
      fields = await extractFields(page, slug);
      walk.fields = fields.length;
    }
    console.log(`  status=${walk.status}  title="${walk.title}"  url=${walk.url}  fields=${fields.length}`);
  } catch (err) {
    walk.status = "error";
    walk.notes = (err as Error).message;
    console.log(`  navigation failed: ${walk.notes}`);
  }
  return { walk, fields };
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Egypt e-Visa Phase-A recon — output: ${OUT_DIR}`);
  console.log(`Headless: ${HEADLESS}  (EG_RECON_HEADFUL=1 to disable)`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const { browser, context, page } = await launchStealthBrowser({
    headless: HEADLESS,
    hardening: "france-visas", // Cloudflare-resistant profile, same as France-Visas Keycloak
  });

  const allFields: Record<string, FieldCapture[]> = {};
  const navLog: PageWalk[] = [];

  try {
    for (const target of TARGET_PAGES) {
      const { walk, fields } = target.linkSelector
        ? await walkViaLinkClick(page, target.slug, target.linkSelector, target.description)
        : await walkLandingDirect(page, target.slug);
      navLog.push(walk);
      if (fields.length) allFields[target.slug] = fields;
    }

    const summary = {
      base_url: BASE_URL,
      ran_at: new Date().toISOString(),
      pages_walked: navLog.length,
      pages_ok: navLog.filter((p) => p.status === "ok").length,
      pages_blocked: navLog.filter((p) => p.status === "blocked").length,
      pages_not_found: navLog.filter((p) => p.status === "not_found").length,
      pages_error: navLog.filter((p) => p.status === "error").length,
      total_fields_captured: Object.values(allFields).reduce((a, b) => a + b.length, 0),
      nav_log: navLog,
      fields_by_page: allFields,
    };
    await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

    console.log(`\n✔ Phase A recon complete`);
    console.log(`  ${summary.pages_ok}/${summary.pages_walked} pages reachable`);
    console.log(`  ${summary.total_fields_captured} fields captured (login + register forms)`);
    console.log(`  Output: ${OUT_DIR}`);
    if (summary.pages_blocked > 0) {
      console.log(`  ⚠ ${summary.pages_blocked} page(s) blocked by Cloudflare/CAPTCHA — re-run with EG_RECON_HEADFUL=1 if needed`);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("egypt form-recon failed:", err);
  process.exit(1);
});
