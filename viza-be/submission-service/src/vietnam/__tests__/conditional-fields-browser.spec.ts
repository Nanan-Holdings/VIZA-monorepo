import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fillVietnamPreviousVisitRows } from "../conditional-fields.js";
import { pickRadio, tickCheckbox } from "../fillers.js";
import { VN_FIELD_MAPPINGS } from "../field-mappings.js";

test("vn.conditional-fields browser: clicking Yes fills the revealed prior-visit table", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <div class="ant-form-item">
            <div>Have you been to Viet Nam in the last 01 year?</div>
            <div id="basic_ttcdDaDenVn" class="ant-radio-group">
              <label class="ant-radio-wrapper">
                <span class="ant-radio"><input type="radio" name="visited" value="no" /></span>
                <span>No</span>
              </label>
              <label class="ant-radio-wrapper">
                <span class="ant-radio"><input type="radio" name="visited" value="yes" /></span>
                <span>Yes</span>
              </label>
            </div>
          </div>
          <table id="prior-visits" style="display:none">
            <thead>
              <tr>
                <th>No</th>
                <th>From date</th>
                <th>To date</th>
                <th>Purpose of trip</th>
                <th>Add/delete</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><input aria-label="From date" /></td>
                <td><input aria-label="To date" /></td>
                <td><input aria-label="Purpose of trip" /></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <script>
            document.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
              label.addEventListener("click", () => {
                document.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                  candidate.classList.remove("ant-radio-wrapper-checked");
                  candidate.querySelector(".ant-radio").classList.remove("ant-radio-checked");
                  candidate.querySelector("input").checked = false;
                });
                label.classList.add("ant-radio-wrapper-checked");
                label.querySelector(".ant-radio").classList.add("ant-radio-checked");
                label.querySelector("input").checked = true;
                document.querySelector("#prior-visits").style.display =
                  label.innerText.trim() === "Yes" ? "table" : "none";
              });
            });
          </script>
        </body>
      </html>
    `);

    await pickRadio(page, "basic_ttcdDaDenVn", "Yes");
    await fillVietnamPreviousVisitRows(page, {
      visited_vietnam_in_last_year: "yes",
      visited_vietnam_from_date: "2026-01-02",
      visited_vietnam_to_date: "2026-01-09",
      visited_vietnam_trip_purpose: "Tourism",
    });

    assert.equal(await page.locator('input[name="visited"][value="yes"]').isChecked(), true);
    assert.equal(await page.locator('input[name="visited"][value="no"]').isChecked(), false);
    assert.equal(await page.locator('input[aria-label="From date"]').inputValue(), "02/01/2026");
    assert.equal(await page.locator('input[aria-label="To date"]').inputValue(), "09/01/2026");
    assert.equal(await page.locator('input[aria-label="Purpose of trip"]').inputValue(), "Tourism");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: Yes dispatches input/change so Vue reveals the prior-visit table", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <div class="ant-form-item">
            <div>Have you been to Viet Nam in the last 01 year?</div>
            <div id="basic_ttcdDaDenVn" class="ant-radio-group">
              <label class="ant-radio-wrapper ant-radio-wrapper-checked">
                <span class="ant-radio ant-radio-checked"><input type="radio" name="visited" value="no" checked /></span>
                <span>No</span>
              </label>
              <label class="ant-radio-wrapper">
                <span class="ant-radio"><input type="radio" name="visited" value="yes" /></span>
                <span>Yes</span>
              </label>
            </div>
          </div>
          <table id="prior-visits" style="display:none">
            <thead>
              <tr>
                <th>No</th>
                <th>From date</th>
                <th>To date</th>
                <th>Purpose of trip</th>
                <th>Add/delete</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><input aria-label="From date" /></td>
                <td><input aria-label="To date" /></td>
                <td><input aria-label="Purpose of trip" /></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <script>
            document.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
              label.addEventListener("click", (event) => {
                event.preventDefault();
                document.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                  candidate.classList.remove("ant-radio-wrapper-checked");
                  candidate.querySelector(".ant-radio").classList.remove("ant-radio-checked");
                  candidate.querySelector("input").checked = false;
                });
                label.classList.add("ant-radio-wrapper-checked");
                label.querySelector(".ant-radio").classList.add("ant-radio-checked");
                label.querySelector("input").checked = true;
              });
            });
            document.querySelectorAll('input[name="visited"]').forEach((input) => {
              input.addEventListener("change", () => {
                document.querySelector("#prior-visits").style.display =
                  input.value === "yes" && input.checked ? "table" : "none";
              });
            });
          </script>
        </body>
      </html>
    `);

    await pickRadio(page, "basic_ttcdDaDenVn", "Yes");
    await fillVietnamPreviousVisitRows(page, {
      visited_vietnam_in_last_year: "yes",
      visited_vietnam_from_date: "2026-01-02",
      visited_vietnam_to_date: "2026-01-09",
      visited_vietnam_trip_purpose: "Tourism",
    });

    assert.equal(await page.locator('input[name="visited"][value="yes"]').isChecked(), true);
    assert.equal(await page.locator('input[name="visited"][value="no"]').isChecked(), false);
    assert.equal(await page.locator('input[aria-label="From date"]').inputValue(), "02/01/2026");
    assert.equal(await page.locator('input[aria-label="To date"]').inputValue(), "09/01/2026");
    assert.equal(await page.locator('input[aria-label="Purpose of trip"]').inputValue(), "Tourism");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: id-less official Yes radio reveals and fills the prior-visit table", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <div class="pt-5 border-b">
            <div class="ant-col ant-col-24 flex justify-between pb-5">
              <div>Have you been to Viet Nam in the last 01 year?</div>
              <div>
                <div class="ant-radio-group ant-radio-group-outline">
                  <label class="ant-radio-wrapper ant-radio-wrapper-checked">
                    <span class="ant-radio ant-radio-checked"><input type="radio" class="ant-radio-input" value="0" checked /></span>
                    <span>No</span>
                  </label>
                  <label class="ant-radio-wrapper">
                    <span class="ant-radio"><input type="radio" class="ant-radio-input" value="1" /></span>
                    <span>Yes</span>
                  </label>
                </div>
              </div>
            </div>
            <table id="prior-visits" style="display:none">
              <thead>
                <tr>
                  <th>No</th>
                  <th>From date</th>
                  <th>To date</th>
                  <th>Purpose of trip</th>
                  <th>Add/delete</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td><input aria-label="From date" /></td>
                  <td><input aria-label="To date" /></td>
                  <td><input aria-label="Purpose of trip" /></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <script>
            document.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
              label.addEventListener("change", () => {
                const group = label.closest(".ant-radio-group");
                group.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                  const checked = candidate === label && candidate.querySelector("input").checked;
                  candidate.classList.toggle("ant-radio-wrapper-checked", checked);
                  candidate.querySelector(".ant-radio").classList.toggle("ant-radio-checked", checked);
                });
                document.querySelector("#prior-visits").style.display =
                  label.innerText.trim() === "Yes" && label.querySelector("input").checked ? "table" : "none";
              });
            });
          </script>
        </body>
      </html>
    `);

    await pickRadio(page, "basic_ttcdDaDenVn", "Yes");
    await fillVietnamPreviousVisitRows(page, {
      visited_vietnam_in_last_year: "yes",
      visited_vietnam_from_date: "2026-01-02",
      visited_vietnam_to_date: "2026-01-09",
      visited_vietnam_trip_purpose: "Tourism",
    });

    assert.equal(await page.locator('input[value="1"]').isChecked(), true);
    assert.equal(await page.locator('input[value="0"]').isChecked(), false);
    assert.equal(await page.locator('input[aria-label="From date"]').inputValue(), "02/01/2026");
    assert.equal(await page.locator('input[aria-label="To date"]').inputValue(), "09/01/2026");
    assert.equal(await page.locator('input[aria-label="Purpose of trip"]').inputValue(), "Tourism");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: fills official Ant table rows after the hidden measure row", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>From date</th>
                <th>To date</th>
                <th>Purpose of trip</th>
                <th>Add/delete</th>
              </tr>
            </thead>
            <tbody class="ant-table-tbody">
              <tr aria-hidden="true" class="ant-table-measure-row">
                <td><div>&nbsp;</div></td>
                <td><div>&nbsp;</div></td>
                <td><div>&nbsp;</div></td>
                <td><div>&nbsp;</div></td>
                <td><div>&nbsp;</div></td>
              </tr>
              <tr class="ant-table-row ant-table-row-level-0">
                <td>1</td>
                <td><div class="ant-picker"><div class="ant-picker-input"><input id="basic_tungDenVn_0_tuNgayStr" readonly placeholder="DD/MM/YYYY" /></div></div></td>
                <td><div class="ant-picker"><div class="ant-picker-input"><input id="basic_tungDenVn_0_denNgayStr" readonly placeholder="DD/MM/YYYY" /></div></div></td>
                <td><input id="basic_tungDenVn_0_mucDich" placeholder="Enter purpose" /></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);

    await fillVietnamPreviousVisitRows(page, {
      visited_vietnam_in_last_year: "yes",
      visited_vietnam_from_date: "2026-01-02",
      visited_vietnam_to_date: "2026-01-09",
      visited_vietnam_trip_purpose: "Tourism",
    });

    assert.equal(await page.locator("#basic_tungDenVn_0_tuNgayStr").inputValue(), "02/01/2026");
    assert.equal(await page.locator("#basic_tungDenVn_0_denNgayStr").inputValue(), "09/01/2026");
    assert.equal(await page.locator("#basic_tungDenVn_0_mucDich").inputValue(), "Tourism");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: every mapped Ant yes/no control selects the exact requested value", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const radioDomIds = Object.values(VN_FIELD_MAPPINGS)
    .filter((mapping) => mapping.type === "radio" && mapping.optionLabels?.yes === "Yes" && mapping.optionLabels?.no === "No")
    .map((mapping) => mapping.domId);
  const checkboxDomIds = Object.values(VN_FIELD_MAPPINGS)
    .filter((mapping) => mapping.type === "checkbox")
    .map((mapping) => mapping.domId);
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          ${radioDomIds
            .map(
              (domId) => `
                <div class="ant-form-item">
                  <div id="${domId}" class="ant-radio-group">
                    <label class="ant-radio-wrapper ant-radio-wrapper-checked">
                      <span class="ant-radio ant-radio-checked"><input type="radio" name="${domId}" value="no" checked /></span>
                      <span>No</span>
                    </label>
                    <label class="ant-radio-wrapper">
                      <span class="ant-radio"><input type="radio" name="${domId}" value="yes" /></span>
                      <span>Yes</span>
                    </label>
                  </div>
                </div>
              `,
            )
            .join("")}
          ${checkboxDomIds
            .map(
              (domId) => `
                <label class="ant-checkbox-wrapper">
                  <span class="ant-checkbox"><input id="${domId}" type="checkbox" /></span>
                  <span>I agree</span>
                </label>
              `,
            )
            .join("")}
          <script>
            document.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
              label.addEventListener("change", () => {
                const group = label.closest(".ant-radio-group");
                group.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                  const checked = candidate === label && candidate.querySelector("input").checked;
                  candidate.classList.toggle("ant-radio-wrapper-checked", checked);
                  candidate.querySelector(".ant-radio").classList.toggle("ant-radio-checked", checked);
                });
              });
            });
          </script>
        </body>
      </html>
    `);

    for (const domId of radioDomIds) {
      await pickRadio(page, domId, "Yes");
      assert.equal(await page.locator(`input[name="${domId}"][value="yes"]`).isChecked(), true, domId);
      assert.equal(await page.locator(`input[name="${domId}"][value="no"]`).isChecked(), false, domId);
    }

    for (const domId of checkboxDomIds) {
      await tickCheckbox(page, domId, "yes");
      assert.equal(await page.locator(`#${domId}`).isChecked(), true, domId);
      await tickCheckbox(page, domId, "no");
      assert.equal(await page.locator(`#${domId}`).isChecked(), false, domId);
    }
  } finally {
    await browser.close();
  }
});
