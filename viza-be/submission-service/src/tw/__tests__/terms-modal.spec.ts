import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import { acceptTermsModal, assertTwTermsModalCleared, withTwAgreeFirstAlertHandler } from "../terms-modal";
import { TwTermsModalError } from "../errors";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newPage(html: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(html);
  return page;
}

function pageHtml(options: {
  includeModal?: boolean;
  checkboxInitiallyDisabled?: boolean;
  checkboxHidesModal?: boolean;
  labelMode?: "associated" | "wrapped";
  labelOwnsCheck?: boolean;
  rerenderOnChange?: boolean;
  rejectCheckedState?: boolean;
} = {}): string {
  const includeModal = options.includeModal ?? true;
  const checkboxInitiallyDisabled = options.checkboxInitiallyDisabled ?? false;
  const checkboxHidesModal = options.checkboxHidesModal ?? true;
  const labelMode = options.labelMode ?? "associated";
  const checkboxMarkup = labelMode === "wrapped"
    ? `<label>同意上述條款，請打勾。<input id="agreeTerms" type="checkbox" ${checkboxInitiallyDisabled ? "disabled" : ""} /></label>`
    : `<input id="agreeTerms" type="checkbox" ${checkboxInitiallyDisabled ? "disabled" : ""} /><label for="agreeTerms">同意上述條款，請打勾。</label>`;
  return `
    <!doctype html>
    <html>
      <body>
        ${includeModal ? `
          <div class="modal" role="dialog" style="display:block">
            <div class="modal-dialog">
              <div class="modal-content">
                <div class="modal-body">
                  <p>條款內容</p>
                  ${checkboxMarkup}
                </div>
                <div class="modal-footer">
                  <button id="termsOk" class="btn btn-primary" type="button">確定</button>
                  <button id="termsCancel" class="btn btn-danger" type="button">取消</button>
                </div>
              </div>
            </div>
          </div>
        ` : ""}
        <select name="continent">
          <option value="">請選擇</option>
          <option value="A">亞洲</option>
        </select>
        <select name="overseaOfficeId">
          <option value="">請選擇</option>
          <option value="53">新加坡</option>
        </select>
        <button id="next" type="button">下一步</button>
        <button id="finalSubmit" type="button">確認資料</button>
        <script>
          window.firstStepStarted = false;
          window.finalSubmitted = false;
          document.querySelector('[name="continent"]').addEventListener('change', () => {
            window.firstStepStarted = true;
            if (document.querySelector('.modal')?.offsetParent !== null) {
              throw new Error('first step touched before modal cleared');
            }
          });
          document.querySelector('[name="overseaOfficeId"]').addEventListener('change', () => {
            window.firstStepStarted = true;
            if (document.querySelector('.modal')?.offsetParent !== null) {
              throw new Error('office touched before modal cleared');
            }
          });
          document.getElementById('next').addEventListener('click', () => {
            window.firstStepStarted = true;
            document.body.dataset.step = 'application';
          });
          document.getElementById('finalSubmit').addEventListener('click', () => {
            window.finalSubmitted = true;
          });
          const ok = document.getElementById('termsOk');
          const currentCheckbox = () => document.getElementById('agreeTerms');
          const bindCheckbox = (checkbox) => {
            if (${options.rejectCheckedState ? "true" : "false"}) {
              checkbox.addEventListener('click', (event) => event.preventDefault());
              const reject = () => { checkbox.checked = false; };
              checkbox.addEventListener('input', reject);
              checkbox.addEventListener('change', reject);
            }
            checkbox.addEventListener('change', () => {
              window.termsCheckboxClicked = true;
              if (${options.rerenderOnChange ? "true" : "false"} && !checkbox.dataset.rerendered) {
                const replacement = checkbox.cloneNode(true);
                replacement.dataset.rerendered = 'true';
                replacement.checked = true;
                checkbox.replaceWith(replacement);
                bindCheckbox(replacement);
              }
            });
          };
          const checkbox = currentCheckbox();
          if (ok && checkbox) {
            bindCheckbox(checkbox);
            const label = document.querySelector('label');
            if (label && ${options.labelOwnsCheck ? "true" : "false"}) {
              checkbox.addEventListener('click', (event) => event.preventDefault());
              label.addEventListener('click', (event) => {
                event.preventDefault();
                const active = currentCheckbox();
                active.checked = true;
                active.dispatchEvent(new Event('input', { bubbles: true }));
                active.dispatchEvent(new Event('change', { bubbles: true }));
              });
            }
            ok.addEventListener('click', () => {
              window.termsOkClicked = true;
              if (!currentCheckbox().checked) {
                window.bottomOkBeforeCheckbox = true;
                alert('請先勾選同意條款 Agree first');
                return;
              }
              window.termsOkClicked = true;
              if (${checkboxHidesModal ? "true" : "false"}) {
                document.querySelector('.modal').style.display = 'none';
              }
            });
          }
        </script>
      </body>
    </html>
  `;
}

async function completeFirstStep(page: Page): Promise<void> {
  await assertTwTermsModalCleared(page);
  await page.locator('[name="continent"]').selectOption("A");
  await page.locator('[name="overseaOfficeId"]').selectOption("53");
  await page.getByRole("button", { name: "下一步" }).click();
}

describe("Taiwan official terms modal handling", () => {
  it("recovers from an existing Agree-first alert and rejects unknown alert text", async () => {
    const page = await newPage(pageHtml({ includeModal: false }));
    try {
      await withTwAgreeFirstAlertHandler(page, async () => {
        await page.evaluate(() => alert("請先勾選同意條款 Agree first"));
      });
      await assert.rejects(
        () =>
          withTwAgreeFirstAlertHandler(page, async () => {
            await page.evaluate(() => alert("未知提示"));
          }),
        TwTermsModalError,
      );
    } finally {
      await page.close();
    }
  });

  it("uses the normal checkbox-then-OK path without producing the Agree-first alert", async () => {
    const page = await newPage(pageHtml());
    try {
      const handled = await acceptTermsModal(page);
      assert.equal(handled, true);
      assert.equal(await page.evaluate(() => (window as any).termsOkClicked), true);
      assert.equal(await page.evaluate(() => (window as any).termsCheckboxClicked), true);
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), undefined);

      await completeFirstStep(page);

      assert.equal(await page.locator('[name="continent"]').inputValue(), "A");
      assert.equal(await page.locator('[name="overseaOfficeId"]').inputValue(), "53");
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
      assert.equal(await page.evaluate(() => (window as any).finalSubmitted), false);
    } finally {
      await page.close();
    }
  });

  it("uses the associated label when direct checkbox interaction is rejected", async () => {
    const page = await newPage(pageHtml({ labelMode: "associated", labelOwnsCheck: true }));
    try {
      assert.equal(await acceptTermsModal(page), true);
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), undefined);
      assert.equal(await page.evaluate(() => (window as any).termsCheckboxClicked), true);
    } finally {
      await page.close();
    }
  });

  it("supports a wrapping label when it owns the checkbox state change", async () => {
    const page = await newPage(pageHtml({ labelMode: "wrapped", labelOwnsCheck: true }));
    try {
      assert.equal(await acceptTermsModal(page), true);
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), undefined);
    } finally {
      await page.close();
    }
  });

  it("re-resolves and verifies the checkbox after the official page rerenders it", async () => {
    const page = await newPage(pageHtml({ rerenderOnChange: true }));
    try {
      assert.equal(await acceptTermsModal(page), true);
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), undefined);
    } finally {
      await page.close();
    }
  });

  it("continues with checkbox-then-OK after the takeover alert is accepted", async () => {
    const page = await newPage(pageHtml());
    try {
      await withTwAgreeFirstAlertHandler(page, async () => {
        await page.evaluate(() => alert("請先勾選同意條款 Agree first"));
      });

      const handled = await acceptTermsModal(page);
      assert.equal(handled, true);
      assert.equal(await page.evaluate(() => (window as any).termsCheckboxClicked), true);
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), undefined);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("recovers after an earlier incorrect OK click produced Agree first", async () => {
    const page = await newPage(pageHtml());
    try {
      await withTwAgreeFirstAlertHandler(page, async () => {
        await page.getByRole("button", { name: "確定" }).click();
      });
      assert.equal(await page.evaluate(() => (window as any).bottomOkBeforeCheckbox), true);

      assert.equal(await acceptTermsModal(page), true);
      assert.equal(await page.evaluate(() => (window as any).termsCheckboxClicked), true);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("skips idempotently when the terms modal is not present", async () => {
    const page = await newPage(pageHtml({ includeModal: false }));
    try {
      const handled = await acceptTermsModal(page);
      assert.equal(handled, false);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
      assert.equal(await page.evaluate(() => (window as any).finalSubmitted), false);
    } finally {
      await page.close();
    }
  });

  it("fails closed when the checkbox is not enabled", async () => {
    const page = await newPage(pageHtml({ checkboxInitiallyDisabled: true }));
    try {
      await assert.rejects(() => acceptTermsModal(page), TwTermsModalError);
      assert.equal(await page.evaluate(() => (window as any).termsOkClicked), undefined);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
    } finally {
      await page.close();
    }
  });

  it("fails closed without clicking OK when every interaction leaves the checkbox unchecked", async () => {
    const page = await newPage(pageHtml({ rejectCheckedState: true }));
    try {
      await assert.rejects(
        () => acceptTermsModal(page),
        (error: unknown) => error instanceof TwTermsModalError && /not checked after verified interactions/.test(error.message),
      );
      assert.equal(await page.evaluate(() => (window as any).termsOkClicked), undefined);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
      assert.equal(await page.evaluate(() => (window as any).finalSubmitted), false);
    } finally {
      await page.close();
    }
  });

  it("fails closed if the modal does not disappear after the checkbox is checked", async () => {
    const page = await newPage(pageHtml({ checkboxHidesModal: false }));
    try {
      await assert.rejects(() => acceptTermsModal(page), TwTermsModalError);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
    } finally {
      await page.close();
    }
  });

  it("does not continue to first-step controls while the modal remains visible", async () => {
    const page = await newPage(pageHtml({ checkboxHidesModal: false }));
    try {
      await assert.rejects(() => assertTwTermsModalCleared(page), TwTermsModalError);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
      assert.equal(await page.evaluate(() => (window as any).finalSubmitted), false);
    } finally {
      await page.close();
    }
  });
});
