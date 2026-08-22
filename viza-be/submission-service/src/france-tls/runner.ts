import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import { redactOfficialUrl } from "../appointment-free-smoke";
import {
  isAuthenticatedFranceTlsRedirectUrl,
  loadFranceTlsStoredAccount,
  loginFranceTlsStoredAccount,
  submitFranceTlsOfficialReference,
} from "./account-registration";
import {
  classifyFranceTlsBrowserState,
  closeFranceTlsBrowserSession,
  createFranceTlsBrowserSession,
  isFranceTlsCaptchaBlocking,
  readFranceTlsBrowserState,
  waitForFranceTlsCloudflareClearance,
  type FranceTlsBrowserSession,
} from "./browser-api";
import { FRANCE_TLS_CHINA_CENTERS, resolveFranceTlsCenter } from "./center-registry";
import type { FranceTlsPaymentRedacted } from "./payment-session";
import {
  extractFranceTlsSlotsFromDom,
  readFranceTlsSlotDomRecords,
  type FranceTlsObservedSlot,
} from "./slot-observation";

export type FranceTlsRunnerStatus =
  | "slots_observed"
  | "no_slots_available"
  | "payment_required"
  | "manual_required"
  | "confirmation_captured";

export type FranceTlsRunnerSlot = FranceTlsObservedSlot;

export interface FranceTlsRunnerResult {
  status: FranceTlsRunnerStatus;
  slots?: FranceTlsRunnerSlot[];
  evidence?: FranceTlsObservationEvidence;
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

export interface FranceTlsObservationEvidence {
  redactedUrl: string;
  pageType: string;
  screenshotPath: string | null;
}

export interface FranceTlsOfficialProbeInput {
  applicationId: string;
  jobId: string;
  centerCode: string;
}

export interface FranceTlsOfficialBookingInput extends FranceTlsOfficialProbeInput {
  selectedSlot: {
    appointmentDate: string;
    appointmentTime: string;
    appointmentLocation: string;
    appointmentType: string;
  };
  paymentSessionId?: string | null;
}

async function captureObservationEvidence(
  page: Page,
  pageType: string,
): Promise<FranceTlsObservationEvidence> {
  const configuredRoot = process.env.SUBMISSION_ARTIFACTS_DIR?.trim();
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.tmpdir(), "viza-submission-artifacts");
  const directory = path.join(root, "france-tls-observation");
  await fs.mkdir(directory, { recursive: true });
  const safeType = pageType.replace(/[^a-z0-9_-]+/giu, "-").slice(0, 60) || "checkpoint";
  const screenshotPath = path.join(
    directory,
    `${Date.now()}-${safeType}-${randomBytes(3).toString("hex")}.png`,
  );
  let savedPath: string | null = screenshotPath;
  try {
    const mask = [page.locator(
      "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), textarea, [contenteditable='true']",
    )];
    await page.screenshot({ path: screenshotPath, fullPage: true, mask, timeout: 15_000 });
  } catch {
    savedPath = null;
  }
  return {
    redactedUrl: redactOfficialUrl(page.url()),
    pageType: safeType,
    screenshotPath: savedPath,
  };
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

function classifyCheckpoint(text: string): FranceTlsRunnerResult["checkpoint"] | null {
  const start = text.slice(0, 1200);
  if (/checking your browser|attention required|access denied|cf-error|turnstile|un\s+instant|vérification de sécurité|verification de securite|ray\s*id|cloudflare/i.test(start)) {
    return {
      type: "waf",
      message: "TLScontact is protected by WAF/Cloudflare or blocked the current browser session.",
      metadataRedactedJson: { provider: "tlscontact_cn_fr" },
    };
  }
  if (/captcha|recaptcha|verification code|security check/i.test(start)) {
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

async function openAuthenticatedFranceTlsPage(input: {
  applicationId: string;
  centerCode: string;
}): Promise<FranceTlsBrowserSession> {
  const center = resolveFranceTlsCenter(input.centerCode);
  if (!center) throw new Error("Unsupported France TLS center code");
  const account = await loadFranceTlsStoredAccount(input.applicationId);
  const session = await createFranceTlsBrowserSession();
  try {
    await session.page.goto(center.bookingUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await waitForFranceTlsCloudflareClearance(session.page, {
      timeoutMs: Number.parseInt(process.env.FRANCE_TLS_CLOUDFLARE_WAIT_MS ?? "90000", 10),
      solveProviderCaptcha: true,
    });
    await loginFranceTlsStoredAccount(session.page, account, center.bookingUrl);
    if (!isAuthenticatedFranceTlsRedirectUrl(session.page.url())) {
      await session.page.goto(center.bookingUrl, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
    }
    await waitForFranceTlsCloudflareClearance(session.page, {
      timeoutMs: Number.parseInt(process.env.FRANCE_TLS_CLOUDFLARE_WAIT_MS ?? "90000", 10),
      solveProviderCaptcha: true,
    });
    const hasReferenceField = await session.page.locator(
      "input[name*='reference' i], input[id*='reference' i], input[placeholder*='reference' i]",
    ).first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasReferenceField) {
      const reference = await submitFranceTlsOfficialReference(session.page, account);
      if (!reference.submitted) {
        throw new Error(`TLScontact reference submission mapping is incomplete: ${reference.visibleUnmappedFields.join(", ")}`);
      }
    }
    return session;
  } catch (error) {
    await closeFranceTlsBrowserSession(session);
    throw error;
  }
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
  let page: Page | null = null;
  try {
    const session = await openAuthenticatedFranceTlsPage(input);
    browser = session.browser;
    page = session.page;
    const settleMs = Number.parseInt(process.env.FRANCE_TLS_PAGE_SETTLE_MS ?? "30000", 10);
    await session.page.waitForTimeout(Number.isFinite(settleMs) ? Math.max(4_000, settleMs) : 30_000);
    const browserInput = await readFranceTlsBrowserState(session.page);
    const browserState = classifyFranceTlsBrowserState(browserInput);
    if (browserState.checkpoint === "waf" || isFranceTlsCaptchaBlocking(browserInput, browserState)) {
      return {
        status: "manual_required",
        evidence: await captureObservationEvidence(session.page, browserState.checkpoint),
        checkpoint: {
          type: browserState.checkpoint === "waf" ? "waf" : "captcha",
          message: browserState.message,
          metadataRedactedJson: {
            centerCode: center.code,
            browserProvider: session.provider,
            officialUrlReached: true,
          },
        },
      };
    }
    const text = await session.page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const pageState = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(session.page));
    if (pageState.checkpoint === "payment") {
      return {
        status: "payment_required",
        evidence: await captureObservationEvidence(session.page, "payment"),
        checkpoint: {
          type: "payment",
          message: pageState.message,
          metadataRedactedJson: {
            centerCode: center.code,
            browserProvider: session.provider,
            officialUrlReached: true,
          },
        },
      };
    }
    const checkpoint = classifyCheckpoint(text);
    if (checkpoint) {
      return {
        status: "manual_required",
        evidence: await captureObservationEvidence(session.page, checkpoint.type),
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

    const extraction = extractFranceTlsSlotsFromDom(
      await readFranceTlsSlotDomRecords(session.page),
      center.code,
      { noSlotsText: text },
    );
    if (extraction.status === "slots_observed") {
      return {
        status: "slots_observed",
        slots: extraction.slots,
        evidence: await captureObservationEvidence(session.page, "slots_observed"),
      };
    }
    if (extraction.status === "no_slots_available") {
      return {
        status: "no_slots_available",
        slots: [],
        evidence: await captureObservationEvidence(session.page, "no_slots_available"),
      };
    }
    return {
      status: "manual_required",
      evidence: await captureObservationEvidence(session.page, "selector_drift"),
      checkpoint: {
        type: "selector_drift",
        message: "TLScontact was reached after login, but supported one-slot containers did not expose a parseable provider slot id, date, and time.",
        metadataRedactedJson: {
          centerCode: center.code,
          browserProvider: session.provider,
          officialUrlReached: true,
          invalidSlotRecordCount: extraction.invalidRecordCount,
        },
      },
    };
  } catch (error) {
    return {
      status: "manual_required",
      ...(page ? { evidence: await captureObservationEvidence(page, "site_policy_review") } : {}),
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

function confirmationNumberFromText(text: string): string | null {
  const labelled = text.match(
    /(?:confirmation|appointment|reference|booking)\s*(?:number|no\.?|id|reference)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,})/i,
  );
  return labelled?.[1] ?? null;
}

export async function bookFranceTlsOfficialAppointment(
  input: FranceTlsOfficialBookingInput,
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
    const session = await openAuthenticatedFranceTlsPage(input);
    browser = session.browser;
    const date = input.selectedSlot.appointmentDate.trim();
    const time = input.selectedSlot.appointmentTime.trim();
    const candidates = session.page.locator(
      "[data-testid*='slot'], [data-slot-id], .appointment-slot, .slot, table tbody tr, button",
    );
    const count = Math.min(await candidates.count().catch(() => 0), 200);
    let selected = false;
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      if (!await candidate.isVisible().catch(() => false)) continue;
      const text = (await candidate.innerText().catch(() => "")).replace(/\s+/g, " ");
      if (!text.includes(date) || (time && !text.includes(time))) continue;
      await candidate.click({ timeout: 15_000 });
      selected = true;
      break;
    }
    if (!selected) {
      return {
        status: "manual_required",
        checkpoint: {
          type: "selector_drift",
          message: "The user-selected TLScontact slot is no longer visible on the official calendar.",
          metadataRedactedJson: {
            centerCode: center.code,
            selectedDate: date,
            selectedTime: time,
            browserProvider: session.provider,
          },
        },
      };
    }

    await session.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await session.page.waitForTimeout(1_500);
    const continueButton = session.page.getByRole("button", { name: /continue|book|confirm|select/i }).first();
    if (await continueButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await continueButton.click({ timeout: 15_000 });
      await session.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await session.page.waitForTimeout(1_500);
    }

    const browserInput = await readFranceTlsBrowserState(session.page);
    const browserState = classifyFranceTlsBrowserState(browserInput);
    if (browserState.checkpoint === "payment") {
      return {
        status: "payment_required",
        checkpoint: {
          type: "payment",
          message: "TLScontact reached its secure payment page. A provider-backed payment session is required before final booking.",
          metadataRedactedJson: {
            centerCode: center.code,
            browserProvider: session.provider,
            selectedSlotMatched: true,
            hasPaymentSessionReference: Boolean(input.paymentSessionId),
          },
        },
      };
    }
    if (
      ["waf", "login", "site_policy_review"].includes(browserState.checkpoint)
      || isFranceTlsCaptchaBlocking(browserInput, browserState)
    ) {
      return {
        status: "manual_required",
        checkpoint: {
          type: browserState.checkpoint === "waf"
            ? "waf"
            : browserState.checkpoint.startsWith("captcha")
              ? "captcha"
              : browserState.checkpoint === "login"
                ? "login"
                : "site_policy_review",
          message: browserState.message,
          metadataRedactedJson: {
            centerCode: center.code,
            browserProvider: session.provider,
            selectedSlotMatched: true,
          },
        },
      };
    }

    const bodyText = await session.page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const confirmationNumber = confirmationNumberFromText(bodyText);
    if (!confirmationNumber) {
      return {
        status: "manual_required",
        checkpoint: {
          type: "site_policy_review",
          message: "The selected TLScontact slot was opened, but no official confirmation number was visible.",
          metadataRedactedJson: {
            centerCode: center.code,
            browserProvider: session.provider,
            selectedSlotMatched: true,
          },
        },
      };
    }
    return {
      status: "confirmation_captured",
      confirmation: {
        confirmationNumber,
        receiptUrl: null,
        screenshotUrl: null,
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
