import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { chromium, type Locator, type Page } from "@playwright/test";
import {
  DS160_REPEAT_GROUP_CONTRACT_LIST,
  DS160_REPEAT_GROUP_NAMES,
} from "../../ds160-repeat-contract";
import {
  decodeRepeatGroupAnswers,
  Ds160RepeatGroupError,
  encodeRepeatGroupRows,
  executeDs160RepeatGroup,
  type Ds160RepeatExecutionAdapter,
} from "../repeat-groups";

const REPEAT_FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <button id="add-row" type="button">Add another phone</button>
    <section id="rows" data-repeat-group="additional_phones"></section>
    <script>
      (function () {
        var persisted = {};
        try { persisted = JSON.parse(window.name || "{}"); } catch (_) { persisted = {}; }
        var count = Number.isInteger(persisted.count) && persisted.count > 0 ? persisted.count : 1;
        var values = persisted.values && typeof persisted.values === "object" ? persisted.values : {};
        var rows = document.getElementById("rows");
        var add = document.getElementById("add-row");
        function key(index) { return index === 0 ? "additional_phone" : "additional_phone__" + (index + 1); }
        function persist() { window.name = JSON.stringify({ count: count, values: values }); }
        function render() {
          rows.innerHTML = "";
          for (var index = 0; index < count; index += 1) {
            var row = document.createElement("div");
            row.setAttribute("data-repeat-row", String(index));
            var input = document.createElement("input");
            input.type = "text";
            input.name = key(index);
            input.setAttribute("data-field", "additional_phone");
            input.value = values[key(index)] || "";
            input.addEventListener("input", (function (fieldKey, control) {
              return function () { values[fieldKey] = control.value; persist(); };
            })(key(index), input));
            row.appendChild(input);
            if (count > 1) {
              var remove = document.createElement("button");
              remove.type = "button";
              remove.setAttribute("data-remove", "true");
              remove.textContent = "Remove";
              remove.addEventListener("click", (function (removedIndex) {
                return function () {
                  for (var shift = removedIndex; shift < count - 1; shift += 1) {
                    values[key(shift)] = values[key(shift + 1)] || "";
                  }
                  delete values[key(count - 1)];
                  count -= 1;
                  persist();
                  render();
                };
              })(index));
              row.appendChild(remove);
            }
            rows.appendChild(row);
          }
        }
        add.addEventListener("click", function () {
          if (count >= 5) return;
          count += 1;
          persist();
          render();
        });
        render();
      }());
    </script>
  </body>
</html>`;

async function withRepeatFixture<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(REPEAT_FIXTURE_HTML);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Repeat fixture server did not expose a TCP address.");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${address.port}/repeat-fixture`);
    return await run(page);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("DS-160 repeat contract covers all 22 active seed groups and 73 row fields", () => {
  assert.equal(DS160_REPEAT_GROUP_NAMES.length, 22);
  assert.equal(DS160_REPEAT_GROUP_CONTRACT_LIST.length, 22);
  assert.equal((DS160_REPEAT_GROUP_NAMES as readonly string[]).includes("specific_travel_plans"), false);
  assert.equal(
    DS160_REPEAT_GROUP_CONTRACT_LIST.reduce(
      (total, contract) => total + contract.rowFieldKeys.length,
      0,
    ),
    73,
  );
  for (const contract of DS160_REPEAT_GROUP_CONTRACT_LIST) {
    assert.equal(contract.controls.verified, false);
    assert.equal(contract.controls.rowSelector, null);
    assert.equal(contract.controls.addSelector, null);
    assert.equal(contract.controls.removeSelector, null);
    assert.ok(contract.page.length > 0);
  }
});

test("decoder preserves a partially populated second row and exact source keys", () => {
  const decoded = decodeRepeatGroupAnswers(
    {
      prev_employer_name: "FIRST EMPLOYER",
      prev_employer_name__2: "SECOND EMPLOYER",
      prev_employer_city__2: "SECOND CITY",
      prev_employer_name__3: "THIRD EMPLOYER",
      unrelated_answer: "ignored",
    },
    "previous_employers",
  );

  assert.deepEqual(decoded.rows.map((row) => row.index), [0, 1, 2]);
  assert.equal(decoded.rows[1].values.prev_employer_name, "SECOND EMPLOYER");
  assert.equal(decoded.rows[1].values.prev_employer_city, "SECOND CITY");
  assert.equal(decoded.rows[1].sourceKeys.prev_employer_name, "prev_employer_name__2");
  assert.equal(decoded.hasGaps, false);
});

test("decoder reports gaps and round-trips the original row index without renumbering", () => {
  const decoded = decodeRepeatGroupAnswers(
    { additional_phone__3: "+1 212 555 0103" },
    "additional_phones",
  );

  assert.deepEqual(decoded.rows.map((row) => row.index), [2]);
  assert.deepEqual(decoded.missingIndices, [0, 1]);
  assert.equal(decoded.rows[0].storageSuffix, "__3");
  assert.deepEqual(encodeRepeatGroupRows("additional_phones", decoded.rows), {
    additional_phone__3: "+1 212 555 0103",
  });
});

test("Playwright fixture persists add, remove, compacting, and reload semantics", async () => {
  await withRepeatFixture(async (page) => {
    await page.locator("#add-row").click();
    await page.locator('[name="additional_phone"]').fill("FIRST PHONE");
    await page.locator('[name="additional_phone__2"]').fill("SECOND PHONE");

    const beforeRemove = JSON.parse(
      (await page.evaluate(() => window.name)) as string,
    ) as { count: number; values: Record<string, string> };
    assert.equal(beforeRemove.count, 2);
    assert.equal(beforeRemove.values.additional_phone__2, "SECOND PHONE");

    await page.locator('[data-repeat-row="0"] [data-remove]').click();
    const afterRemove = JSON.parse(
      (await page.evaluate(() => window.name)) as string,
    ) as { count: number; values: Record<string, string> };
    assert.equal(afterRemove.count, 1);
    assert.equal(afterRemove.values.additional_phone, "SECOND PHONE");
    assert.equal(afterRemove.values.additional_phone__2, undefined);

    await page.reload();
    assert.equal(
      await page.locator('[name="additional_phone"]').inputValue(),
      "SECOND PHONE",
    );
    const reloadedValues = JSON.parse(
      (await page.evaluate(() => window.name)) as string,
    ) as { values: Record<string, string> };
    const decoded = decodeRepeatGroupAnswers(
      reloadedValues.values,
      "additional_phones",
    );
    assert.deepEqual(decoded.rows.map((row) => row.index), [0]);
    assert.equal(decoded.rows[0].values.additional_phone, "SECOND PHONE");
  });
});

test("condition off skips a repeat group and condition on fills both persisted rows", async () => {
  await withRepeatFixture(async (page) => {
    let resolvedPages = 0;
    const adapter: Ds160RepeatExecutionAdapter<Page, Locator> = {
      resolvePage: () => {
        resolvedPages += 1;
        return page;
      },
      getRowCount: ({ page: currentPage }) =>
        currentPage.locator("[data-repeat-group=additional_phones] [data-repeat-row]").count(),
      addRow: ({ page: currentPage }) => currentPage.locator("#add-row").click(),
      removeRow: ({ page: currentPage, rowIndex }) =>
        currentPage
          .locator(`[data-repeat-row="${rowIndex}"] [data-remove]`)
          .click(),
      resolveRow: ({ page: currentPage, row }) =>
        currentPage.locator(`[data-repeat-row="${row.index}"]`),
      fillRow: async ({ rowHandle, activeFieldKeys, fieldAnswers }) => {
        assert.ok(rowHandle);
        for (const fieldKey of activeFieldKeys) {
          const value = fieldAnswers[fieldKey];
          if (value !== undefined) {
            await rowHandle.locator(`[data-field="${fieldKey}"]`).fill(value);
          }
        }
      },
      selectorEvidence: () => ({
        verified: true,
        source: "local-playwright-fixture",
        note: "Test-only fixture controls; this is not official CEAC evidence.",
      }),
      isGroupActive: ({ answers }) => answers.has_other_phones === "yes",
    };

    const skipped = await executeDs160RepeatGroup({
      group: "additional_phones",
      answers: {
        has_other_phones: "no",
        additional_phone: "MUST NOT FILL",
      },
      adapter,
    });
    assert.equal(skipped.status, "skipped");
    assert.equal(skipped.reason, "condition_inactive");
    assert.equal(resolvedPages, 0);
    assert.equal(await page.locator('[name="additional_phone"]').inputValue(), "");

    const filled = await executeDs160RepeatGroup({
      group: "additional_phones",
      answers: {
        has_other_phones: "yes",
        additional_phone: "FIRST ACTIVE",
        additional_phone__2: "SECOND ACTIVE",
      },
      adapter,
    });
    assert.equal(filled.status, "filled");
    assert.deepEqual(filled.filledRowIndices, [0, 1]);
    assert.equal(filled.actualRowCount, 2);
    assert.equal(await page.locator('[name="additional_phone"]').inputValue(), "FIRST ACTIVE");
    assert.equal(
      await page.locator('[name="additional_phone__2"]').inputValue(),
      "SECOND ACTIVE",
    );
  });
});

test("row growth fails closed when no verified selector evidence is supplied", async () => {
  await withRepeatFixture(async (page) => {
    const adapter: Ds160RepeatExecutionAdapter<Page> = {
      resolvePage: () => page,
      getRowCount: ({ page: currentPage }) =>
        currentPage.locator("[data-repeat-group=additional_phones] [data-repeat-row]").count(),
      fillRow: () => undefined,
      isGroupActive: ({ answers }) => answers.has_other_phones === "yes",
    };

    await assert.rejects(
      () =>
        executeDs160RepeatGroup({
          group: "additional_phones",
          answers: {
            has_other_phones: "yes",
            additional_phone: "FIRST",
            additional_phone__2: "SECOND",
          },
          adapter,
        }),
      (error: unknown) =>
        error instanceof Ds160RepeatGroupError &&
        error.code === "unverified_selector_strategy" &&
        error.verified === false,
    );
  });
});
