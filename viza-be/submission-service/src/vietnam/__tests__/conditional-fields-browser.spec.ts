import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fillVietnamPreviousVisitRows } from "../conditional-fields.js";
import { pickRadio } from "../fillers.js";

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
