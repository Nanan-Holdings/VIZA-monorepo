/**
 * Shared 2captcha client. Used by all per-country runners (CEAC, France-Visas,
 * UK, Egypt, Italy, Indonesia) so we only maintain one network/solver layer.
 *
 * Two surfaces:
 *   - solveImageCaptcha(imageBuffer): ImageToTextTask — preserves the legacy
 *     CEAC contract (uppercase BotDetect CAPTCHA, returns decoded text).
 *   - solveCaptcha({type, siteKey, pageUrl, ...}): token-based dispatcher for
 *     RecaptchaV2 / Turnstile / HCaptcha — returns the gRecaptchaResponse /
 *     cf-turnstile-response token to inject into the page.
 *   - solveGridCaptcha(imageBuffer, options): GridTask for visible image-grid
 *     challenges — returns one-based tile numbers that callers click.
 *
 * Callers decide retry policy. Errors are typed so callers can branch on
 * config / API / balance / network / timeout cleanly.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when TWOCAPTCHA_API_KEY is missing from env. */
export class TwoCaptchaConfigError extends Error {
  readonly code = "TWOCAPTCHA_CONFIG_ERROR" as const;
  constructor() {
    super("TWOCAPTCHA_API_KEY environment variable is not set");
    this.name = "TwoCaptchaConfigError";
  }
}

/** Thrown when 2captcha returns an ERROR_* response code. */
export class TwoCaptchaApiError extends Error {
  readonly code = "TWOCAPTCHA_API_ERROR" as const;
  readonly apiErrorCode: string;
  constructor(apiErrorCode: string) {
    super(`2captcha API error: ${apiErrorCode}`);
    this.name = "TwoCaptchaApiError";
    this.apiErrorCode = apiErrorCode;
  }
}

/** Thrown when the 2captcha account has zero balance. */
export class TwoCaptchaZeroBalanceError extends Error {
  readonly code = "TWOCAPTCHA_ZERO_BALANCE" as const;
  constructor() {
    super("2captcha account has zero balance");
    this.name = "TwoCaptchaZeroBalanceError";
  }
}

/** Thrown when a network request to 2captcha fails. */
export class TwoCaptchaNetworkError extends Error {
  readonly code = "TWOCAPTCHA_NETWORK_ERROR" as const;
  constructor(cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`2captcha network error: ${msg}`);
    this.name = "TwoCaptchaNetworkError";
  }
}

/** Thrown when 2captcha does not produce a result within the timeout budget. */
export class TwoCaptchaSolveTimeoutError extends Error {
  readonly code = "TWOCAPTCHA_SOLVE_TIMEOUT" as const;
  readonly budgetMs: number;
  constructor(budgetMs: number) {
    super(`2captcha solve timed out after ${budgetMs}ms`);
    this.name = "TwoCaptchaSolveTimeoutError";
    this.budgetMs = budgetMs;
  }
}

// ---------------------------------------------------------------------------
// Telemetry — persisted in result payloads
// ---------------------------------------------------------------------------

export interface CaptchaSolveTelemetry {
  /** 2captcha task ID. */
  solveId: string;
  /** Wall-clock solve duration in milliseconds. */
  durationMs: number;
  /** Attempt number within the retry loop (1-based). */
  attempt: number;
  /** Final outcome of this attempt. */
  outcome: "solved" | "wrong_answer_retry" | "failed";
}

// ---------------------------------------------------------------------------
// Result type — uniform across image and token tasks
// ---------------------------------------------------------------------------

export interface CaptchaSolveResult {
  /** For ImageToText this is the decoded characters; for token tasks the gRecaptchaResponse / Turnstile token. */
  text: string;
  /** 2captcha task ID — needed for reportBadCaptcha(). */
  solveId: string;
  /** Wall-clock time from task creation to result, in milliseconds. */
  durationMs: number;
  /** Some token tasks return the browser user agent used by the solver. */
  userAgent?: string;
}

export interface GridCaptchaSolveResult {
  /** One-based tile numbers returned by 2captcha, e.g. [1, 5, 9] for a 3x3 grid. */
  clicks: number[];
  /** 2captcha task ID — needed for reportBadCaptcha(). */
  solveId: string;
  /** Wall-clock time from task creation to result, in milliseconds. */
  durationMs: number;
}

export interface ImageCaptchaTaskOptions {
  case?: boolean;
  numeric?: number;
  minLength?: number;
  maxLength?: number;
  comment?: string;
}

export interface GridCaptchaTaskOptions {
  rows: number;
  columns: number;
  comment: string;
  imgType?: "recaptcha";
  previousId?: string;
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "https://api.2captcha.com";
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.TWOCAPTCHA_API_KEY;
  if (!key) throw new TwoCaptchaConfigError();
  return key;
}

interface CreateTaskResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  taskId?: number;
}

interface GetTaskResultResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  status?: "processing" | "ready";
  solution?: { text?: string; gRecaptchaResponse?: string; token?: string; userAgent?: string; click?: number[] };
}

function classifyApiError(errorCode: string): never {
  if (errorCode === "ERROR_ZERO_BALANCE") {
    throw new TwoCaptchaZeroBalanceError();
  }
  throw new TwoCaptchaApiError(errorCode);
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new TwoCaptchaNetworkError(err);
  }
  if (!res.ok) {
    throw new TwoCaptchaNetworkError(new Error(`HTTP ${res.status} ${res.statusText}`));
  }
  return (await res.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTask(
  taskBody: Record<string, unknown>,
  timeoutMs: number,
): Promise<CaptchaSolveResult> {
  const apiKey = getApiKey();
  const start = Date.now();

  const createRes = await postJson<CreateTaskResponse>(`${API_BASE}/createTask`, {
    clientKey: apiKey,
    task: taskBody,
  });

  if (createRes.errorId !== 0 && createRes.errorCode) {
    classifyApiError(createRes.errorCode);
  }
  if (!createRes.taskId) {
    throw new TwoCaptchaApiError("NO_TASK_ID");
  }

  const taskId = createRes.taskId;
  const deadline = start + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const resultRes = await postJson<GetTaskResultResponse>(`${API_BASE}/getTaskResult`, {
      clientKey: apiKey,
      taskId,
    });

    if (resultRes.errorId !== 0 && resultRes.errorCode) {
      classifyApiError(resultRes.errorCode);
    }

    if (resultRes.status === "ready" && resultRes.solution) {
      const text =
        resultRes.solution.text ??
        resultRes.solution.gRecaptchaResponse ??
        resultRes.solution.token;
      if (text) {
        return {
          text,
          solveId: String(taskId),
          durationMs: Date.now() - start,
          userAgent: resultRes.solution.userAgent,
        };
      }
    }
  }

  throw new TwoCaptchaSolveTimeoutError(timeoutMs);
}

async function runGridTask(
  taskBody: Record<string, unknown>,
  timeoutMs: number,
): Promise<GridCaptchaSolveResult> {
  const apiKey = getApiKey();
  const start = Date.now();

  const createRes = await postJson<CreateTaskResponse>(`${API_BASE}/createTask`, {
    clientKey: apiKey,
    task: taskBody,
  });

  if (createRes.errorId !== 0 && createRes.errorCode) {
    classifyApiError(createRes.errorCode);
  }
  if (!createRes.taskId) {
    throw new TwoCaptchaApiError("NO_TASK_ID");
  }

  const taskId = createRes.taskId;
  const deadline = start + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const resultRes = await postJson<GetTaskResultResponse>(`${API_BASE}/getTaskResult`, {
      clientKey: apiKey,
      taskId,
    });

    if (resultRes.errorId !== 0 && resultRes.errorCode) {
      classifyApiError(resultRes.errorCode);
    }

    if (resultRes.status === "ready" && resultRes.solution?.click) {
      return {
        clicks: resultRes.solution.click,
        solveId: String(taskId),
        durationMs: Date.now() - start,
      };
    }
  }

  throw new TwoCaptchaSolveTimeoutError(timeoutMs);
}

// ---------------------------------------------------------------------------
// Public API — image task (preserves legacy CEAC contract)
// ---------------------------------------------------------------------------

/**
 * Submit a CAPTCHA image to 2captcha and wait for the decoded text.
 *
 * @param imageBuffer - PNG/JPEG screenshot of the CAPTCHA image region.
 * @param timeoutMs   - Maximum time to wait for solve (default 120 000 ms).
 * @returns The decoded text, the task ID, and wall-clock duration.
 */
export async function solveImageCaptcha(
  imageBuffer: Buffer,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  taskOptions: ImageCaptchaTaskOptions = {},
): Promise<CaptchaSolveResult> {
  // `case: true` tells 2captcha workers to preserve letter case. The CEAC
  // BotDetect CAPTCHA is rendered in uppercase letters + digits; without
  // this flag, workers return lowercase answers that CEAC rejects.
  return runTask(
    {
      type: "ImageToTextTask",
      body: imageBuffer.toString("base64"),
      case: taskOptions.case ?? true,
      ...("numeric" in taskOptions ? { numeric: taskOptions.numeric } : {}),
      ...("minLength" in taskOptions ? { minLength: taskOptions.minLength } : {}),
      ...("maxLength" in taskOptions ? { maxLength: taskOptions.maxLength } : {}),
      ...("comment" in taskOptions ? { comment: taskOptions.comment } : {}),
    },
    timeoutMs,
  );
}

// ---------------------------------------------------------------------------
// Public API — visible grid image tasks
// ---------------------------------------------------------------------------

/**
 * Submit a visible image-grid challenge to 2captcha GridTask.
 *
 * This is intended for reCAPTCHA image challenges after the challenge iframe is
 * already visible. It does not bypass WAF, MFA, or account checks; callers must
 * still click the returned tile numbers in the official page and verify whether
 * the challenge advanced.
 */
export async function solveGridCaptcha(
  imageBuffer: Buffer,
  options: GridCaptchaTaskOptions,
): Promise<GridCaptchaSolveResult> {
  const rows = Math.trunc(options.rows);
  const columns = Math.trunc(options.columns);
  if (rows <= 0 || columns <= 0) {
    throw new TwoCaptchaApiError("INVALID_GRID_SIZE");
  }
  if (!options.comment.trim()) {
    throw new TwoCaptchaApiError("MISSING_GRID_COMMENT");
  }

  return runGridTask(
    {
      type: "GridTask",
      body: imageBuffer.toString("base64"),
      rows,
      columns,
      comment: options.comment,
      imgType: options.imgType ?? "recaptcha",
      ...(options.previousId ? { previousId: options.previousId } : {}),
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
}

// ---------------------------------------------------------------------------
// Public API — token tasks (reCAPTCHA / Turnstile / hCaptcha)
// ---------------------------------------------------------------------------

export type TokenCaptchaInput =
  | { type: "recaptcha-v2"; siteKey: string; pageUrl: string; isInvisible?: boolean; timeoutMs?: number }
  | { type: "recaptcha-v3"; siteKey: string; pageUrl: string; action?: string; minScore?: number; timeoutMs?: number }
  | { type: "turnstile"; siteKey: string; pageUrl: string; action?: string; cdata?: string; pageData?: string; userAgent?: string; timeoutMs?: number }
  | { type: "hcaptcha"; siteKey: string; pageUrl: string; timeoutMs?: number };

/**
 * Solve a token-based CAPTCHA (reCAPTCHA, Cloudflare Turnstile, hCaptcha).
 * Returns the response token to inject into the page's hidden form field.
 */
export async function solveCaptcha(input: TokenCaptchaInput): Promise<CaptchaSolveResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  switch (input.type) {
    case "recaptcha-v2":
      return runTask(
        {
          type: "RecaptchaV2TaskProxyless",
          websiteURL: input.pageUrl,
          websiteKey: input.siteKey,
          isInvisible: input.isInvisible ?? false,
        },
        timeoutMs,
      );
    case "recaptcha-v3":
      return runTask(
        {
          type: "RecaptchaV3TaskProxyless",
          websiteURL: input.pageUrl,
          websiteKey: input.siteKey,
          pageAction: input.action,
          minScore: input.minScore ?? 0.7,
        },
        timeoutMs,
      );
    case "turnstile":
      return runTask(
        {
          type: "TurnstileTaskProxyless",
          websiteURL: input.pageUrl,
          websiteKey: input.siteKey,
          action: input.action,
          data: input.cdata,
          pagedata: input.pageData,
          userAgent: input.userAgent,
        },
        timeoutMs,
      );
    case "hcaptcha":
      return runTask(
        {
          type: "HCaptchaTaskProxyless",
          websiteURL: input.pageUrl,
          websiteKey: input.siteKey,
        },
        timeoutMs,
      );
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Report an incorrect CAPTCHA solution to 2captcha for refund.
 */
export async function reportBadCaptcha(solveId: string): Promise<void> {
  const apiKey = getApiKey();

  await postJson(`${API_BASE}/reportIncorrect`, {
    clientKey: apiKey,
    taskId: Number(solveId),
  });
}
