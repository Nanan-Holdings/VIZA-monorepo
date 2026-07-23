import * as http from "node:http";
import { timingSafeEqual } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { registerAndPrepareFranceTlsAccount } from "./france-tls/account-registration.js";
import {
  bookFranceTlsOfficialAppointment,
  probeFranceTlsOfficialPortal,
} from "./france-tls/runner.js";
import { putIndonesiaCardSession } from "./indonesia/card-session.js";
import { chromium } from "playwright";
import { runKoreaOfficialEform, runKoreaOfficialEformLiveFill } from "./korea-eform/runner.js";
import { loadKoreaOfficialEformDocuments } from "./korea-eform/documents.js";
import {
  confirmKoreaKvacOfficialCancellation,
  completeKoreaKvacOfficialBooking,
  KoreaKvacOfficialSessionError,
  printKoreaKvacOfficialConfirmation,
  startKoreaKvacOfficialCancelQuery,
  startKoreaKvacOfficialSmsSession,
  submitKoreaKvacOfficialSmsCode,
} from "./korea-kvac/live-session.js";
import { supabase } from "./supabase.js";
import { putVietnamCardSession } from "./vietnam/card-session.js";
import { bookJapanVfsSingaporeSlot, observeJapanVfsSingaporeSlots } from "./jp-vfs-sg/runner.js";
import { putJapanVfsPaymentSession } from "./jp-vfs-sg/payment-session.js";

type KoreaEformPdfLanguage = "zh-CN" | "en" | "ko";

/**
 * DEP-004: minimal HTTP server for Cloud Run health probes.
 *
 *   GET /health → 200 if the process is up.
 *   GET /ready  → 200 if the DB is reachable AND the worker loop has started;
 *                 503 otherwise.
 *   GET /deploy-ready → 200 only when replacing this process cannot destroy an
 *                       active queue run or an unconsumed one-time card session.
 *
 * Port from PORT env (Cloud Run convention), default 8080. The worker-started
 * signal is supplied by the caller via `isWorkerStarted`.
 */
export interface HealthServerOptions {
  isWorkerStarted: () => boolean;
  isWorkerBusy?: () => boolean;
  hasOneTimeCardSessions?: () => boolean;
  port?: number;
}

async function dbReachable(): Promise<boolean> {
  const configuredTimeout = Number(process.env.READINESS_DB_TIMEOUT_MS ?? "3000");
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(Math.floor(configuredTimeout), 500), 10_000)
    : 3_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { error } = await supabase
      .from("runner_job")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(controller.signal);
    return !error;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isLocalRequest(req: http.IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? "";
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}

function hasBearerToken(req: http.IncomingMessage, expected: string | undefined): boolean {
  const configured = expected?.trim();
  const authorization = req.headers.authorization;
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!configured || !provided) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isKoreaInternalRequest(req: http.IncomingMessage): boolean {
  return isLocalRequest(req) || hasBearerToken(req, process.env.KR_SUBMISSION_INTERNAL_TOKEN);
}

function isJapanInternalRequest(req: http.IncomingMessage): boolean {
  if (isLocalRequest(req)) return true;
  return hasBearerToken(req, process.env.JP_VFS_SG_INTERNAL_TOKEN);
}

function isFranceInternalRequest(req: http.IncomingMessage): boolean {
  if (isLocalRequest(req)) return true;
  return hasBearerToken(req, process.env.FRANCE_TLS_INTERNAL_TOKEN);
}

function isIndonesiaInternalRequest(req: http.IncomingMessage): boolean {
  return hasBearerToken(req, process.env.INDONESIA_CARD_SESSION_INTERNAL_TOKEN);
}

function isVietnamInternalRequest(req: http.IncomingMessage): boolean {
  return hasBearerToken(req, process.env.VIETNAM_CARD_SESSION_INTERNAL_TOKEN);
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = 4096): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleVietnamCardSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const internalRequest = req.url === "/internal/vietnam/card-session";
  const enabled = internalRequest
    ? envEnabled(process.env.VN_CLOUD_CARD_SESSION_ENABLED)
    : envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED);
  if (!enabled) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (internalRequest ? !isVietnamInternalRequest(req) : !isLocalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const card = body.card && typeof body.card === "object" && !Array.isArray(body.card)
      ? (body.card as Record<string, unknown>)
      : {};
    const session = putVietnamCardSession({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      card: {
        pan: typeof card.pan === "string" ? card.pan : null,
        expiry: typeof card.expiry === "string" ? card.expiry : null,
        cvv: typeof card.cvv === "string" ? card.cvv : null,
        holderName: typeof card.holderName === "string" ? card.holderName : null,
      },
    });
    sendJson(res, 200, { ok: true, ...session });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleIndonesiaCardSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const internalRequest = req.url === "/internal/indonesia/card-session";
  const enabled = internalRequest
    ? envEnabled(process.env.ID_CLOUD_CARD_SESSION_ENABLED)
    : envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED);
  if (!enabled) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (internalRequest ? !isIndonesiaInternalRequest(req) : !isLocalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const card = body.card && typeof body.card === "object" && !Array.isArray(body.card)
      ? (body.card as Record<string, unknown>)
      : {};
    const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    const session = putIndonesiaCardSession({
      applicationId,
      card: {
        pan: typeof card.pan === "string" ? card.pan : null,
        expiry: typeof card.expiry === "string" ? card.expiry : null,
        cvv: typeof card.cvv === "string" ? card.cvv : null,
        holderName: typeof card.holderName === "string" ? card.holderName : null,
      },
    });
    const redactedApplicationId = applicationId.length > 8
      ? `${applicationId.slice(0, 4)}...${applicationId.slice(-4)}`
      : "(redacted)";
    console.log(
      `[indonesia] One-time card session registered application=${redactedApplicationId} expiresAt=${session.expiresAtIso}`,
    );
    sendJson(res, 200, { ok: true, ...session });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaKvacSmsStart(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 8192)) as Record<string, unknown>;
    const result = await startKoreaKvacOfficialSmsSession({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "",
      bookingUrl: typeof body.bookingUrl === "string" ? body.bookingUrl : "",
      applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
      mobilePhone: typeof body.mobilePhone === "string" ? body.mobilePhone : "",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof KoreaKvacOfficialSessionError
        ? { screenshotPath: error.screenshotPath }
        : {}),
    });
  }
}

async function handleKoreaKvacSmsSubmit(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const result = await submitKoreaKvacOfficialSmsCode({
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      smsCode: typeof body.smsCode === "string" ? body.smsCode : "",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaKvacSmsComplete(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const selectedSlot = body.selectedSlot && typeof body.selectedSlot === "object" && !Array.isArray(body.selectedSlot)
      ? (body.selectedSlot as Record<string, unknown>)
      : null;
    const result = await completeKoreaKvacOfficialBooking({
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      selectedSlot: selectedSlot
        ? {
            appointment_date: typeof selectedSlot.appointment_date === "string" ? selectedSlot.appointment_date : null,
            appointment_time: typeof selectedSlot.appointment_time === "string" ? selectedSlot.appointment_time : null,
            appointment_location: typeof selectedSlot.appointment_location === "string" ? selectedSlot.appointment_location : null,
            appointment_type: typeof selectedSlot.appointment_type === "string" ? selectedSlot.appointment_type : null,
            departure_date: typeof selectedSlot.departure_date === "string" ? selectedSlot.departure_date : null,
          }
        : null,
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaKvacCancelQuery(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 8192)) as Record<string, unknown>;
    const result = await startKoreaKvacOfficialCancelQuery({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "",
      bookingSearchUrl: typeof body.bookingSearchUrl === "string" ? body.bookingSearchUrl : "",
      applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
      mobilePhone: typeof body.mobilePhone === "string" ? body.mobilePhone : "",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaKvacPrintConfirmation(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  try {
    const body = (await readJsonBody(req, 8192)) as Record<string, unknown>;
    const result = await printKoreaKvacOfficialConfirmation({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "",
      bookingSearchUrl: typeof body.bookingSearchUrl === "string" ? body.bookingSearchUrl : "",
      applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
      mobilePhone: typeof body.mobilePhone === "string" ? body.mobilePhone : "",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaKvacCancelConfirm(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const result = await confirmKoreaKvacOfficialCancellation({
      jobId: typeof body.jobId === "string" ? body.jobId : "",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleKoreaEformGenerate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.KR_VISA_PORTAL_EFORM_LOCAL_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isKoreaInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 131072)) as Record<string, unknown>;
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, string | null | undefined>)
      : {};
    const pdfLanguage: KoreaEformPdfLanguage =
      body.pdfLanguage === "en" || body.pdfLanguage === "ko" || body.pdfLanguage === "zh-CN"
        ? body.pdfLanguage
        : "zh-CN";
    const input = {
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      answers,
      officialPdfStoragePath: typeof body.officialPdfStoragePath === "string" ? body.officialPdfStoragePath : null,
      finalReviewApproved: body.finalReviewApproved === true,
      pdfLanguage,
    };

    if (!envEnabled(process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED)) {
      sendJson(res, 200, { ok: true, ...(await runKoreaOfficialEform(input)) });
      return;
    }

    const headless = !envEnabled(process.env.KR_VISA_PORTAL_EFORM_HEADFUL);
    const browser = await chromium.launch({ headless });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const documentResult = await loadKoreaOfficialEformDocuments(input.applicationId);
      const result = await runKoreaOfficialEformLiveFill(page, input, {
        documents: documentResult.documents,
      });
      if (result.status === "manual_required") {
        const evidenceDir = path.resolve(process.cwd(), "output", "playwright");
        await fs.mkdir(evidenceDir, { recursive: true });
        const screenshotPath = path.join(evidenceDir, `korea-eform-${input.applicationId}-filled.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        sendJson(res, 200, {
          ok: true,
          ...result,
          evidence: {
            ...result.evidence,
            missingUploads: Array.from(new Set([
              ...(result.evidence?.missingUploads ?? []),
              ...documentResult.missingUploads,
            ])),
            availableDocumentTypes: documentResult.availableDocumentTypes,
            screenshotPath,
          },
        });
        return;
      }
      sendJson(res, 200, { ok: true, ...result });
    } finally {
      await browser.close();
    }
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleFranceTlsCheckSlots(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.FRANCE_TLS_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isFranceInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const result = await probeFranceTlsOfficialPortal({
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "shanghai",
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleFranceTlsRegisterAccount(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isFranceInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
    if (!applicationId) throw new Error("applicationId is required");
    const result = await registerAndPrepareFranceTlsAccount({
      applicationId,
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "shanghai",
      submitRegistration: body.submitRegistration === true,
      fillOfficialReference: body.fillOfficialReference !== false,
      emailTimeoutMs: Number.parseInt(process.env.FRANCE_TLS_EMAIL_TIMEOUT_MS ?? "600000", 10),
      refreshRetries: 2,
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleFranceTlsBookSelectedSlot(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.FRANCE_TLS_LIVE_BOOKING_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isFranceInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  try {
    const body = (await readJsonBody(req, 8192)) as Record<string, unknown>;
    const selectedSlot = body.selectedSlot && typeof body.selectedSlot === "object"
      ? body.selectedSlot as Record<string, unknown>
      : {};
    const required = (value: unknown, field: string): string => {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
      return value.trim();
    };
    const result = await bookFranceTlsOfficialAppointment({
      applicationId: required(body.applicationId, "applicationId"),
      jobId: required(body.jobId, "jobId"),
      centerCode: typeof body.centerCode === "string" ? body.centerCode : "shanghai",
      selectedSlot: {
        appointmentDate: required(selectedSlot.appointmentDate, "selectedSlot.appointmentDate"),
        appointmentTime: required(selectedSlot.appointmentTime, "selectedSlot.appointmentTime"),
        appointmentLocation: required(selectedSlot.appointmentLocation, "selectedSlot.appointmentLocation"),
        appointmentType: required(selectedSlot.appointmentType, "selectedSlot.appointmentType"),
      },
      paymentSessionId: typeof body.paymentSessionId === "string" ? body.paymentSessionId : null,
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleJapanVfsSingaporeObserve(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.JP_VFS_SG_LOCAL_OFFICIAL_SESSION_ENABLED)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!isJapanInternalRequest(req)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    sendJson(res, 200, {
      ok: true,
      ...(await observeJapanVfsSingaporeSlots({
        applicationId: typeof body.applicationId === "string" ? body.applicationId : undefined,
        prepareAlias: body.prepareAlias === true,
        eligibility: body.eligibility && typeof body.eligibility === "object" && !Array.isArray(body.eligibility) ? body.eligibility as Record<string, unknown> : undefined,
      })),
    });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleJapanVfsSingaporeBook(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.JP_VFS_SG_LIVE_BOOKING_ENABLED)) { sendJson(res, 404, { error: "not_found" }); return; }
  if (!isJapanInternalRequest(req)) { sendJson(res, 403, { error: "forbidden" }); return; }
  try {
    const body = (await readJsonBody(req, 8192)) as Record<string, unknown>;
    const selected = body.selectedSlot && typeof body.selectedSlot === "object" ? body.selectedSlot as Record<string, unknown> : {};
    const required = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`); return value.trim(); };
    const result = await bookJapanVfsSingaporeSlot({
      applicationId: required(body.applicationId, "applicationId"), jobId: required(body.jobId, "jobId"),
      paymentSessionId: required(body.paymentSessionId, "paymentSessionId"),
      eligibility: body.eligibility && typeof body.eligibility === "object" && !Array.isArray(body.eligibility) ? body.eligibility as Record<string, unknown> : undefined,
      selectedSlot: {
        appointmentDate: required(selected.appointmentDate, "selectedSlot.appointmentDate"),
        appointmentTime: typeof selected.appointmentTime === "string" ? selected.appointmentTime : null,
        appointmentLocation: required(selected.appointmentLocation, "selectedSlot.appointmentLocation"), source: "vfs_jp_sg",
      },
    });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) { sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
}

async function handleJapanVfsSingaporePaymentSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!envEnabled(process.env.JP_VFS_SG_LIVE_BOOKING_ENABLED)) { sendJson(res, 404, { error: "not_found" }); return; }
  if (!isJapanInternalRequest(req)) { sendJson(res, 403, { error: "forbidden" }); return; }
  try {
    const body = (await readJsonBody(req, 4096)) as Record<string, unknown>;
    const card = body.card && typeof body.card === "object" && !Array.isArray(body.card) ? body.card as Record<string, unknown> : {};
    sendJson(res, 200, { ok: true, ...putJapanVfsPaymentSession({
      jobId: typeof body.jobId === "string" ? body.jobId : "",
      card: {
        pan: typeof card.pan === "string" ? card.pan : null,
        expiry: typeof card.expiry === "string" ? card.expiry : null,
        cvv: typeof card.cvv === "string" ? card.cvv : null,
        holderName: typeof card.holderName === "string" ? card.holderName : null,
      },
    }) });
  } catch (error) { sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
}

export function startHealthServer(opts: HealthServerOptions): http.Server {
  const port = opts.port ?? Number(process.env.PORT ?? 8080);

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (req.method === "GET" && url === "/ready") {
      void (async () => {
        const reachable = await dbReachable();
        const ready = reachable && opts.isWorkerStarted();
        res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            status: ready ? "ready" : "not_ready",
            dbReachable: reachable,
            workerStarted: opts.isWorkerStarted(),
          }),
        );
      })();
      return;
    }
    if (req.method === "GET" && url === "/deploy-ready") {
      const workerBusy = opts.isWorkerBusy?.() ?? false;
      const oneTimeCardSessionsPresent = opts.hasOneTimeCardSessions?.() ?? false;
      const safeToDeploy = !workerBusy && !oneTimeCardSessionsPresent;
      sendJson(res, safeToDeploy ? 200 : 409, {
        status: safeToDeploy ? "safe" : "busy",
        safeToDeploy,
        workerBusy,
        oneTimeCardSessionsPresent,
      });
      return;
    }
    if (req.method === "POST" && url === "/local/vietnam/card-session") {
      void handleVietnamCardSession(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/vietnam/card-session") {
      void handleVietnamCardSession(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/indonesia/card-session") {
      void handleIndonesiaCardSession(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/indonesia/card-session") {
      void handleIndonesiaCardSession(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/sms/start") {
      void handleKoreaKvacSmsStart(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/sms/submit") {
      void handleKoreaKvacSmsSubmit(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/sms/complete") {
      void handleKoreaKvacSmsComplete(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/cancel/query") {
      void handleKoreaKvacCancelQuery(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/confirmation/print") {
      void handleKoreaKvacPrintConfirmation(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-kvac/cancel/confirm") {
      void handleKoreaKvacCancelConfirm(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/korea-eform/generate") {
      void handleKoreaEformGenerate(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/france-tls/check-slots") {
      void handleFranceTlsCheckSlots(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/france-tls/register-account") {
      void handleFranceTlsRegisterAccount(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/france-tls/book-selected-slot") {
      void handleFranceTlsBookSelectedSlot(req, res);
      return;
    }
    if (req.method === "POST" && url === "/local/japan-vfs-sg/observe") {
      void handleJapanVfsSingaporeObserve(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/japan-vfs-sg/book-selected-slot") {
      void handleJapanVfsSingaporeBook(req, res);
      return;
    }
    if (req.method === "POST" && url === "/internal/japan-vfs-sg/payment-session") {
      void handleJapanVfsSingaporePaymentSession(req, res);
      return;
    }
    if (req.method === "GET" && url === "/local/vietnam/card-session") {
      if (!envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isLocalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/internal/vietnam/card-session") {
      if (
        !envEnabled(process.env.VN_CLOUD_CARD_SESSION_ENABLED) ||
        !isVietnamInternalRequest(req)
      ) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/local/indonesia/card-session") {
      if (!envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isLocalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/internal/indonesia/card-session") {
      if (
        !envEnabled(process.env.ID_CLOUD_CARD_SESSION_ENABLED) ||
        !isIndonesiaInternalRequest(req)
      ) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && (url === "/local/korea-kvac/sms/start" || url === "/local/korea-kvac/cancel/query")) {
      if (!envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isKoreaInternalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/local/korea-eform/generate") {
      if (!envEnabled(process.env.KR_VISA_PORTAL_EFORM_LOCAL_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isKoreaInternalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        enabled: true,
        liveEnabled: envEnabled(process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED),
      });
      return;
    }
    if (req.method === "GET" && url === "/local/france-tls/check-slots") {
      if (!envEnabled(process.env.FRANCE_TLS_LOCAL_OFFICIAL_SESSION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isFranceInternalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/internal/france-tls/register-account") {
      if (!envEnabled(process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isFranceInternalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/internal/france-tls/book-selected-slot") {
      if (!envEnabled(process.env.FRANCE_TLS_LIVE_BOOKING_ENABLED)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      if (!isFranceInternalRequest(req)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/local/japan-vfs-sg/observe") {
      if (!envEnabled(process.env.JP_VFS_SG_LOCAL_OFFICIAL_SESSION_ENABLED) || !isLocalRequest(req)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { ok: true, enabled: true });
      return;
    }
    if (req.method === "GET" && url === "/internal/japan-vfs-sg/book-selected-slot") {
      if (!envEnabled(process.env.JP_VFS_SG_LIVE_BOOKING_ENABLED) || !isJapanInternalRequest(req)) { sendJson(res, 404, { error: "not_found" }); return; }
      sendJson(res, 200, { ok: true, enabled: true }); return;
    }
    sendJson(res, 404, { error: "not_found" });
  });

  server.listen(port, () => {
    const endpoints: string[] = [];
    if (envEnabled(process.env.VN_LOCAL_CARD_SESSION_ENABLED)) endpoints.push("/local/vietnam/card-session");
    if (envEnabled(process.env.VN_CLOUD_CARD_SESSION_ENABLED)) endpoints.push("/internal/vietnam/card-session");
    if (envEnabled(process.env.ID_LOCAL_CARD_SESSION_ENABLED)) endpoints.push("/local/indonesia/card-session");
    if (envEnabled(process.env.ID_CLOUD_CARD_SESSION_ENABLED)) endpoints.push("/internal/indonesia/card-session");
    if (envEnabled(process.env.KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED)) endpoints.push("/local/korea-kvac/sms/start");
    if (envEnabled(process.env.KR_VISA_PORTAL_EFORM_LOCAL_ENABLED)) endpoints.push("/local/korea-eform/generate");
    if (envEnabled(process.env.FRANCE_TLS_LOCAL_OFFICIAL_SESSION_ENABLED)) endpoints.push("/local/france-tls/check-slots");
    if (envEnabled(process.env.FRANCE_TLS_ACCOUNT_REGISTRATION_ENABLED)) endpoints.push("/internal/france-tls/register-account");
    if (envEnabled(process.env.FRANCE_TLS_LIVE_BOOKING_ENABLED)) endpoints.push("/internal/france-tls/book-selected-slot");
    if (envEnabled(process.env.JP_VFS_SG_LOCAL_OFFICIAL_SESSION_ENABLED)) endpoints.push("/local/japan-vfs-sg/observe");
    if (envEnabled(process.env.JP_VFS_SG_LIVE_BOOKING_ENABLED)) endpoints.push("/internal/japan-vfs-sg/book-selected-slot");
    const extra = endpoints.length ? `, ${endpoints.join(", ")}` : "";
    console.log(`[health] listening on :${port} (/health, /ready, /deploy-ready${extra})`);
  });
  return server;
}
