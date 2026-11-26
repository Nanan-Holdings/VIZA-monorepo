import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { selectPrimeFacesOption, setJsfTextInputs } from "../primefaces-ajax";

async function launch(t: test.TestContext): Promise<Browser | null> {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    t.skip("Playwright Chromium is not installed here");
    return null;
  }
}

test("setJsfTextInputs writes every field in order, skips optional blanks and fires change", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <input name="f:a" value="old"><input name="f:b"><input name="f:c" value="keep">
      <script>
        window.changes = [];
        document.addEventListener("change", (e) => window.changes.push(e.target.name), true);
      </script>`);

    await setJsfTextInputs(page, [
      ["f:a", "Alpha"],
      ["f:c", undefined],
      ["f:b", 'quote " and <tag>'],
    ]);

    assert.deepEqual(
      await page.locator("input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)),
      ["Alpha", 'quote " and <tag>', "keep"],
    );
    assert.deepEqual(await page.evaluate("window.changes"), ["f:a", "f:b"]);
  } finally {
    await browser.close();
  }
});

test("setJsfTextInputs names every missing field", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await page.setContent(`<input name="f:a">`);
    await assert.rejects(
      setJsfTextInputs(page, [
        ["f:a", "x"],
        ["f:missing1", "y"],
        ["f:missing2", ""],
      ]),
      /f:missing1", "f:missing2/,
    );
    assert.equal(await page.inputValue('input[name="f:a"]'), "x");
  } finally {
    await browser.close();
  }
});

test("selectPrimeFacesOption selects a widget that registers late", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <script>
        window.selected = null;
        window.PrimeFaces = { widgets: {} };
        setTimeout(() => {
          window.PrimeFaces.widgets.late = {
            selectValue: (v) => { window.selected = v; },
            triggerChange: () => {},
          };
        }, 400);
      </script>`);

    await selectPrimeFacesOption(page, "late", "FR", { postbackTimeoutMs: 200 });
    assert.equal(await page.evaluate("window.selected"), "FR");
    await assert.rejects(
      selectPrimeFacesOption(page, "never", "FR", { postbackTimeoutMs: 200, widgetWaitMs: 300 }),
      /widget not found/,
    );
  } finally {
    await browser.close();
  }
});
