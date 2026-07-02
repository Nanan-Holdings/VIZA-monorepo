import { chromium, type Browser, type Page } from "@playwright/test";
import { FRANCE_TLS_CHINA_CENTERS, resolveFranceTlsCenter } from "./center-registry";
import type { FranceTlsPaymentRedacted } from "./payment-session";

export type FranceTlsRunnerStatus =
  | "slots_observed"
  | "no_slots_available"
  | "payment_required"
  | "manual_required"
  | "confirmation_captured";

export interface FranceTlsRunnerSlot {
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
  metadataRedactedJson: Record<string, unknown>;
}

export interface FranceTlsRunnerResult {
  status: FranceTlsRunnerStatus;
  slots?: FranceTlsRunnerSlot[];
  confirmation?: {
    confirmationNumber: string;
    receiptUrl?: string | null;
    screenshotUrl?: string | null;
    paymentRedacted?: FranceTlsPaymentRedacted | null;
  };
  checkpoint?: {
    type: "captcha" | "login" | "payment" | "policy" | "selector_drift" | "waf" | "site_policy_review";
    message: string;
    metadataRedactedJson: Record<string, unknown>;
  };
}

export interface FranceTlsOfficialProbeInput {
  applicationId: string;
  jobId: string;
  centerCode: string;
}

export function buildFranceTlsDryRunSlots(centerCode: string): FranceTlsRunnerSlot[] {
  const center = resolveFranceTlsCenter(centerCode) ?? FRANCE_TLS_CHINA_CENTERS[0];
  return [
    {
      appointmentDate: "2026-09-15",
      appointmentTime: "09:00",
      appointmentLocation: `TLScontact ${center.cityEn}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: {
        centerCode: center.code,
        provider: center.provider,
        bookingUrl: center.bookingUrl,
      },
    },
    {
      appointmentDate: "2026-09-16",
      appointmentTime: "14:30",
      appointmentLocation: `TLScontact ${center.cityEn}`,
      appointmentType: "France Schengen visa application submission",
      source: "france_tls_dry_run",
      metadataRedactedJson: {
        centerCode: center.code,
        provider: center.provider,
        bookingUrl: center.bookingUrl,
      },
    },
  ];
}

export class FranceTlsAppointmentProvider {
  readDryRunSlots(centerCode: string): FranceTlsRunnerResult {
    return {
      status: "slots_observed",
      slots: buildFranceTlsDryRunSlots(centerCode),
    };
  }

  captureDryRunConfirmation(input: {
    applicationId: string;
    centerCode: string;
    paymentRedacted?: FranceTlsPaymentRedacted | null;
  }): FranceTlsRunnerResult {
    const center = resolveFranceTlsCenter(input.centerCode) ?? FRANCE_TLS_CHINA_CENTERS[0];
    return {
      status: "confirmation_captured",
      confirmation: {
        confirmationNumber: `FR-TLS-DRYRUN-${input.applicationId.slice(0, 8).toUpperCase()}`,
        receiptUrl: null,
        screenshotUrl: null,
        paymentRedacted: input.paymentRedacted ?? null,
      },
      checkpoint: {
        type: "policy",
        message: "Dry-run only. No official TLScontact appointment was booked.",
        metadataRedactedJson: {
          centerCode: center.code,
          provider: center.provider,
        },
      },
    };
  }
}

function firstConfiguredEndpoint(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

async function createFranceTlsPage(): Promise<{
  browser: Browser;
  page: Page;
  provider: "remote-browser-api" | "local-cdp" | "local";
}> {
  const browserApiEndpoint = firstConfiguredEndpoint([
    "FRANCE_TLS_BROWSER_API_ENDPOINT",
    "FRANCE_TLS_BRIGHTDATA_BROWSER_API_ENDPOINT",
    "BRIGHTDATA_BROWSER_WS",
    "BRIGHTDATA_BROWSER_API_ENDPOINT",
    "SBR_WS_ENDPOINT",
  ]);
  if (browserApiEndpoint) {
    const browser = await chromium.connectOverCDP(browserApiEndpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    return { browser, page: await context.newPage(), provider: "remote-browser-api" };
  }

  const cdpEndpoint = firstConfiguredEndpoint([
    "FRANCE_TLS_CDP_ENDPOINT",
    "FRANCE_TLS_CHROME_CDP_ENDPOINT",
  ]);
  if (cdpEndpoint) {
    const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    return { browser, page: await context.newPage(), provider: "local-cdp" };
  }

  const headless = process.env.FRANCE_TLS_PLAYWRIGHT_HEADLESS?.trim() !== "false";
  const channel = process.env.FRANCE_TLS_PLAYWRIGHT_CHANNEL?.trim() || undefined;
  const browser = await chromium.launch({ channel, headless });
  const context = await browser.newContext({ acceptDownloads: true });
  return { browser, page: await context.newPage(), provider: "local" };
}

function classifyCheckpoint(text: string): FranceTlsRunnerResult["checkpoint"] | null {
  if (/cloudflare|checking your browser|attention required|access denied|blocked|turnstile/i.test(text)) {
    return {
      type: "waf",
      message: "TLScontact is protected by WAF/Cloudflare or blocked the current browser session.",
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
    };
  }
  if (/captcha|recaptcha|verification code|security check/i.test(text)) {
    return {
      type: "captcha",
      message: "TLScontact requires CAPTCHA or a security verification checkpoint.",
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
    };
  }
  if (/sign in|log in|login|email.*password|password|connectez-vous|connexion/i.test(text)) {
    return {
      type: "login",
      message: "TLScontact requires an authenticated official account session before slots can be read.",
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
    };
  }
  if (/payment|service fee|prepay|pay online|online payment|paiement/i.test(text)) {
    return {
      type: "payment",
      message: "TLScontact reached a payment checkpoint before appointment confirmation.",
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
    };
  }
  return null;
}

function extractVisibleSlots(text: string, centerCode: string): FranceTlsRunnerSlot[] {
  const center = resolveFranceTlsCenter(centerCode) ?? FRANCE_TLS_CHINA_CENTERS[0];
  const slots = new Map<string, FranceTlsRunnerSlot>();
  const datePattern = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g;
  const timePattern = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
  const dates = [...text.matchAll(datePattern)].slice(0, 10).map((match) =>
    `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
  );
  const times = [...text.matchAll(timePattern)].slice(0, 10).map((match) =>
    `${match[1].padStart(2, "0")}:${match[2]}`,
  );
  for (const date of dates) {
    for (const time of times.length ? times : ["00:00"]) {
      const key = `${date}-${time}`;
      slots.set(key, {
        appointmentDate: date,
        appointmentTime: time,
        appointmentLocation: `TLScontact ${center.cityEn}`,
        appointmentType: "France Schengen visa application submission",
        source: "france_tls_live",
        metadataRedactedJson: {
          centerCode: center.code,
          provider: center.provider,
          observedFromOfficialPage: true,
        },
      });
    }
  }
  return [...slots.values()].slice(0, 20);
}

export async function probeFranceTlsOfficialPortal(
  input: FranceTlsOfficialProbeInput,
): Promise<FranceTlsRunnerResult> {
  const center = resolveFranceTlsCenter(input.centerCode);
  if (!center) {
    return {
      status: "manual_required",
      checkpoint: {
        type: "selector_drift",
        message: "Unsupported France TLS center code.",
        metadataRedactedJson: { centerCode: input.centerCode },
      },
    };
  }

  let browser: Browser | null = null;
  try {
    const session = await createFranceTlsPage();
    browser = session.browser;
    await session.page.goto(center.bookingUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await session.page.waitForTimeout(4_000);
    const text = await session.page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const checkpoint = classifyCheckpoint(text);
    if (checkpoint) {
      return {
        status: "manual_required",
        checkpoint: {
          ...checkpoint,
          metadataRedactedJson: {
            ...checkpoint.metadataRedactedJson,
            centerCode: center.code,
            browserProvider: session.provider,
            officialUrlReached: true,
          },
        },
      };
    }

    const slots = extractVisibleSlots(text, center.code);
    return slots.length > 0
      ? { status: "slots_observed", slots }
      : {
          status: "no_slots_available",
          checkpoint: {
            type: "selector_drift",
            message: "TLScontact official page was reached, but no supported slot text was visible.",
            metadataRedactedJson: {
              centerCode: center.code,
              browserProvider: session.provider,
              officialUrlReached: true,
            },
          },
        };
  } catch (error) {
    return {
      status: "manual_required",
      checkpoint: {
        type: "site_policy_review",
        message: error instanceof Error ? error.message : String(error),
        metadataRedactedJson: {
          centerCode: center.code,
          provider: center.provider,
          officialUrlReached: false,
        },
      },
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
