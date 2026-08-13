import * as os from "node:os";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { clickEnterApplication } from "./apply";
import { startTwSession, type TwSession } from "./session";
import { acceptTermsModal } from "./terms-modal";
import { dismissTwPhotoSpecModalIfPresent } from "./photo-spec-modal";
import { selectTwDeliveryLocationStrict } from "./delivery-location";
import { tryCaptureTwMaskedScreenshot } from "./diagnostics";
import { serializeTwError, TwUnexpectedPageError } from "./errors";
import type { TwFieldVerificationEntry } from "./fillers";

export type TwFormalPreflightPhase =
  | "bootstrap"
  | "entry"
  | "terms_modal"
  | "photo_spec_modal"
  | "delivery_location";

export interface TwFormalPreflightInput {
  answers: Pick<Record<string, string>, "continent" | "embassy_office"> & Record<string, string>;
}

export interface TwFormalPreflightOptions {
  headless?: boolean;
  runId?: string;
  diagnosticsOutputDir?: string;
  sessionFactory?: typeof startTwSession;
}

export type TwFormalPreflightResult =
  | {
      status: "passed";
      phases: TwFormalPreflightPhase[];
      durationMs: number;
      urlPath: string;
      tracePath?: string;
      screenshotPath?: string;
      selectedControls: string[];
    }
  | {
      status: "failed";
      phase: TwFormalPreflightPhase;
      durationMs: number;
      diagnostic: TwFormalPreflightDiagnostic;
    };

export interface TwFormalPreflightDiagnostic {
  phase: TwFormalPreflightPhase;
  urlPath: string;
  modalKinds: string[];
  controlNames: string[];
  buttonTexts: string[];
  waitMs: number;
  tracePath?: string;
  screenshotPath?: string;
  error: Record<string, unknown>;
}

export async function runTwFormalRunnerPreflight(
  input: TwFormalPreflightInput,
  options: TwFormalPreflightOptions = {},
): Promise<TwFormalPreflightResult> {
  const startedAt = Date.now();
  const runId = options.runId ?? `tw-formal-preflight-${startedAt}`;
  const diagnosticsOutputDir = options.diagnosticsOutputDir ?? path.join(os.tmpdir(), "viza-tw-formal-preflight");
  const phases: TwFormalPreflightPhase[] = [];
  let phase: TwFormalPreflightPhase = "bootstrap";
  let session: TwSession | null = null;
  let tracePath: string | undefined;
  let screenshotPath: string | undefined;

  try {
    const startSession = options.sessionFactory ?? startTwSession;
    session = await startSession({ headless: options.headless ?? true, runId });
    tracePath = path.join(diagnosticsOutputDir, `${runId}-trace.zip`);
    await session.context.tracing.start({ screenshots: true, snapshots: true }).catch(() => undefined);

    phase = "entry";
    await clickEnterApplication(session.page);
    await assertOfficialApplyPath(session.page, phase);
    phases.push(phase);

    phase = "terms_modal";
    await acceptTermsModal(session.page);
    await assertOfficialApplyPath(session.page, phase);
    phases.push(phase);

    phase = "photo_spec_modal";
    await dismissTwPhotoSpecModalIfPresent(session.page);
    await assertOfficialApplyPath(session.page, phase);
    phases.push(phase);

    phase = "delivery_location";
    const audit: TwFieldVerificationEntry[] = [];
    await selectTwDeliveryLocationStrict(session.page, input.answers, audit);
    await assertOfficialApplyPath(session.page, phase);
    phases.push(phase);

    const shot = await tryCaptureTwMaskedScreenshot(session.page, {
      outputDir: diagnosticsOutputDir,
      runId,
      label: "passed-delivery-location",
      fullPage: false,
    });
    screenshotPath = shot?.path;
    await session.context.tracing.stop({ path: tracePath }).catch(() => {
      tracePath = undefined;
    });

    return {
      status: "passed",
      phases,
      durationMs: Date.now() - startedAt,
      urlPath: safePath(session.page.url()),
      ...(tracePath ? { tracePath } : {}),
      ...(screenshotPath ? { screenshotPath } : {}),
      selectedControls: audit.map((entry) => entry.controlName),
    };
  } catch (err) {
    if (session) {
      const shot = await tryCaptureTwMaskedScreenshot(session.page, {
        outputDir: diagnosticsOutputDir,
        runId,
        label: `failed-${phase}`,
        fullPage: false,
      });
      screenshotPath = shot?.path;
      await session.context.tracing.stop({ path: tracePath }).catch(() => {
        tracePath = undefined;
      });
    }
    const diagnostic = session
      ? await buildPreflightDiagnostic(session.page, phase, Date.now() - startedAt, err, tracePath, screenshotPath)
      : {
          phase,
          urlPath: "",
          modalKinds: [],
          controlNames: [],
          buttonTexts: [],
          waitMs: Date.now() - startedAt,
          ...(tracePath ? { tracePath } : {}),
          ...(screenshotPath ? { screenshotPath } : {}),
          error: serializeTwError(err),
        };
    return {
      status: "failed",
      phase,
      durationMs: Date.now() - startedAt,
      diagnostic,
    };
  } finally {
    if (session) await session.close();
  }
}

async function assertOfficialApplyPath(page: Page, phase: TwFormalPreflightPhase): Promise<void> {
  if (safePath(page.url()) !== "/coa-frontend/overseas-foreign-china/apply") {
    throw new TwUnexpectedPageError(`Taiwan formal preflight left the official /apply path during ${phase}`, {
      url: page.url(),
      details: { phase },
    });
  }
}

async function buildPreflightDiagnostic(
  page: Page,
  phase: TwFormalPreflightPhase,
  waitMs: number,
  err: unknown,
  tracePath?: string,
  screenshotPath?: string,
): Promise<TwFormalPreflightDiagnostic> {
  const [modalKinds, controlNames, buttonTexts] = await Promise.all([
    page
      .locator('[role="dialog"], .modal:visible, .modal-dialog:visible, .modal-content:visible')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => classifyModalText((node.textContent ?? "").replace(/\s+/g, " ").trim()))
          .filter(Boolean)
          .slice(0, 8),
      )
      .catch(() => []),
    page
      .locator("input, select, textarea")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute("name") ?? node.getAttribute("type") ?? node.tagName.toLowerCase())
          .filter(Boolean)
          .slice(0, 30),
      )
      .catch(() => []),
    page
      .locator("button, input[type='button'], input[type='submit'], a")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ((node.textContent ?? "") || node.getAttribute("value") || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 20),
      )
      .catch(() => []),
  ]);

  return {
    phase,
    urlPath: safePath(page.url()),
    modalKinds,
    controlNames,
    buttonTexts,
    waitMs,
    ...(tracePath ? { tracePath } : {}),
    ...(screenshotPath ? { screenshotPath } : {}),
    error: serializeTwError(err),
  };
}

function classifyModalText(text: string): string {
  if (/同意上述條款|同意上述条款/.test(text)) return "terms";
  if (/照片規格|照片规格/.test(text)) return "photo_spec";
  if (/驗證碼|验证码|captcha/i.test(text)) return "captcha_or_otp";
  if (/登入|登录|密碼|密码/.test(text)) return "login";
  return "unknown_modal";
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}
