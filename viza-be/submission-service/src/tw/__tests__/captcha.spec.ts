import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import { TwoCaptchaApiError, type CaptchaSolveResult } from "../../captcha";
import {
  clickTwFinalSubmit,
  inspectTwCaptchaPng,
  solveTwEmailCaptchaAndSendCodeWithRetry,
} from "../captcha";
import { RunnerJobOwnershipLostError } from "../../queue/execution-context";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

function svgData(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="${color}"/><text x="8" y="27" font-size="24" fill="#111">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function captchaPage(options: {
  images?: string[];
  includeRefresh?: boolean;
  advanceOnSend?: boolean;
} = {}): Promise<Page> {
  const images = options.images ?? [svgData("AB12", "#fff")];
  const page = await browser.newPage();
  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <img class="captcha" alt="驗證碼" width="120" height="40" src="${images[0]}" />
        <input id="captchaToken" name="captchaToken" placeholder="請輸入驗證碼" />
        ${options.includeRefresh === false ? "" : '<a href="#" class="reload-captcha">換下一組</a>'}
        <button type="button" id="send">寄送驗證碼</button>
        <div id="otp"></div>
        <script>
          const images = ${JSON.stringify(images)};
          let imageIndex = 0;
          window.refreshCount = 0;
          document.querySelector('.reload-captcha')?.addEventListener('click', (event) => {
            event.preventDefault();
            window.refreshCount += 1;
            imageIndex = Math.min(imageIndex + 1, images.length - 1);
            document.querySelector('img.captcha').src = images[imageIndex];
          });
          document.getElementById('send').addEventListener('click', () => {
            window.sendCount = (window.sendCount || 0) + 1;
            if (${options.advanceOnSend === false ? "false" : "true"}) {
              document.querySelector('img.captcha').style.display = 'none';
              document.getElementById('captchaToken').style.display = 'none';
              document.getElementById('otp').textContent = '請於30分鐘內完成驗證';
            }
          });
        </script>
      </body>
    </html>
  `);
  await page.locator("img.captcha").evaluate((image: HTMLImageElement) => {
    if (image.complete && image.naturalWidth > 0) return;
    return new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("fixture image failed")), { once: true });
    });
  });
  return page;
}

function solved(id: string): CaptchaSolveResult {
  return { text: "AB12", solveId: id, durationMs: 5 };
}

describe("Taiwan email CAPTCHA image and refresh contract", () => {
  it("blocks the irreversible final click when ownership is lost", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button type="submit">確認資料</button>
      <script>window.finalSubmitClicks = 0; document.querySelector('button').addEventListener('click', () => { window.finalSubmitClicks += 1; });</script>
    `);
    try {
      await assert.rejects(
        () => clickTwFinalSubmit(page, () => { throw new RunnerJobOwnershipLostError(); }),
        RunnerJobOwnershipLostError,
      );
      assert.equal(await page.evaluate(() => (window as unknown as { finalSubmitClicks: number }).finalSubmitClicks), 0);
    } finally {
      await page.close();
    }
  });

  it("extracts a non-empty PNG with dimensions, content type, and a hash prefix", async () => {
    const page = await captchaPage();
    try {
      const png = await page.locator("img.captcha").screenshot();
      const inspected = inspectTwCaptchaPng(png);
      assert.notEqual(typeof inspected, "string");
      if (typeof inspected === "string") return;
      assert.equal(inspected.diagnostic.contentType, "image/png");
      assert.equal(inspected.diagnostic.width, 120);
      assert.equal(inspected.diagnostic.height, 40);
      assert.ok(inspected.diagnostic.bytes >= 200);
      assert.match(inspected.diagnostic.hashPrefix, /^[a-f0-9]{12}$/);
    } finally {
      await page.close();
    }
  });

  it("rejects an empty or undersized PNG before it reaches the provider", () => {
    assert.match(String(inspectTwCaptchaPng(Buffer.alloc(0))), /too small/);
    const pngHeaderOnly = Buffer.alloc(200);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngHeaderOnly);
    pngHeaderOnly.write("IHDR", 12, "ascii");
    pngHeaderOnly.writeUInt32BE(20, 16);
    pngHeaderOnly.writeUInt32BE(10, 20);
    assert.match(String(inspectTwCaptchaPng(pngHeaderOnly)), /dimensions are too small/);
  });

  it("refreshes after unsolvable, waits for a changed hash, and submits only the new image", async () => {
    const page = await captchaPage({
      images: [svgData("AB12", "#fff"), svgData("CD34", "#dff")],
    });
    const submittedImages: Buffer[] = [];
    try {
      const telemetry = await solveTwEmailCaptchaAndSendCodeWithRetry(page, {
        maxAttempts: 3,
        refreshTimeoutMs: 1_500,
        onDiagnostic: () => undefined,
        solver: async (image) => {
          submittedImages.push(Buffer.from(image));
          if (submittedImages.length === 1) throw new TwoCaptchaApiError("ERROR_CAPTCHA_UNSOLVABLE");
          return solved("second-image");
        },
      });

      assert.equal(submittedImages.length, 2);
      assert.notDeepEqual(submittedImages[0], submittedImages[1]);
      assert.equal(await page.evaluate(() => (window as any).refreshCount), 1);
      assert.equal(await page.evaluate(() => (window as any).sendCount), 1);
      assert.equal(telemetry.at(-1)?.outcome, "solved");
      assert.equal(telemetry.at(-1)?.attempt, 2);
    } finally {
      await page.close();
    }
  });

  it("does not resubmit the same image when refresh leaves it unchanged", async () => {
    const page = await captchaPage({ images: [svgData("AB12", "#fff")] });
    let solverCalls = 0;
    try {
      await assert.rejects(
        () => solveTwEmailCaptchaAndSendCodeWithRetry(page, {
          maxAttempts: 3,
          refreshTimeoutMs: 600,
          onDiagnostic: () => undefined,
          solver: async () => {
            solverCalls += 1;
            throw new TwoCaptchaApiError("ERROR_CAPTCHA_UNSOLVABLE");
          },
        }),
        (error) => error instanceof Error &&
          /category=refresh_failed/.test(error.message) &&
          /attempts=1\/3/.test(error.message) &&
          /refreshes=1/.test(error.message),
      );
      assert.equal(solverCalls, 1);
      assert.equal(await page.evaluate(() => (window as any).refreshCount), 1);
      assert.equal(await page.evaluate(() => (window as any).sendCount ?? 0), 0);
    } finally {
      await page.close();
    }
  });

  it("fails closed when the official refresh control is missing", async () => {
    const page = await captchaPage({ includeRefresh: false });
    try {
      await assert.rejects(
        () => solveTwEmailCaptchaAndSendCodeWithRetry(page, {
          maxAttempts: 3,
          refreshTimeoutMs: 500,
          onDiagnostic: () => undefined,
          solver: async () => { throw new TwoCaptchaApiError("ERROR_CAPTCHA_UNSOLVABLE"); },
        }),
        (error) => error instanceof Error &&
          /category=refresh_failed/.test(error.message) &&
          /refresh control is not visible/.test(error.message),
      );
      assert.equal(await page.evaluate(() => (window as any).sendCount ?? 0), 0);
    } finally {
      await page.close();
    }
  });

  it("reports accurate structured counts after all changed images are unsolvable", async () => {
    const page = await captchaPage({
      images: [
        svgData("AB12", "#fff"),
        svgData("CD34", "#dff"),
        svgData("EF56", "#fdd"),
      ],
    });
    let solverCalls = 0;
    try {
      await assert.rejects(
        () => solveTwEmailCaptchaAndSendCodeWithRetry(page, {
          maxAttempts: 3,
          refreshTimeoutMs: 1_500,
          onDiagnostic: () => undefined,
          solver: async () => {
            solverCalls += 1;
            throw new TwoCaptchaApiError("ERROR_CAPTCHA_UNSOLVABLE");
          },
        }),
        (error) => error instanceof Error &&
          /attempts=3\/3/.test(error.message) &&
          /refreshes=2/.test(error.message) &&
          /category=provider_unsolvable/.test(error.message),
      );
      assert.equal(solverCalls, 3);
      assert.equal(await page.evaluate(() => (window as any).refreshCount), 2);
      assert.equal(await page.evaluate(() => (window as any).sendCount ?? 0), 0);
    } finally {
      await page.close();
    }
  });
});
