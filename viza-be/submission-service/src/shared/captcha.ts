/**
 * 2Captcha image-captcha solver (shared across country runners).
 *
 * Government portals (India e-Visa, several others) gate their public
 * forms with a 6-char image captcha. We screenshot the captcha <img>,
 * hand the PNG to 2Captcha's normal-captcha API, and poll for the
 * human-typed answer.
 *
 * Env:
 *   TWOCAPTCHA_API_KEY   required — 2Captcha account key
 *   CAPTCHA_SOLVE_DRY    "1" → skip the API call, return "" (offline QA)
 *
 * Usage:
 *   const png = await page.locator("#capt").screenshot();
 *   const text = await solveImageCaptcha(png, { hint: "in-evisa" });
 *   await page.fill("#captcha", text);
 */

const IN_URL = "https://2captcha.com/in.php";
const RES_URL = "https://2captcha.com/res.php";

export interface SolveOptions {
  /** Free-text label for logs (e.g. country slug). */
  hint?: string;
  /** Max seconds to poll before giving up. Default 120. */
  timeoutSeconds?: number;
  /** Poll interval seconds. Default 5. */
  pollSeconds?: number;
}

export class CaptchaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaError";
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Solve a normal image captcha. `image` is the raw PNG bytes of the
 * captcha graphic. Returns the recognised text (uppercased — the India
 * portal is case-insensitive but uppercases server-side).
 */
export async function solveImageCaptcha(
  image: Buffer | Uint8Array,
  opts: SolveOptions = {},
): Promise<string> {
  if (process.env.CAPTCHA_SOLVE_DRY === "1") {
    console.log(`[captcha] dry-run (${opts.hint ?? "?"}) — returning ""`);
    return "";
  }
  const key = process.env.TWOCAPTCHA_API_KEY;
  if (!key) throw new CaptchaError("TWOCAPTCHA_API_KEY not set");

  const base64 = Buffer.from(image).toString("base64");
  const submitBody = new URLSearchParams({
    key,
    method: "base64",
    body: base64,
    json: "1",
  });
  const submitRes = await fetch(IN_URL, { method: "POST", body: submitBody });
  const submitJson = (await submitRes.json()) as { status: number; request: string };
  if (submitJson.status !== 1) {
    throw new CaptchaError(`submit rejected: ${submitJson.request}`);
  }
  const captchaId = submitJson.request;
  console.log(`[captcha] submitted (${opts.hint ?? "?"}) id=${captchaId}`);

  const timeoutMs = (opts.timeoutSeconds ?? 120) * 1000;
  const pollMs = (opts.pollSeconds ?? 5) * 1000;
  const deadline = Date.now() + timeoutMs;
  // Give the workers a head start before the first poll.
  await sleep(pollMs);

  while (Date.now() < deadline) {
    const pollUrl = `${RES_URL}?key=${key}&action=get&id=${captchaId}&json=1`;
    const pollRes = await fetch(pollUrl);
    const pollJson = (await pollRes.json()) as { status: number; request: string };
    if (pollJson.status === 1) {
      const text = pollJson.request.trim();
      console.log(`[captcha] solved (${opts.hint ?? "?"}) -> "${text}"`);
      return text.toUpperCase();
    }
    if (pollJson.request !== "CAPCHA_NOT_READY") {
      throw new CaptchaError(`solve failed: ${pollJson.request}`);
    }
    await sleep(pollMs);
  }
  throw new CaptchaError(`timed out after ${opts.timeoutSeconds ?? 120}s`);
}
