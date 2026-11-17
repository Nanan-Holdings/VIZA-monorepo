/**
 * Official applicant final-submit handoff (product policy 2026-11).
 *
 * VIZA never clicks an official final submit and never pays a government fee.
 * A runner fills the official portal inside a keepAlive Browserbase session,
 * stops before the official final submit, and registers that exact session
 * with `open_official_applicant_handoff`. The owning applicant opens the
 * live view from VIZA, then declares, submits, and pays on the official site
 * themselves. A watcher later re-attaches read-only to the same session and
 * settles the handoff from official on-page evidence.
 *
 * The watcher never clicks, types, navigates, or closes pages in an applicant
 * session. It only reads page URL/title/text and disconnects.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  getBrowserbaseRunningSessionConnectUrl,
  releaseBrowserbaseCloudSession,
} from "../browserbase-session";

/** How long the applicant has to review, submit, and pay on the official site. */
export const OFFICIAL_HANDOFF_TTL_SECONDS = 60 * 60;
/** Keep the Browserbase session a little longer than the handoff so a late receipt can still be read. */
export const OFFICIAL_HANDOFF_SESSION_GRACE_SECONDS = 10 * 60;
/** Time the runner may spend filling the official form before the handoff starts. */
export const OFFICIAL_HANDOFF_FILL_BUDGET_SECONDS = 45 * 60;
/**
 * The Browserbase timeout counts from session creation, before the fill, so it
 * covers the fill budget, the applicant's window, and the grace period.
 */
export const OFFICIAL_HANDOFF_SESSION_TIMEOUT_SECONDS =
  OFFICIAL_HANDOFF_FILL_BUDGET_SECONDS + OFFICIAL_HANDOFF_TTL_SECONDS + OFFICIAL_HANDOFF_SESSION_GRACE_SECONDS;

/**
 * Handoff expiry: the normal applicant window, but never later than the
 * Browserbase session itself (minus grace for the final receipt check).
 */
export function officialHandoffExpiresAt(sessionCreatedAtMs: number, nowMs = Date.now()): Date {
  const sessionDeadline =
    sessionCreatedAtMs + (OFFICIAL_HANDOFF_SESSION_TIMEOUT_SECONDS - OFFICIAL_HANDOFF_SESSION_GRACE_SECONDS) * 1_000;
  return new Date(Math.min(nowMs + OFFICIAL_HANDOFF_TTL_SECONDS * 1_000, sessionDeadline));
}

/** A handoff shorter than this is not worth giving the applicant. */
export const OFFICIAL_HANDOFF_MIN_WINDOW_SECONDS = 15 * 60;

export type OfficialHandoffProvider = "indonesia_c1_live" | "indonesia_b1_evoa_live";

export interface OfficialHandoffSession {
  /** Browserbase session id; the live-view URL is fetched separately. */
  sessionId: string;
  liveViewUrl: string;
  expiresAt: string;
  /** Where the runner stopped, for applicant copy and diagnostics. */
  readyAt: "official_final_review" | "official_application_list_draft" | "official_payment_pending";
}

export interface OfficialReceiptEvidence {
  source: "official_portal_after_applicant_submit";
  reference: string;
  portalUrl: string;
  capturedAt: string;
  officialState: string;
}

export type OfficialHandoffInspection =
  /** `final` is true when the official page shows the fee paid / application complete. */
  | { outcome: "submitted"; receipt: OfficialReceiptEvidence; final: boolean }
  | { outcome: "pending"; note: string };

export type OfficialHandoffInspector = (page: Page) => Promise<OfficialHandoffInspection>;

interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface OfficialHandoffRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult<unknown>>;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

export async function openOfficialApplicantHandoff(
  client: OfficialHandoffRpcClient,
  input: {
    queueId: string;
    workerId: string;
    applicationId: string;
    applicantId: string;
    session: OfficialHandoffSession;
    stoppedResult: Record<string, unknown>;
  },
): Promise<{ takeoverId: string; expiresAt: string } | null> {
  const { data, error } = await client.rpc("open_official_applicant_handoff", {
    p_queue_id: input.queueId,
    p_worker_id: input.workerId,
    p_application_id: input.applicationId,
    p_applicant_id: input.applicantId,
    p_browserbase_session_id: input.session.sessionId,
    p_live_view_url: input.session.liveViewUrl,
    p_expires_at: input.session.expiresAt,
    p_stopped_result: { ...input.stoppedResult, status: "awaiting_applicant_official_submit" },
  });
  if (error) throw new Error(`open_official_applicant_handoff failed: ${error.message}`);
  const row = firstRow<{ opened: boolean; takeover_id: string; expires_at: string }>(data);
  if (!row?.opened || !row.takeover_id) return null;
  return { takeoverId: row.takeover_id, expiresAt: row.expires_at };
}

export interface LeasedOfficialHandoff {
  takeover_id: string;
  submission_queue_id: string;
  application_id: string;
  applicant_id: string;
  provider: string;
  browserbase_session_ref: string;
  handoff_status: "queued" | "claimed";
  queue_status: string;
  expires_at: string;
}

export function browserbaseSessionIdFromRef(ref: string): string | null {
  const match = /^browserbase-session:([A-Za-z0-9_-]{1,200})$/.exec(ref.trim());
  return match?.[1] ?? null;
}

export async function settleOfficialApplicantHandoff(
  client: OfficialHandoffRpcClient,
  input: {
    takeoverId: string;
    queueId: string;
    workerId: string;
    outcome: "pending" | "submitted" | "closed" | "abandoned";
    submissionResult?: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const { data, error } = await client.rpc("settle_official_applicant_handoff", {
    p_takeover_id: input.takeoverId,
    p_queue_id: input.queueId,
    p_worker_id: input.workerId,
    p_outcome: input.outcome,
    p_submission_result: input.submissionResult ?? null,
  });
  if (error) throw new Error(`settle_official_applicant_handoff failed: ${error.message}`);
  const row = firstRow<{ settled: boolean; handoff_status: string }>(data);
  return row?.settled ? row.handoff_status : null;
}

export interface OfficialHandoffWatchDeps {
  client: OfficialHandoffRpcClient;
  workerId: string;
  inspectors: Partial<Record<string, OfficialHandoffInspector>>;
  /** Builds the submitted application result from official evidence. */
  submittedResult: (handoff: LeasedOfficialHandoff, receipt: OfficialReceiptEvidence) => Record<string, unknown>;
  resolveConnectUrl?: (sessionId: string) => Promise<string | null>;
  connect?: (connectUrl: string) => Promise<Browser>;
  releaseSession?: (sessionId: string) => Promise<void>;
  now?: () => Date;
  limit?: number;
  log?: (message: string) => void;
}

/** Read-only pass over the official page(s) in an applicant session. */
async function inspectSession(
  browser: Browser,
  inspector: OfficialHandoffInspector,
): Promise<OfficialHandoffInspection> {
  const pages = browser.contexts().flatMap((context) => context.pages());
  let lastPending: OfficialHandoffInspection = { outcome: "pending", note: "no_official_page" };
  for (const page of pages) {
    const inspection = await inspector(page);
    if (inspection.outcome === "submitted") return inspection;
    lastPending = inspection;
  }
  return lastPending;
}

/**
 * Disconnect the watcher's CDP client. For a browser obtained through
 * connectOverCDP this only closes the watcher's transport; the keepAlive
 * Browserbase session and the applicant's pages stay open.
 */
async function disconnect(browser: Browser): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 5_000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

/**
 * One watcher pass: lease due handoffs, settle expired ones, and look for
 * official evidence that the applicant submitted. Returns how many handoffs
 * were examined.
 */
export async function runOfficialHandoffWatchTick(deps: OfficialHandoffWatchDeps): Promise<number> {
  const log = deps.log ?? (() => undefined);
  const now = deps.now ?? (() => new Date());
  const { data, error } = await deps.client.rpc("lease_official_applicant_handoff_watch", {
    p_worker_id: deps.workerId,
    p_limit: deps.limit ?? 3,
    p_lease_seconds: 180,
    p_min_recheck_seconds: 60,
  });
  if (error) throw new Error(`lease_official_applicant_handoff_watch failed: ${error.message}`);
  const handoffs = (Array.isArray(data) ? data : []) as LeasedOfficialHandoff[];

  for (const handoff of handoffs) {
    const settle = (
      outcome: "pending" | "submitted" | "closed" | "abandoned",
      submissionResult?: Record<string, unknown>,
    ) =>
      settleOfficialApplicantHandoff(deps.client, {
        takeoverId: handoff.takeover_id,
        queueId: handoff.submission_queue_id,
        workerId: deps.workerId,
        outcome,
        submissionResult: submissionResult ?? null,
      });
    const sessionId = browserbaseSessionIdFromRef(handoff.browserbase_session_ref);
    const release = async () => {
      if (sessionId) await (deps.releaseSession ?? releaseBrowserbaseCloudSession)(sessionId).catch(() => undefined);
    };

    try {
      const expired = new Date(handoff.expires_at).getTime() <= now().getTime();
      const alreadySubmitted = handoff.queue_status.endsWith("_applicant_submitted");
      const inspector = deps.inspectors[handoff.provider];

      // Only a session the applicant actually opened can contain their submit.
      let inspection: OfficialHandoffInspection = { outcome: "pending", note: "not_claimed" };
      if (handoff.handoff_status === "claimed" && inspector && sessionId) {
        const connectUrl = await (deps.resolveConnectUrl ?? getBrowserbaseRunningSessionConnectUrl)(sessionId);
        if (connectUrl) {
          const browser = await (deps.connect ?? ((url) => chromium.connectOverCDP(url, { timeout: 30_000 })))(connectUrl);
          try {
            inspection = await inspectSession(browser, inspector);
          } finally {
            await disconnect(browser);
          }
        } else {
          inspection = { outcome: "pending", note: "session_not_running" };
        }
      }

      if (alreadySubmitted) {
        // Submitted earlier; keep the session open for payment until the
        // official page shows it is complete or the handoff expires.
        if (inspection.outcome === "submitted" && inspection.final) {
          await settle("closed", deps.submittedResult(handoff, inspection.receipt));
          await release();
          log(`[official-handoff] takeover=${handoff.takeover_id} closed after official completion`);
        } else if (expired) {
          await settle("closed");
          await release();
          log(`[official-handoff] takeover=${handoff.takeover_id} closed at expiry`);
        } else {
          await settle("pending");
        }
      } else if (inspection.outcome === "submitted") {
        const status = await settle("submitted", deps.submittedResult(handoff, inspection.receipt));
        log(`[official-handoff] takeover=${handoff.takeover_id} submitted settle=${status ?? "skipped"}`);
      } else if (expired) {
        const status = await settle("abandoned");
        if (status) await release();
        log(`[official-handoff] takeover=${handoff.takeover_id} expired settle=${status ?? "skipped"}`);
      } else {
        await settle("pending");
      }
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error))
        .replace(/apiKey=[^&\s]+/gi, "apiKey=[redacted]");
      log(`[official-handoff] takeover=${handoff.takeover_id} check failed: ${message}`.slice(0, 300));
      await settle("pending").catch(() => undefined);
    }
  }
  return handoffs.length;
}
