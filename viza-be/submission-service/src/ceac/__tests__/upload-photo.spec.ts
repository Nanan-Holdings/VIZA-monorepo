import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  getIdentixPhotoServiceErrorUrl,
  handleUploadPhotoPage,
  IdentixPhotoServiceError,
  PhotoRejectedError,
} from "../upload-photo";

const CEAC_UPLOAD_URL =
  "https://ceac.state.gov/GenNIV/General/photo/photo_uploadthephoto.aspx?node=UploadPhoto";

function ceacUploadPage(): string {
  return `<!doctype html>
    <form action="https://identix.state.gov/qotw/Upload.aspx?handoff=secret-token" method="get">
      <input id="ctl00_cphMain_btnUploadPhoto" type="submit" value="Upload Photo">
    </form>`;
}

function identixUploadPage(action: string): string {
  return `<!doctype html>
    <form action="${action}" method="post" enctype="multipart/form-data">
      <input id="ctl00_cphMain_imageFileUpload" name="ctl00$cphMain$imageFileUpload" type="file">
      <input id="ctl00_cphButtons_btnUpload" name="ctl00$cphButtons$btnUpload"
        type="image" class="next" src="/upload.png">
    </form>`;
}

function cleanupTempOutput(outputDir: string, prefix: string): void {
  const tempRoot = resolve(tmpdir()).toLowerCase();
  const resolvedOutput = resolve(outputDir);
  if (
    dirname(resolvedOutput).toLowerCase() !== tempRoot ||
    !basename(resolvedOutput).startsWith(prefix)
  ) {
    throw new Error(`Refusing to remove unexpected test output path: ${resolvedOutput}`);
  }
  rmSync(resolvedOutput, { recursive: true, force: true });
}

test("classifies only the exact official Identix error path and strips query data", () => {
  assert.equal(
    getIdentixPhotoServiceErrorUrl(
      "https://identix.state.gov/qotw/Error.html?aspxerrorpath=%2Fqotw%2FUpload.aspx&handoff=secret-token",
    ),
    "https://identix.state.gov/qotw/Error.html",
  );
  assert.equal(
    getIdentixPhotoServiceErrorUrl("https://evil.example/qotw/Error.html?handoff=secret-token"),
    null,
  );
  assert.equal(
    getIdentixPhotoServiceErrorUrl("https://identix.state.gov.evil.example/qotw/Error.html"),
    null,
  );
  assert.equal(
    getIdentixPhotoServiceErrorUrl("https://identix.state.gov/qotw/Upload.aspx"),
    null,
  );
});

test("classifies an Identix error during the initial handoff without uploading", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.context().route("**/*", route => route.abort());
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: ceacUploadPage().replace("Upload.aspx", "Error.html"),
    }));
    await page.route("https://identix.state.gov/**", route => route.fulfill({
      status: 500, contentType: "text/html", body: "<h1>Service error</h1>",
    }));
    await page.goto(CEAC_UPLOAD_URL);
    const started = Date.now();
    await assert.rejects(handleUploadPhotoPage(page, {
      photo: { kind: "buffer", buffer: Buffer.from("fixture-photo"), filename: "fixture.jpg" },
      timeoutMs: 2_000,
    }), IdentixPhotoServiceError);
    assert.ok(Date.now() - started < 8_000);
  } finally { await browser.close(); }
});

for (const rejected of [false, true]) {
  test(`popup multipart upload ${rejected ? "reports rejection" : "waits for confirmation"} while the original upload page remains`, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    let uploads = 0;
    let continuations = 0;
    let postedBody = "";
    let postedContentType = "";
    try {
      await context.route("**/*", route => route.abort());
      await context.route("https://ceac.state.gov/**", async route => {
        if (/photo_confirmphoto/i.test(route.request().url())) {
          continuations++;
          const body = route.request().postData() ?? "";
          assert.match(body, /ctl00%24cphButtons%24btnContinue\.x=5/);
          assert.match(body, /ctl00%24cphButtons%24btnContinue\.y=5/);
          await route.fulfill({ contentType: "text/html", body: "<h2>Confirm Photo</h2>" });
        } else {
          await route.fulfill({ contentType: "text/html",
            body: ceacUploadPage().replace('<form ', '<form target="identix-popup" ') });
        }
      });
      await context.route("https://identix.state.gov/**", async route => {
        const request = route.request();
        if (request.method() === "POST") {
          uploads++;
          postedBody = request.postDataBuffer()?.toString("utf8") ?? "";
          postedContentType = request.headers()["content-type"] ?? "";
          if (rejected) {
            await route.fulfill({ contentType: "text/html", body: '<span id="lblError">Synthetic photo rejection</span>' });
          } else {
            await route.fulfill({ contentType: "text/html", body: `<form method="post" action="https://ceac.state.gov/GenNIV/General/photo/photo_confirmphoto.aspx?node=ConfirmPhoto">
              <input id="ctl00_cphButtons_btnContinue" name="ctl00$cphButtons$btnContinue" type="image" src="/continue.png"></form>` });
          }
        } else if (/Result\.aspx/i.test(request.url())) {
          await route.fulfill({ contentType: "text/html", body: `<form method="post" action="https://ceac.state.gov/GenNIV/General/photo/photo_confirmphoto.aspx?node=ConfirmPhoto">
            <input id="ctl00_cphButtons_btnContinue" name="ctl00$cphButtons$btnContinue" type="image" src="/continue.png"></form>` });
        } else {
          await route.fulfill({ contentType: "text/html", body: identixUploadPage(`https://identix.state.gov/qotw/${rejected ? "Upload" : "Result"}.aspx`) });
        }
      });
      await page.goto(CEAC_UPLOAD_URL);
      const started = Date.now();
      const run = handleUploadPhotoPage(page, {
        photo: { kind: "buffer", buffer: Buffer.from("multipart-fixture-photo"), filename: "fixture.jpg", mimeType: "image/jpeg" },
        timeoutMs: 3_000,
      });
      if (rejected) {
        await assert.rejects(run, error => error instanceof PhotoRejectedError && error.message === "Synthetic photo rejection");
      } else {
        const result = await run;
        assert.equal(result.accepted, true);
        assert.notEqual(result.page, page);
        assert.equal(continuations, 1);
      }
      assert.equal(page.url(), CEAC_UPLOAD_URL);
      assert.equal(uploads, 1);
      assert.match(postedContentType, /^multipart\/form-data; boundary=/);
      assert.match(postedBody, /name="ctl00\$cphMain\$imageFileUpload"; filename="fixture\.jpg"/);
      assert.match(postedBody, /multipart-fixture-photo/);
      assert.match(postedBody, /name="ctl00\$cphButtons\$btnUpload\.x"/);
      assert.match(postedBody, /name="ctl00\$cphButtons\$btnUpload\.y"/);
      assert.ok(Date.now() - started < 10_000, "popup must not wait for navigation on the stale original page");
    } finally { await browser.close(); }
  });
}

test("fails immediately with an independent service error and preserves a query-free diagnostic", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-photo-error-"));
  const diagnosticPath = join(outputDir, "upload-photo-dom.json");
  try {
    await page.context().route("**/*", route => route.abort());
    await page.route("https://ceac.state.gov/**", route =>
      route.fulfill({ contentType: "text/html", body: ceacUploadPage() }),
    );
    await page.route("https://identix.state.gov/**", route => {
      const url = route.request().url();
      if (/\/qotw\/Error\.html/i.test(url)) {
        return route.fulfill({
          status: 500,
          contentType: "text/html",
          body: "<h1>Official photo service error</h1>",
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: identixUploadPage(
          "https://identix.state.gov/qotw/Error.html?aspxerrorpath=%2Fqotw%2FUpload.aspx&handoff=secret-token",
        ),
      });
    });
    await page.goto(CEAC_UPLOAD_URL, { waitUntil: "domcontentloaded" });

    const startedAt = Date.now();
    await assert.rejects(
      handleUploadPhotoPage(page, {
        photo: {
          kind: "buffer",
          buffer: Buffer.from("synthetic-photo"),
          filename: "synthetic.jpg",
          mimeType: "image/jpeg",
        },
        diagnosticPath,
        timeoutMs: 5_000,
      }),
      error => {
        assert.ok(error instanceof IdentixPhotoServiceError);
        assert.equal(error.code, "IDENTIX_PHOTO_SERVICE_ERROR");
        assert.equal(error.serviceUrl, "https://identix.state.gov/qotw/Error.html");
        assert.doesNotMatch(error.message, /secret|aspxerrorpath/i);
        return true;
      },
    );
    assert.ok(Date.now() - startedAt < 10_000);
    const diagnostic = JSON.parse(readFileSync(diagnosticPath, "utf8")) as { url: string };
    assert.equal(diagnostic.url, "https://identix.state.gov/qotw/Error.html");
    assert.doesNotMatch(JSON.stringify(diagnostic), /secret-token|aspxerrorpath/i);
  } finally {
    await browser.close();
    cleanupTempOutput(outputDir, "ceac-photo-error-");
  }
});

test("continues the normal Identix Upload to Result to CEAC confirmation flow", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.context().route("**/*", route => route.abort());
    await page.route("https://ceac.state.gov/**", route =>
      route.fulfill({
        contentType: "text/html",
        body: /ConfirmPhoto/i.test(route.request().url())
          ? "<h2>Confirm Photo</h2>"
          : ceacUploadPage(),
      }),
    );
    await page.route("https://identix.state.gov/**", route => {
      const url = route.request().url();
      if (/\/qotw\/Result\.aspx/i.test(url)) {
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html>
            <form action="https://ceac.state.gov/GenNIV/General/photo/photo_confirmphoto.aspx?node=ConfirmPhoto" method="post">
              <input id="ctl00_cphButtons_btnContinue" name="ctl00$cphButtons$btnContinue"
                type="image" src="/continue.png">
            </form>`,
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: identixUploadPage(
          "https://identix.state.gov/qotw/Result.aspx?handoff=synthetic-token",
        ),
      });
    });
    await page.goto(CEAC_UPLOAD_URL, { waitUntil: "domcontentloaded" });

    const result = await handleUploadPhotoPage(page, {
      photo: {
        kind: "buffer",
        buffer: Buffer.from("synthetic-photo"),
        filename: "synthetic.jpg",
        mimeType: "image/jpeg",
      },
      timeoutMs: 5_000,
    });
    assert.equal(result.accepted, true);
    assert.match(result.postContinueUrl ?? "", /photo_confirmphoto\.aspx\?node=ConfirmPhoto$/i);
    assert.equal(await result.page.locator("h2").innerText(), "Confirm Photo");
  } finally {
    await browser.close();
  }
});
