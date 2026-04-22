/**
 * Typed 2captcha ImageToText client for solving the CEAC start-page CAPTCHA.
 *
 * Narrow scope: one function to solve, one to report bad solves.
 * Callers decide retry policy.
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
    const msg =
      cause instanceof Error ? cause.message : String(cause);
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
// Result type
// ---------------------------------------------------------------------------

export interface CaptchaSolveResult {
  /** The decoded CAPTCHA text. */
  text: string;
  /** 2captcha task ID — needed for reportBadCaptcha(). */
  solveId: string;
  /** Wall-clock time from task creation to result, in milliseconds. */
  durationMs: number;
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
  solution?: { text?: string };
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

// ---------------------------------------------------------------------------
// Public API
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
): Promise<CaptchaSolveResult> {
  const apiKey = getApiKey();
  const start = Date.now();

  // 1. Create task
  const createRes = await postJson<CreateTaskResponse>(`${API_BASE}/createTask`, {
    clientKey: apiKey,
    task: {
      type: "ImageToTextTask",
      body: imageBuffer.toString("base64"),
    },
  });

  if (createRes.errorId !== 0 && createRes.errorCode) {
    classifyApiError(createRes.errorCode);
  }
  if (!createRes.taskId) {
    throw new TwoCaptchaApiError("NO_TASK_ID");
  }

  const taskId = createRes.taskId;

  // 2. Poll for result
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

    if (resultRes.status === "ready" && resultRes.solution?.text) {
      return {
        text: resultRes.solution.text,
        solveId: String(taskId),
        durationMs: Date.now() - start,
      };
    }
    // status === "processing" — keep polling
  }

  throw new TwoCaptchaSolveTimeoutError(timeoutMs);
}

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
