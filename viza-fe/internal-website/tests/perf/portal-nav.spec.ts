import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

/**
 * Portal navigation budget (PERF-001).
 *
 * Drives the real tab switches an applicant makes — Home → Application →
 * Status → Home — and reads the timings recorded by the in-app instrument
 * (`lib/client/route-perf.ts`) rather than guessing from `waitForLoadState`.
 * "Settled" is the number that matters: the new tab is painted AND its data has
 * landed, which is what an applicant calls "the page loaded".
 *
 * Run it against a dev or preview server:
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3100 \
 *   VIZA_PERF_USER_ID=<applicant_profiles.id> \
 *   VIZA_PERF_USER_EMAIL=<email> \
 *   npx playwright test --project=perf
 *
 * The session is a locally-signed `client_session` cookie (same helper the app
 * uses), so no password is needed and nothing is written to the database.
 */

const BUDGET_MS = Number(process.env.VIZA_PERF_BUDGET_MS ?? 500);
const RUNS = Number(process.env.VIZA_PERF_RUNS ?? 3);
/** How long a pointer rests on a tab before the click lands. */
const HOVER_DWELL_MS = Number(process.env.VIZA_PERF_HOVER_MS ?? 150);

/** Tab labels across the shipped locales (en / zh-CN / zh-TW). */
const TAB_HOME = /^(Home|首页|首頁)$/;
const TAB_APPLICATION = /^(Application|申请|申請)$/;

const USER_ID = process.env.VIZA_PERF_USER_ID ?? "";
const USER_EMAIL = process.env.VIZA_PERF_USER_EMAIL ?? "";
const AUTH_USER_ID = process.env.VIZA_PERF_AUTH_USER_ID || undefined;
const SESSION_SECRET = process.env.CLIENT_SESSION_SECRET ?? "";

type Row = {
  to: string;
  commit: number | null;
  paint: number | null;
  /** Primary content on screen — the number the budget applies to. */
  ready: number | null;
  /** Everything, including background enrichment the page does not block on. */
  settled: number;
  requests: Array<{ kind: string; label: string; at: number; ms: number }>;
};

async function mintSessionCookie() {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({
    userId: USER_ID,
    email: USER_EMAIL,
    authUserId: AUTH_USER_ID,
    type: "client_session",
    version: 1,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
    .setIssuedAt()
    .sign(secret);
}

/**
 * Clicks a top-level portal tab and returns the sample it produced.
 *
 * The portal ships in several locales, so tabs are matched by a pattern that
 * covers the labels rather than one hard-coded string.
 */
async function switchTab(page: Page, label: RegExp, expectedPath: string): Promise<Row> {
  const tab = page.getByRole("button", { name: label }).first();
  // A real pointer crosses the tab before it clicks, which is what triggers the
  // portal's prefetch. Hover, give it the brief moment a hand takes, then click.
  await tab.hover();
  await page.waitForTimeout(HOVER_DWELL_MS);
  await page.evaluate(() => {
    (window as unknown as { __vizaRoutePerf: { clear(): void } }).__vizaRoutePerf.clear();
  });
  await tab.click();
  await page.waitForURL((url) => url.pathname.startsWith(expectedPath), { timeout: 30_000 });
  await page.evaluate(() =>
    (window as unknown as { __vizaRoutePerf: { waitForIdle(ms?: number): Promise<void> } }).__vizaRoutePerf.waitForIdle(30_000),
  );
  const summary = await page.evaluate(
    () => (window as unknown as { __vizaRoutePerf: { summary(): { rows: Row[] } } }).__vizaRoutePerf.summary(),
  );
  const row = summary.rows.at(-1);
  if (!row) throw new Error(`No timing sample recorded for ${label}`);
  return row;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function report(title: string, rows: Row[]) {
  const ready = rows.map((row) => row.ready ?? row.settled);
  const settled = rows.map((row) => row.settled);
  const readyMedian = median(ready);
  console.log(
    `\n${title}\n  content ready  median ${readyMedian}ms  (${ready.map(Math.round).join(", ")}ms)` +
      `\n  fully settled  median ${median(settled)}ms  (${settled.map(Math.round).join(", ")}ms)`,
  );
  const slowest = rows.reduce((worst, row) => (row.settled > worst.settled ? row : worst), rows[0]);
  for (const request of slowest.requests.slice().sort((a, b) => b.ms - a.ms).slice(0, 5)) {
    console.log(`    ${String(request.ms).padStart(6)}ms  [${request.kind}] ${request.label}`);
  }
  return readyMedian;
}

test.describe("portal navigation budget", () => {
  test.skip(!USER_ID || !USER_EMAIL || !SESSION_SECRET, "set VIZA_PERF_USER_ID / VIZA_PERF_USER_EMAIL / CLIENT_SESSION_SECRET");
  test.setTimeout(300_000);

  test("tab switches stay under budget", async ({ page, context, baseURL }) => {
    const token = await mintSessionCookie();
    const origin = new URL(baseURL ?? "http://localhost:3000");
    await context.addCookies([
      { name: "client_session", value: token, domain: origin.hostname, path: "/" },
    ]);

    // First load is excluded: it pays for a cold dev compile and full hydration.
    await page.goto("/client/home");
    await page.waitForSelector("[data-testid], main", { timeout: 60_000 });
    await page.evaluate(() =>
      (window as unknown as { __vizaRoutePerf: { waitForIdle(ms?: number): Promise<void> } }).__vizaRoutePerf.waitForIdle(60_000),
    );

    const toApplication: Row[] = [];
    const toHome: Row[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      toApplication.push(await switchTab(page, TAB_APPLICATION, "/client/application"));
      toHome.push(await switchTab(page, TAB_HOME, "/client/home"));
    }

    const applicationMedian = report("Home → Application", toApplication);
    const homeMedian = report("Application → Home", toHome);

    expect(applicationMedian, "Home → Application median").toBeLessThanOrEqual(BUDGET_MS);
    expect(homeMedian, "Application → Home median").toBeLessThanOrEqual(BUDGET_MS);
  });
});
