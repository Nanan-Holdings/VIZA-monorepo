import { chromium } from "@playwright/test";

interface CenterSmokeTarget {
  code: string;
  label: string;
  url: string;
  expected: RegExp;
  mode: "sms_sync_supported" | "site_recon_only" | "official_guidance_only";
}

const targets: CenterSmokeTarget[] = [
  {
    code: "beijing",
    label: "Beijing KVAC",
    url: "https://www.visaforkorea-bj.com/visacenter/booking/insert",
    expected: /预约|booking|验证码|手机|reservation/i,
    mode: "sms_sync_supported",
  },
  {
    code: "shanghai",
    label: "Shanghai KVAC",
    url: "https://www.visaforkorea-sh.com/visacenter/booking/insert",
    expected: /预约|booking|验证码|手机|reservation/i,
    mode: "sms_sync_supported",
  },
  {
    code: "guangzhou",
    label: "Guangzhou KVAC",
    url: "https://www.visaforkorea-gz.com/visacenter/booking/insert",
    expected: /预约|booking|验证码|手机|reservation/i,
    mode: "sms_sync_supported",
  },
  {
    code: "xian",
    label: "Xi'an KVAC",
    url: "https://www.visaforkorea-xa.com/visacenter/booking/insert",
    expected: /预约|booking|验证码|手机|reservation/i,
    mode: "sms_sync_supported",
  },
  {
    code: "wuhan",
    label: "Wuhan KVAC",
    url: "https://www.koreavisa-wh.com/zh-CN",
    expected: /签证|预约|申请|visa|reservation/i,
    mode: "site_recon_only",
  },
  {
    code: "shenyang",
    label: "Shenyang KVAC",
    url: "https://visaforkorea-sy030.com/en/schedule-an-appointment.html",
    expected: /book|appointment|visa|vfs|预约/i,
    mode: "site_recon_only",
  },
  {
    code: "chengdu",
    label: "Chengdu KVAC",
    url: "https://www.koreavisa-cd.com/zh-CN/reservation/apply",
    expected: /预约|访问预约|签证|reservation|visa/i,
    mode: "site_recon_only",
  },
  {
    code: "qingdao",
    label: "Qingdao Consulate",
    url: "https://www.mofa.go.kr/cn-qingdao-zh/index.do",
    expected: /签证|领事|青岛|visa|consulate/i,
    mode: "official_guidance_only",
  },
];

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function visibleOfficialLoading(page: import("@playwright/test").Page) {
  return page.locator(".loading").evaluateAll((elements) => elements.some((element) => {
    const style = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number.parseFloat(style.opacity || "1") > 0
      && bounds.width > 0
      && bounds.height > 0;
  })).catch(() => false);
}

async function waitForCalendarMonth(page: import("@playwright/test").Page, previousMonth?: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const title = (await page.locator(".ui-datepicker-title").first().innerText().catch(() => "")).trim();
    const visible = await page.locator(".ui-datepicker-calendar").first().isVisible().catch(() => false);
    if (visible && title && (!previousMonth || title !== previousMonth) && !(await visibleOfficialLoading(page))) {
      await page.waitForTimeout(150);
      if (!(await visibleOfficialLoading(page))) return title;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`Official calendar did not finish loading${previousMonth ? ` after ${previousMonth}` : ""}.`);
}

async function verifySharedKvacCalendar(page: import("@playwright/test").Page) {
  const initialMonth = await waitForCalendarMonth(page);
  const next = page.locator(".ui-datepicker-next").first();
  if (!(await next.isVisible().catch(() => false))) {
    throw new Error("Official calendar has no visible next-month control.");
  }
  await next.click({ timeout: 10_000 });
  const nextMonth = await waitForCalendarMonth(page, initialMonth);
  return {
    initialMonth,
    nextMonth,
    selectableDatesInNextMonth: await page.locator(
      ".ui-datepicker-calendar td[data-handler='selectDay']:not(.ui-datepicker-other-month) a",
    ).count(),
  };
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless: !/^(1|true|yes|on)$/i.test(process.env.KR_KVAC_SMOKE_HEADFUL ?? ""),
  });
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const target of targets) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
      const screenshotPath = `output/playwright/korea-kvac-center-${target.code}.png`;
      try {
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(3_000);
        const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        const matched = target.expected.test(bodyText);
        const calendar = target.mode === "sms_sync_supported"
          ? await verifySharedKvacCalendar(page)
          : null;
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
        results.push({
          code: target.code,
          label: target.label,
          mode: target.mode,
          url: target.url,
          status: matched
            ? calendar
              ? "calendar_ready"
              : "reachable_expected_content"
            : "reachable_unexpected_content",
          finalUrl: page.url(),
          screenshotPath,
          calendar,
          textSample: sanitizeText(bodyText),
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
        results.push({
          code: target.code,
          label: target.label,
          mode: target.mode,
          url: target.url,
          status: "blocked_or_unreachable",
          screenshotPath,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
