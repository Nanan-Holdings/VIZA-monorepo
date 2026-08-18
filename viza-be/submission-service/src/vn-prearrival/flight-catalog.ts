import { createArrivalCardBrowserSession } from "../arrival-card-browser.js";
import {
  hasVisibleVietnamCaptchaChallenge,
  isVietnamCaptchaFailureRetryable,
  refreshVietnamCaptchaChallenge,
  reportAcceptedVietnamCaptcha,
  reportRejectedVietnamCaptcha,
  solveVietnamImageCaptcha,
  type VietnamCaptchaSolveOutcome,
} from "../vietnam/captcha.js";
import { VN_PREARRIVAL_OFFICIAL_PORTAL_URL } from "./normalize.js";

const OFFICIAL_FLIGHT_SEARCH_PATH =
  "/bio-management-service/category/searchCategory/flight";
const MIN_REFRESH_INTERVAL_MS = 60_000;
const CATALOG_PAGE_SIZE = 10_000;

export type VnPrearrivalOfficialFlight = {
  code?: string;
  vn_value?: string;
  en_value?: string;
  airport?: string;
  airline?: string;
  [key: string]: unknown;
};

export type VnPrearrivalFlightCatalogSnapshot = {
  fetchedAt: string;
  items: VnPrearrivalOfficialFlight[];
};

export type VnPrearrivalFlightCatalogPage = {
  fetchedAt: string;
  items: VnPrearrivalOfficialFlight[];
  totalCount: number;
  page: number;
  size: number;
  hasMore: boolean;
  selectedExists: boolean | null;
  selectedItem: VnPrearrivalOfficialFlight | null;
};

let latestSnapshot: VnPrearrivalFlightCatalogSnapshot | null = null;
let refreshInFlight: Promise<VnPrearrivalFlightCatalogSnapshot> | null = null;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
export function normalizeVnPrearrivalFlightSearch(keyword: string): string {
  const compact = keyword.replace(/\s+/gu, "");
  const match = /^([A-Za-z]{2})(\d+)$/u.exec(compact);
  if (!match) return compact;
  const [, airline, digits] = match;
  return digits.length === 3 ? `${airline}${digits.padStart(4, "0")}` : `${airline}${digits}`;
}

function flightMatchesKeyword(item: VnPrearrivalOfficialFlight, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = [item.code, item.vn_value, item.en_value, item.airport, item.airline]
    .map(stringValue)
    .join(" ")
    .replace(/\s+/gu, "")
    .toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

export function pageVnPrearrivalFlightCatalog(
  snapshot: VnPrearrivalFlightCatalogSnapshot,
  input: { keyword: string; page: number; size: number; selectedValue?: string },
): VnPrearrivalFlightCatalogPage {
  const page = Math.max(0, Math.floor(input.page));
  const size = Math.min(100, Math.max(1, Math.floor(input.size)));
  const query = normalizeVnPrearrivalFlightSearch(input.keyword);
  const matched = snapshot.items.filter((item) => flightMatchesKeyword(item, query));
  const start = page * size;
  const items = matched.slice(start, start + size);
  const selectedValue = input.selectedValue?.trim() ?? "";
  const selectedItem = selectedValue && selectedValue.toLowerCase() !== "other"
    ? snapshot.items.find((item) => stringValue(item.code) === selectedValue) ?? null
    : null;
  return {
    fetchedAt: snapshot.fetchedAt,
    items,
    totalCount: matched.length,
    page,
    size,
    hasMore: start + items.length < matched.length,
    selectedExists: selectedValue
      ? selectedValue.toLowerCase() === "other" || selectedItem !== null
      : null,
    selectedItem,
  };
}

async function waitForCaptchaOrNationality(page: Awaited<ReturnType<typeof createArrivalCardBrowserSession>>["page"]): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await hasVisibleVietnamCaptchaChallenge(page)) return;
    const body = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (/select your nationality/iu.test(body)) return;
    await page.waitForTimeout(500);
  }
  throw new Error("Vietnam Pre-Arrival flight catalog CAPTCHA gate did not become ready.");
}

async function verifyCaptchaWhenPresent(
  page: Awaited<ReturnType<typeof createArrivalCardBrowserSession>>["page"],
): Promise<VietnamCaptchaSolveOutcome | null> {
  if (!(await hasVisibleVietnamCaptchaChallenge(page))) return null;
  const configuredBudgetMs = Number.parseInt(
    process.env.VN_PREARRIVAL_CATALOG_CAPTCHA_BUDGET_MS ?? "180000",
    10,
  );
  const budgetMs = Number.isFinite(configuredBudgetMs) && configuredBudgetMs > 0
    ? configuredBudgetMs
    : 180_000;
  const deadline = Date.now() + budgetMs;
  const maxAttempts = 3;
  let lastReason = "Vietnam Pre-Arrival flight catalog CAPTCHA could not be solved.";

  for (let attempt = 1; attempt <= maxAttempts && Date.now() < deadline; attempt += 1) {
    const remainingMs = Math.max(1_000, deadline - Date.now());
    const outcome = await solveVietnamImageCaptcha(page, Math.min(120_000, remainingMs));
    if (!outcome.solved) {
      lastReason = outcome.reason ?? lastReason;
      if (!isVietnamCaptchaFailureRetryable(outcome.reason)) break;
      if (/unsolvable|unusable|changed while|stale answer/iu.test(outcome.reason ?? "")) {
        const refreshed = await refreshVietnamCaptchaChallenge(
          page,
          Math.min(15_000, Math.max(1_000, deadline - Date.now())),
        ).catch(() => false);
        if (!refreshed) break;
      }
      continue;
    }

    await page.keyboard.press("Tab").catch(() => undefined);
    const verify = page.getByRole("button", { name: /^(Verify|Xác nhận)$/iu }).first();
    await verify.click({ timeout: Math.min(30_000, Math.max(1_000, deadline - Date.now())) });
    const verified = await page.getByText(/Select your nationality/iu).first()
      .waitFor({
        state: "visible",
        timeout: Math.min(30_000, Math.max(1_000, deadline - Date.now())),
      })
      .then(() => true)
      .catch(() => false);
    if (verified) {
      await reportAcceptedVietnamCaptcha(outcome);
      await page.waitForTimeout(750);
      return outcome;
    }

    await reportRejectedVietnamCaptcha(outcome);
    lastReason = "The official portal rejected the Vietnam Pre-Arrival CAPTCHA answer.";
    if (attempt < maxAttempts && Date.now() < deadline) {
      await refreshVietnamCaptchaChallenge(
        page,
        Math.min(15_000, Math.max(1_000, deadline - Date.now())),
      ).catch(() => false);
    }
  }

  throw new Error(lastReason);
}

async function crawlOfficialFlightCatalog(): Promise<VnPrearrivalFlightCatalogSnapshot> {
  const session = await createArrivalCardBrowserSession({
    prefix: "VN_PREARRIVAL",
    headless: true,
  });
  try {
    const { page } = session;
    await page.goto(VN_PREARRIVAL_OFFICIAL_PORTAL_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const primaryAction = page.getByText("Create & Submit Pre-arrival Information", { exact: true });
    await primaryAction.click({ timeout: 30_000 });
    await waitForCaptchaOrNationality(page);
    await verifyCaptchaWhenPresent(page);

    const result = await page.evaluate(async ({ path, size }) => {
      const response = await fetch(path, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "device-id": window.localStorage.getItem("deviceId") ?? "",
        },
        body: JSON.stringify({
          keyword: "",
          filters: {},
          page: 0,
          size,
          sorts: [{ key: "code", asc: true }],
        }),
      });
      const json = await response.json().catch(() => null) as {
        data?: { content?: unknown[]; total?: number };
        message?: string;
      } | null;
      return {
        ok: response.ok,
        status: response.status,
        message: json?.message ?? "",
        content: json?.data?.content ?? [],
        total: json?.data?.total ?? null,
      };
    }, { path: OFFICIAL_FLIGHT_SEARCH_PATH, size: CATALOG_PAGE_SIZE });

    if (!result.ok) {
      throw new Error(`Vietnam Pre-Arrival official flight catalog returned ${result.status}.`);
    }
    if (
      !Array.isArray(result.content) ||
      typeof result.total !== "number" ||
      result.total <= 0 ||
      result.content.length !== result.total
    ) {
      throw new Error("Vietnam Pre-Arrival official flight catalog was incomplete.");
    }
    return {
      fetchedAt: new Date().toISOString(),
      items: result.content as VnPrearrivalOfficialFlight[],
    };
  } finally {
    await session.close().catch(() => undefined);
  }
}

export function getCachedVnPrearrivalFlightCatalog(): VnPrearrivalFlightCatalogSnapshot | null {
  return latestSnapshot;
}

export async function refreshVnPrearrivalFlightCatalog(): Promise<VnPrearrivalFlightCatalogSnapshot> {
  const fetchedAt = latestSnapshot ? Date.parse(latestSnapshot.fetchedAt) : Number.NaN;
  if (latestSnapshot && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < MIN_REFRESH_INTERVAL_MS) {
    return latestSnapshot;
  }
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = crawlOfficialFlightCatalog()
    .then((snapshot) => {
      latestSnapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}
