import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type BrowserbaseRegion =
  | "us-west-2"
  | "us-east-1"
  | "eu-central-1"
  | "ap-southeast-1";

export interface BrowserbaseCloudSession {
  id: string;
  connectUrl: string;
  replayUrl: string;
  proxiesEnabled: boolean;
  verifiedEnabled: boolean;
}

export interface BrowserbaseCloudBrowser {
  sessionId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  replayUrl: string;
  proxiesEnabled: boolean;
  verifiedEnabled: boolean;
}

/**
 * An opt-in Browserbase handle for flows that can recover a dropped CDP
 * transport before their first navigation. The browser, context, and page are
 * getters because a recovery replaces those transport objects.
 */
export interface ReconnectableBrowserbaseCloudBrowser {
  sessionId: string;
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  replayUrl: string;
  proxiesEnabled: boolean;
  verifiedEnabled: boolean;
  readonly isConnected: boolean;
  reconnect(): Promise<void>;
  close(): Promise<void>;
}

const DEFAULT_COUNTRY_BY_PREFIX: Readonly<Record<string, string>> = {
  CEAC: "US",
  FRANCE_TLS: "CN",
  FRANCE_VISAS: "FR",
  INDONESIA: "ID",
  KR_KVAC_SHENYANG: "CN",
  KR_EAC: "KR",
  MDAC: "MY",
  JP_VFS_SG: "SG",
  PH_ETRAVEL: "PH",
  SGAC: "SG",
  TDAC: "TH",
  TW_ENTRY_PERMIT: "TW",
  VN: "VN",
  US_APPOINTMENT: "US",
};

let activeBrowserbaseConnections = 0;
const browserbaseConnectionWaiters: Array<() => void> = [];

export class BrowserbaseSessionError extends Error {
  readonly code = "browserbase_session_create_failed";

  constructor(message: string) {
    super(message);
    this.name = "BrowserbaseSessionError";
  }
}

export class BrowserbaseReconnectError extends Error {
  readonly code = "browserbase_reconnect_failed";

  constructor(message = "Browserbase browser connection could not be recovered.") {
    super(message);
    this.name = "BrowserbaseReconnectError";
  }
}

interface BrowserbaseCreateResponse {
  id?: unknown;
  connectUrl?: unknown;
}

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

const BROWSERBASE_SESSION_RELEASE_TIMEOUT_MS = 10_000;
const BROWSERBASE_BROWSER_CLOSE_TIMEOUT_MS = 10_000;
const RECONNECTABLE_SESSION_TIMEOUT_SECONDS = 900;
const RECONNECTABLE_CONNECT_TIMEOUT_MS = 20_000;
const RECONNECTABLE_MAX_RECONNECT_ATTEMPTS = 2;

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value !== "false" && value !== "0" && value !== "no";
}

function readRegion(name: string): BrowserbaseRegion {
  const value = process.env[name]?.trim() || "ap-southeast-1";
  if (
    value === "us-west-2" ||
    value === "us-east-1" ||
    value === "eu-central-1" ||
    value === "ap-southeast-1"
  ) {
    return value;
  }
  throw new BrowserbaseSessionError(`${name} is not a supported Browserbase region.`);
}

function safeCreateFailure(status: number): string {
  if (status === 401 || status === 403) {
    return "Browserbase rejected the configured API key or account permissions.";
  }
  if (status === 402) {
    return "Browserbase proxies require a paid Developer plan or higher.";
  }
  if (status === 429) {
    return "Browserbase session concurrency or rate limit was reached.";
  }
  return `Browserbase session creation failed with HTTP ${status}.`;
}

export function browserbaseEnabled(prefix: string, fallback = false): boolean {
  return readBoolean(`${prefix}_BROWSERBASE_ENABLED`, fallback);
}

export async function createBrowserbaseCloudSession(options: {
  prefix: string;
  fetchImpl?: FetchLike;
  keepAlive?: boolean;
  timeoutSeconds?: number;
}): Promise<BrowserbaseCloudSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new BrowserbaseSessionError(
      `${options.prefix}_BROWSERBASE_ENABLED is true but BROWSERBASE_API_KEY is missing.`,
    );
  }

  const proxiesEnabled = readBoolean(`${options.prefix}_BROWSERBASE_PROXIES`, true);
  const verifiedEnabled = readBoolean(`${options.prefix}_BROWSERBASE_VERIFIED`, false);
  const region = readRegion(`${options.prefix}_BROWSERBASE_REGION`);
  const country = process.env[`${options.prefix}_BROWSERBASE_COUNTRY`]?.trim().toUpperCase()
    || DEFAULT_COUNTRY_BY_PREFIX[options.prefix]
    || "US";
  const timeout = options.timeoutSeconds ?? readPositiveInteger(
    `${options.prefix}_BROWSERBASE_TIMEOUT_SECONDS`,
    readPositiveInteger("BROWSERBASE_SESSION_TIMEOUT_SECONDS", 900),
  );
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new BrowserbaseSessionError(
      `${options.prefix}_BROWSERBASE_COUNTRY must be a two-letter country code.`,
    );
  }
  if (timeout < 60 || timeout > 21_600) {
    throw new BrowserbaseSessionError(
      `${options.prefix}_BROWSERBASE_TIMEOUT_SECONDS must be between 60 and 21600 seconds.`,
    );
  }

  const body: Record<string, unknown> = {
    keepAlive: options.keepAlive ?? false,
    timeout,
    region,
    browserSettings: {
      solveCaptchas: true,
      ...(verifiedEnabled ? { verified: true } : {}),
    },
    userMetadata: {
      service: "viza-submission-service",
      runner: options.prefix.toLowerCase(),
    },
  };
  if (proxiesEnabled) {
    body.proxies = [
      {
        type: "browserbase",
        geolocation: { country },
      },
    ];
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BrowserbaseSessionError("Browserbase session API was not reachable.");
  }

  if (!response.ok) {
    throw new BrowserbaseSessionError(safeCreateFailure(response.status));
  }

  const payload = await response.json() as BrowserbaseCreateResponse;
  const sessionId = typeof payload.id === "string" ? payload.id.trim() : "";
  const connectUrl = typeof payload.connectUrl === "string" ? payload.connectUrl.trim() : "";
  if (!sessionId || !connectUrl) {
    if (sessionId) await releaseBrowserbaseCloudSession(sessionId, fetchImpl);
    throw new BrowserbaseSessionError("Browserbase returned an invalid session response.");
  }

  return {
    id: sessionId,
    connectUrl,
    replayUrl: `https://www.browserbase.com/sessions/${sessionId}`,
    proxiesEnabled,
    verifiedEnabled,
  };
}

/**
 * Ask Browserbase to release a session that was created but could not be
 * connected or prepared. Cleanup is deliberately best-effort: callers must
 * retain the original setup error, while a hung provider request must not hold
 * the worker indefinitely. The endpoint and API response are never exposed.
 */
export async function releaseBrowserbaseCloudSession(
  sessionId: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = BROWSERBASE_SESSION_RELEASE_TIMEOUT_MS,
): Promise<void> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey || !sessionId.trim()) return;

  const boundedTimeoutMs = Math.max(1, Math.min(timeoutMs, BROWSERBASE_SESSION_RELEASE_TIMEOUT_MS));
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const request = Promise.resolve().then(() => fetchImpl(
    `https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-BB-API-Key": apiKey,
      },
      body: JSON.stringify({ status: "REQUEST_RELEASE" }),
    },
  )).then(() => undefined).catch(() => undefined);
  try {
    await Promise.race([
      request,
      new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          resolve();
        }, boundedTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function acquireBrowserbaseConnection(): Promise<() => void> {
  const limit = readPositiveInteger("BROWSERBASE_MAX_CONCURRENCY", 1);
  if (activeBrowserbaseConnections >= limit) {
    await new Promise<void>((resolve) => browserbaseConnectionWaiters.push(resolve));
  }
  activeBrowserbaseConnections += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeBrowserbaseConnections = Math.max(0, activeBrowserbaseConnections - 1);
    browserbaseConnectionWaiters.shift()?.();
  };
}

async function closeBrowserAfterSetupFailure(browser: Browser): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    Promise.resolve().then(() => browser.close()).catch(() => undefined),
    new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(resolve, BROWSERBASE_BROWSER_CLOSE_TIMEOUT_MS);
    }),
  ]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
}

type ReconnectableBrowserbaseLifecycle =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed"
  | "closing"
  | "closed";

interface BrowserbaseBrowserHandles {
  context: BrowserContext;
  page: Page;
}

function browserIsConnected(browser: Browser): boolean {
  try {
    const candidate = browser as Browser & { isConnected?: () => boolean };
    return typeof candidate.isConnected === "function" ? candidate.isConnected() : true;
  } catch {
    return false;
  }
}

function pageIsClosed(page: Page): boolean {
  try {
    const candidate = page as Page & { isClosed?: () => boolean };
    return typeof candidate.isClosed === "function" ? candidate.isClosed() : false;
  } catch {
    return true;
  }
}

function resolveReconnectableHandles(browser: Browser): BrowserbaseBrowserHandles {
  const contexts = browser.contexts();
  if (contexts.length !== 1) {
    throw new BrowserbaseReconnectTopologyError(
      "Browserbase browser recovery requires one existing context.",
    );
  }
  const pages = contexts[0].pages();
  if (pages.length !== 1 || pageIsClosed(pages[0])) {
    throw new BrowserbaseReconnectTopologyError(
      "Browserbase browser recovery requires one existing page.",
    );
  }
  return { context: contexts[0], page: pages[0] };
}

class BrowserbaseReconnectTopologyError extends BrowserbaseReconnectError {}

class ReconnectableBrowserbaseCloudBrowserImpl implements ReconnectableBrowserbaseCloudBrowser {
  readonly sessionId: string;
  readonly replayUrl: string;
  readonly proxiesEnabled: boolean;
  readonly verifiedEnabled: boolean;

  private currentBrowser: Browser;
  private currentContext: BrowserContext;
  private currentPage: Page;
  private readonly connectUrl: string;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly connectOverCDP: typeof chromium.connectOverCDP;
  private readonly releasePermit: () => void;
  private readonly browsers = new Set<Browser>();
  private readonly closedBrowsers = new Set<Browser>();
  private lifecycle: ReconnectableBrowserbaseLifecycle = "connected";
  private connected = true;
  private browserGeneration = 0;
  private reconnectAttempts = 0;
  private reconnectPromise: Promise<void> | null = null;
  private reconnectSettledPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private releasePromise: Promise<void> | null = null;
  private permitReleased = false;

  constructor(options: {
    session: BrowserbaseCloudSession;
    browser: Browser;
    context: BrowserContext;
    page: Page;
    connectOverCDP: typeof chromium.connectOverCDP;
    fetchImpl?: FetchLike;
    releasePermit: () => void;
  }) {
    this.sessionId = options.session.id;
    this.replayUrl = options.session.replayUrl;
    this.proxiesEnabled = options.session.proxiesEnabled;
    this.verifiedEnabled = options.session.verifiedEnabled;
    this.connectUrl = options.session.connectUrl;
    this.fetchImpl = options.fetchImpl;
    this.connectOverCDP = options.connectOverCDP;
    this.releasePermit = options.releasePermit;
    this.currentBrowser = options.browser;
    this.currentContext = options.context;
    this.currentPage = options.page;
    this.attachBrowser(options.browser);
  }

  get browser(): Browser {
    return this.currentBrowser;
  }

  get context(): BrowserContext {
    return this.currentContext;
  }

  get page(): Page {
    return this.currentPage;
  }

  get isConnected(): boolean {
    return this.connected && this.lifecycle === "connected";
  }

  reconnect(): Promise<void> {
    if (this.reconnectPromise) return this.reconnectPromise;
    if (this.isClosingOrClosed() || this.lifecycle === "failed") {
      return Promise.reject(new BrowserbaseReconnectError("Browserbase browser connection is closed."));
    }
    if (
      this.lifecycle === "connected"
      && browserIsConnected(this.currentBrowser)
      && !pageIsClosed(this.currentPage)
    ) {
      return Promise.resolve();
    }
    this.connected = false;
    this.lifecycle = "disconnected";
    const reconnectPromise = this.runReconnect();
    this.reconnectPromise = reconnectPromise;
    const reconnectSettledPromise = reconnectPromise.then(
      () => {
        if (this.reconnectPromise === reconnectPromise) this.reconnectPromise = null;
        if (this.reconnectSettledPromise === reconnectSettledPromise) {
          this.reconnectSettledPromise = null;
        }
      },
      () => {
        if (this.reconnectPromise === reconnectPromise) this.reconnectPromise = null;
        if (this.reconnectSettledPromise === reconnectSettledPromise) {
          this.reconnectSettledPromise = null;
        }
      },
    );
    this.reconnectSettledPromise = reconnectSettledPromise;
    return reconnectPromise;
  }

  close(): Promise<void> {
    return this.beginClose();
  }

  private attachBrowser(browser: Browser): void {
    const generation = this.browserGeneration + 1;
    this.browserGeneration = generation;
    this.currentBrowser = browser;
    this.browsers.add(browser);
    this.connected = browserIsConnected(browser);
    browser.once("disconnected", () => {
      if (this.currentBrowser !== browser || this.browserGeneration !== generation) return;
      this.connected = false;
      if (this.lifecycle === "connected") this.lifecycle = "disconnected";
    });
  }

  private async runReconnect(): Promise<void> {
    this.lifecycle = "reconnecting";
    let lastError = new BrowserbaseReconnectError();
    while (this.reconnectAttempts < RECONNECTABLE_MAX_RECONNECT_ATTEMPTS) {
      if (this.isClosingOrClosed()) {
        lastError = new BrowserbaseReconnectError("Browserbase browser connection is closed.");
        break;
      }
      this.reconnectAttempts += 1;
      let candidate: Browser | null = null;
      try {
        candidate = await this.connectOverCDP(this.connectUrl, {
          timeout: RECONNECTABLE_CONNECT_TIMEOUT_MS,
        });
        if (!browserIsConnected(candidate)) {
          throw new BrowserbaseReconnectError("Browserbase browser connection closed during recovery.");
        }
        const handles = resolveReconnectableHandles(candidate);
        if (this.isClosingOrClosed()) {
          throw new BrowserbaseReconnectError("Browserbase browser connection is closed.");
        }
        const previousBrowser = this.currentBrowser;
        this.currentContext = handles.context;
        this.currentPage = handles.page;
        this.attachBrowser(candidate);
        this.lifecycle = "connected";
        this.connected = true;
        await this.closeTrackedBrowser(previousBrowser);
        if (this.isClosingOrClosed()) {
          throw new BrowserbaseReconnectError("Browserbase browser connection is closed.");
        }
        if (this.lifecycle !== "connected" || !browserIsConnected(candidate) || pageIsClosed(handles.page)) {
          throw new BrowserbaseReconnectError("Browserbase browser connection closed during recovery.");
        }
        return;
      } catch (error) {
        if (candidate && candidate !== this.currentBrowser) {
          await this.closeTrackedBrowser(candidate);
        }
        if (error instanceof BrowserbaseReconnectError) {
          lastError = error;
        } else {
          lastError = new BrowserbaseReconnectError();
        }
        if (error instanceof BrowserbaseReconnectTopologyError
          || this.isClosingOrClosed()) {
          break;
        }
      }
    }

    if (!this.closePromise) {
      this.lifecycle = "failed";
      await this.beginClose(false);
    }
    throw lastError;
  }

  private isClosingOrClosed(): boolean {
    return this.lifecycle === "closing" || this.lifecycle === "closed";
  }

  private releaseSessionOnce(): Promise<void> {
    if (!this.releasePromise) {
      this.releasePromise = releaseBrowserbaseCloudSession(this.sessionId, this.fetchImpl);
    }
    return this.releasePromise;
  }

  private releasePermitOnce(): void {
    if (this.permitReleased) return;
    this.permitReleased = true;
    this.releasePermit();
  }

  private closeTrackedBrowser(browser: Browser): Promise<void> {
    if (this.closedBrowsers.has(browser)) return Promise.resolve();
    this.closedBrowsers.add(browser);
    return closeBrowserAfterSetupFailure(browser);
  }

  private beginClose(waitForReconnect = true): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.lifecycle = "closing";
    this.connected = false;
    const reconnectSettledPromise = waitForReconnect ? this.reconnectSettledPromise : null;
    const closePromise = (async () => {
      try {
        const releasePromise = this.releaseSessionOnce();
        const browserClose = Promise.all(
          [...this.browsers].map((browser) => this.closeTrackedBrowser(browser)),
        );
        await Promise.all([releasePromise, browserClose]);
        if (reconnectSettledPromise) await reconnectSettledPromise;
        await Promise.all(
          [...this.browsers].map((browser) => this.closeTrackedBrowser(browser)),
        );
      } finally {
        this.lifecycle = "closed";
        this.connected = false;
        this.releasePermitOnce();
      }
    })();
    this.closePromise = closePromise;
    return closePromise;
  }
}

export async function connectReconnectableBrowserbaseCloudBrowser(options: {
  prefix: string;
  /** Kept for call-site parity; this opt-in connector always uses 900 seconds. */
  timeoutSeconds?: number;
  /** Test-only transport injection; production callers omit this. */
  fetchImpl?: FetchLike;
  /** Test-only CDP injection; production callers use Playwright directly. */
  connectOverCDPImpl?: typeof chromium.connectOverCDP;
}): Promise<ReconnectableBrowserbaseCloudBrowser> {
  const releasePermit = await acquireBrowserbaseConnection();
  let cloudSession: BrowserbaseCloudSession | null = null;
  let browser: Browser | null = null;
  try {
    cloudSession = await createBrowserbaseCloudSession({
      prefix: options.prefix,
      fetchImpl: options.fetchImpl,
      keepAlive: true,
      timeoutSeconds: RECONNECTABLE_SESSION_TIMEOUT_SECONDS,
    });
    const connectOverCDP = options.connectOverCDPImpl ?? chromium.connectOverCDP.bind(chromium);
    browser = await connectOverCDP(cloudSession.connectUrl, { timeout: 45_000 });
    if (!browserIsConnected(browser)) {
      throw new BrowserbaseReconnectError("Browserbase browser connection closed during setup.");
    }
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = context.pages()[0] ?? await context.newPage();
    if (!browserIsConnected(browser)) {
      throw new BrowserbaseReconnectError("Browserbase browser connection closed during setup.");
    }
    return new ReconnectableBrowserbaseCloudBrowserImpl({
      session: cloudSession,
      browser,
      context,
      page,
      connectOverCDP,
      fetchImpl: options.fetchImpl,
      releasePermit,
    });
  } catch (error) {
    await Promise.all([
      browser ? closeBrowserAfterSetupFailure(browser) : Promise.resolve(),
      cloudSession ? releaseBrowserbaseCloudSession(cloudSession.id, options.fetchImpl) : Promise.resolve(),
    ]);
    releasePermit();
    if (error instanceof BrowserbaseSessionError || error instanceof BrowserbaseReconnectError) {
      throw error;
    }
    throw new BrowserbaseReconnectError("Browserbase browser connection failed.");
  }
}

export async function connectBrowserbaseCloudBrowser(options: {
  prefix: string;
  keepAlive?: boolean;
  timeoutSeconds?: number;
  /** Test-only transport injection; production callers omit this. */
  fetchImpl?: FetchLike;
  /** Test-only CDP injection; production callers use Playwright directly. */
  connectOverCDPImpl?: typeof chromium.connectOverCDP;
}): Promise<BrowserbaseCloudBrowser> {
  const release = await acquireBrowserbaseConnection();
  let cloudSession: BrowserbaseCloudSession | null = null;
  let browser: Browser | null = null;
  try {
    cloudSession = await createBrowserbaseCloudSession(options);
    const connectOverCDP = options.connectOverCDPImpl ?? chromium.connectOverCDP.bind(chromium);
    browser = await connectOverCDP(cloudSession.connectUrl, { timeout: 45_000 });
    browser.once("disconnected", release);
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = context.pages()[0] ?? await context.newPage();
    return {
      sessionId: cloudSession.id,
      browser,
      context,
      page,
      replayUrl: cloudSession.replayUrl,
      proxiesEnabled: cloudSession.proxiesEnabled,
      verifiedEnabled: cloudSession.verifiedEnabled,
    };
  } catch (error) {
    await Promise.all([
      browser ? closeBrowserAfterSetupFailure(browser) : Promise.resolve(),
      cloudSession ? releaseBrowserbaseCloudSession(cloudSession.id, options.fetchImpl) : Promise.resolve(),
    ]);
    release();
    throw error;
  }
}

export async function getBrowserbaseLiveViewUrl(
  sessionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new BrowserbaseSessionError("BROWSERBASE_API_KEY is missing.");
  const response = await fetchImpl(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}/debug`, {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
    headers: { "X-BB-API-Key": apiKey },
  });
  if (!response.ok) throw new BrowserbaseSessionError(safeCreateFailure(response.status));
  const payload = await response.json() as { debuggerFullscreenUrl?: unknown };
  if (typeof payload.debuggerFullscreenUrl !== "string") {
    throw new BrowserbaseSessionError("Browserbase returned an invalid live-view response.");
  }
  return payload.debuggerFullscreenUrl;
}
