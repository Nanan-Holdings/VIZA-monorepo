import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import {
  fillVietnamConditionalRepeatGroups,
  fillVietnamPreviousVisitRows,
} from "../conditional-fields.js";
import { pickRadio, pickSelect, tickCheckbox } from "../fillers.js";
import { VN_COUNTRY_OPTION_ORDER } from "../country-options.js";
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

test("vn.conditional-fields browser: fills every mapped dynamic table after selecting Yes", { timeout: 20_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          ${renderIdlessQuestion(
            "Have you ever used any other passports to enter into Viet Nam?",
            "other-passports",
          )}
          ${renderTable("other-passports-table", ["Passport", "Full name", "Date of birth", "Nationality"])}
          ${renderIdlessQuestion(
            "Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?",
            "contacts",
          )}
          ${renderTable("contacts-table", ["Name of hosting organization", "Telephone number", "Address", "Purpose"])}
          ${renderIdlessQuestion(
            "Do you have relatives who currently reside in Viet Nam?",
            "relatives",
          )}
          ${renderTable("relatives-table", ["Full name", "Date of birth", "Nationality", "Relationship", "Address"])}
          <script>
            document.querySelectorAll("[data-question]").forEach((question) => {
              question.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
                label.addEventListener("change", () => {
                  const group = label.closest(".ant-radio-group");
                  group.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                    const checked = candidate === label && candidate.querySelector("input").checked;
                    candidate.classList.toggle("ant-radio-wrapper-checked", checked);
                    candidate.querySelector(".ant-radio").classList.toggle("ant-radio-checked", checked);
                  });
                  document.querySelector("#" + question.dataset.question + "-table").style.display =
                    label.innerText.trim() === "Yes" && label.querySelector("input").checked ? "table" : "none";
                });
              });
            });
          </script>
        </body>
      </html>
    `);

    const answers = {
      has_other_passports_used_for_vietnam: "yes",
      other_vietnam_passport_number: "E1234567",
      other_vietnam_passport_full_name: "ZHANG SAN",
      other_vietnam_passport_date_of_birth: "1990-05-06",
      other_vietnam_passport_nationality: "China",
      has_contact_in_vietnam: "yes",
      contact_hosting_organization_name: "VIZA Vietnam",
      contact_hosting_organization_phone: "+84901234567",
      contact_hosting_organization_address: "Hanoi",
      contact_hosting_organization_purpose: "Tourism assistance",
      has_relatives_in_vietnam: "yes",
      relative_full_name: "NGUYEN VAN A",
      relative_date_of_birth: "1988-02-03",
      relative_nationality: "China",
      relative_relationship: "Friend",
      relative_residential_address: "Da Nang",
    };

    await pickRadio(page, "basic_ttcnDaDungHcKhacVaoVn", "Yes");
    await fillVietnamConditionalRepeatGroups(page, answers, "has_other_passports_used_for_vietnam");
    await pickRadio(page, "basic_ttcdCoCqTcCaNhanLienHe", "Yes");
    await fillVietnamConditionalRepeatGroups(page, answers, "has_contact_in_vietnam");
    await pickRadio(page, "basic_ttcdCoThanNhan", "Yes");
    await fillVietnamConditionalRepeatGroups(page, answers, "has_relatives_in_vietnam");

    assert.equal(await page.locator('[data-question="other-passports"] input[value="yes"]').isChecked(), true);
    assert.equal(await page.locator('[data-question="other-passports"] input[value="no"]').isChecked(), false);
    assert.equal(await page.locator("#other-passports-table tbody tr").locator("input").nth(0).inputValue(), "E1234567");
    assert.equal(await page.locator("#other-passports-table tbody tr").locator("input").nth(1).inputValue(), "ZHANG SAN");
    assert.equal(await page.locator("#other-passports-table tbody tr").locator("input").nth(2).inputValue(), "06/05/1990");
    assert.equal(await page.locator("#other-passports-table tbody tr").locator("input").nth(3).inputValue(), "China");

    assert.equal(await page.locator('[data-question="contacts"] input[value="yes"]').isChecked(), true);
    assert.equal(await page.locator('[data-question="contacts"] input[value="no"]').isChecked(), false);
    assert.equal(await page.locator("#contacts-table tbody tr").locator("input").nth(0).inputValue(), "VIZA Vietnam");
    assert.equal(await page.locator("#contacts-table tbody tr").locator("input").nth(1).inputValue(), "+84901234567");
    assert.equal(await page.locator("#contacts-table tbody tr").locator("input").nth(2).inputValue(), "Hanoi");
    assert.equal(await page.locator("#contacts-table tbody tr").locator("input").nth(3).inputValue(), "Tourism assistance");

    assert.equal(await page.locator('[data-question="relatives"] input[value="yes"]').isChecked(), true);
    assert.equal(await page.locator('[data-question="relatives"] input[value="no"]').isChecked(), false);
    assert.equal(await page.locator("#relatives-table tbody tr").locator("input").nth(0).inputValue(), "NGUYEN VAN A");
    assert.equal(await page.locator("#relatives-table tbody tr").locator("input").nth(1).inputValue(), "03/02/1988");
    assert.equal(await page.locator("#relatives-table tbody tr").locator("input").nth(2).inputValue(), "China");
    assert.equal(await page.locator("#relatives-table tbody tr").locator("input").nth(3).inputValue(), "Friend");
    assert.equal(await page.locator("#relatives-table tbody tr").locator("input").nth(4).inputValue(), "Da Nang");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: selects exact country values in official dynamic table dropdowns", { timeout: 20_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          ${renderIdlessQuestion(
            "Have you ever used any other passports to enter into Viet Nam?",
            "other-passports",
          )}
          ${renderOfficialDynamicTable("other-passports-table", [
            { header: "Passport", inputId: "basic_hcKhac_0_soHoChieu" },
            { header: "Full name", inputId: "basic_hcKhac_0_hoTen" },
            { header: "Date of birth", inputId: "basic_hcKhac_0_ngaySinhStr" },
            {
              header: "Nationality",
              inputId: "basic_hcKhac_0_quocTich",
              selectOptions: ["China", "Hungary", "Panama"],
            },
          ])}
          ${renderIdlessQuestion(
            "Do you have relatives who currently reside in Viet Nam?",
            "relatives",
          )}
          ${renderOfficialDynamicTable("relatives-table", [
            { header: "Full name", inputId: "basic_thanNhanOVn_0_hoTen" },
            { header: "Date of birth", inputId: "basic_thanNhanOVn_0_ngaySinhStr" },
            {
              header: "Nationality",
              inputId: "basic_thanNhanOVn_0_quocTich",
              selectOptions: ["China", "Hungary", "Panama"],
            },
            { header: "Relationship", inputId: "basic_thanNhanOVn_0_quanHe" },
            { header: "Residential address", inputId: "basic_thanNhanOVn_0_diaChi" },
          ])}
          <script>
            document.querySelectorAll("[data-question]").forEach((question) => {
              question.querySelectorAll(".ant-radio-wrapper").forEach((label) => {
                label.addEventListener("change", () => {
                  const group = label.closest(".ant-radio-group");
                  group.querySelectorAll(".ant-radio-wrapper").forEach((candidate) => {
                    const checked = candidate === label && candidate.querySelector("input").checked;
                    candidate.classList.toggle("ant-radio-wrapper-checked", checked);
                    candidate.querySelector(".ant-radio").classList.toggle("ant-radio-checked", checked);
                  });
                  document.querySelector("#" + question.dataset.question + "-table").style.display =
                    label.innerText.trim() === "Yes" && label.querySelector("input").checked ? "table" : "none";
                });
              });
            });

            document.querySelectorAll(".ant-select").forEach((select) => {
              const input = select.querySelector("input[role='combobox']");
              const display = select.querySelector(".ant-select-selection-item");
              const dropdown = document.getElementById(input.getAttribute("aria-controls")).closest(".ant-select-dropdown");
              const open = () => {
                dropdown.classList.remove("ant-select-dropdown-hidden");
                input.setAttribute("aria-expanded", "true");
              };
              const close = () => {
                dropdown.classList.add("ant-select-dropdown-hidden");
                input.setAttribute("aria-expanded", "false");
              };
              select.querySelector(".ant-select-selector").addEventListener("mousedown", open);
              select.querySelector(".ant-select-selector").addEventListener("click", open);
              input.addEventListener("focus", open);
              input.addEventListener("keydown", (event) => {
                if (event.key === "ArrowDown") open();
                if (event.key === "Enter") {
                  const firstVisible = Array.from(dropdown.querySelectorAll("[role='option']"))
                    .find((option) => option.style.display !== "none");
                  firstVisible?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                }
              });
              input.addEventListener("input", () => {
                const needle = input.value.trim().toLowerCase();
                dropdown.querySelectorAll("[role='option']").forEach((option) => {
                  const searchableValue = option.dataset.value || "";
                  option.style.display =
                    !needle || searchableValue.toLowerCase().includes(needle) ? "" : "none";
                });
              });
              dropdown.querySelectorAll("[role='option']").forEach((option) => {
                option.addEventListener("click", () => {
                  const value = option.textContent.trim();
                  display.textContent = value;
                  display.setAttribute("title", value);
                  input.value = "";
                  input.dispatchEvent(new Event("change", { bubbles: true }));
                  close();
                });
              });
            });
          </script>
        </body>
      </html>
    `);

    const answers = {
      has_other_passports_used_for_vietnam: "yes",
      other_vietnam_passport_number: "E1234567",
      other_vietnam_passport_full_name: "ZHANG SAN",
      other_vietnam_passport_date_of_birth: "1990-05-06",
      other_vietnam_passport_nationality: "HUN",
      has_relatives_in_vietnam: "yes",
      relative_full_name: "NGUYEN VAN A",
      relative_date_of_birth: "1988-02-03",
      relative_nationality: "PAN",
      relative_relationship: "Father",
      relative_residential_address: "Da Nang",
    };

    await pickRadio(page, "basic_ttcnDaDungHcKhacVaoVn", "Yes");
    await fillVietnamConditionalRepeatGroups(page, answers, "has_other_passports_used_for_vietnam");
    await pickRadio(page, "basic_ttcdCoThanNhan", "Yes");
    await fillVietnamConditionalRepeatGroups(page, answers, "has_relatives_in_vietnam");

    const otherPassportNationality = page
      .locator("#basic_hcKhac_0_quocTich")
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-select ')][1]");
    const relativeNationality = page
      .locator("#basic_thanNhanOVn_0_quocTich")
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-select ')][1]");
    assert.equal((await otherPassportNationality.innerText()).trim(), "Hungary");
    assert.equal((await relativeNationality.innerText()).trim(), "Panama");
  } finally {
    await browser.close();
  }
});

test("vn.conditional-fields browser: selects Panama from a virtualized official country dropdown", { timeout: 20_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html>
        <body>
          ${renderVirtualAntSelect("basic_thanNhanOVn_0_quocTich", VN_COUNTRY_OPTION_ORDER)}
        </body>
      </html>
    `);

    await pickSelect(page, "basic_thanNhanOVn_0_quocTich", "Panama");

    const display = page.locator(".ant-select-selection-item").first();
    assert.equal((await display.innerText()).trim(), "Panama");
    const searchedTerms = await page.evaluate(() => (window as unknown as { searchedTerms?: string[] }).searchedTerms ?? []);
    assert.equal(searchedTerms.includes("PAN"), false);
    assert.equal(searchedTerms.includes("Panama"), true);
  } finally {
    await browser.close();
  }
});

function renderIdlessQuestion(question: string, tableId: string): string {
  return `
    <div class="pt-5 border-b" data-question="${tableId}">
      <div class="ant-col ant-col-24 flex justify-between pb-5">
        <div>${question}</div>
        <div>
          <div class="ant-radio-group ant-radio-group-outline">
            <label class="ant-radio-wrapper ant-radio-wrapper-checked">
              <span class="ant-radio ant-radio-checked"><input type="radio" class="ant-radio-input" value="no" checked /></span>
              <span>No</span>
            </label>
            <label class="ant-radio-wrapper">
              <span class="ant-radio"><input type="radio" class="ant-radio-input" value="yes" /></span>
              <span>Yes</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTable(id: string, headers: string[]): string {
  return `
    <table id="${id}" style="display:none">
      <thead>
        <tr>
          <th>No</th>
          ${headers.map((header) => `<th>${header}</th>`).join("")}
          <th>Add/delete</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          ${headers.map((header) => `<td><input aria-label="${header}" /></td>`).join("")}
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderOfficialDynamicTable(
  id: string,
  columns: Array<{ header: string; inputId: string; selectOptions?: string[] }>,
): string {
  return `
    <table id="${id}" style="display:none">
      <thead>
        <tr>
          <th>No</th>
          ${columns.map((column) => `<th>${column.header}</th>`).join("")}
          <th>Add/delete</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          ${columns.map((column) => `<td>${column.selectOptions ? renderAntSelect(column.inputId, column.selectOptions) : `<input id="${column.inputId}" aria-label="${column.header}" />`}</td>`).join("")}
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderAntSelect(inputId: string, options: string[]): string {
  const listId = `${inputId}_list`;
  const officialValues: Record<string, string> = {
    China: "CHN",
    Hungary: "HUN",
    Panama: "PAN",
  };
  return `
    <div class="ant-select">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item" title=""></span>
        <span class="ant-select-selection-search">
          <input id="${inputId}" class="ant-select-selection-search-input" role="combobox" aria-controls="${listId}" aria-owns="${listId}" aria-expanded="false" />
        </span>
      </div>
    </div>
    <div class="ant-select-dropdown ant-select-dropdown-hidden">
      <div id="${listId}" role="listbox">
        ${options
          .map(
            (option) => `
              <div class="ant-select-item-option" role="option" title="${option}" data-value="${officialValues[option] ?? option}">
                <div class="ant-select-item-option-content">${option}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderVirtualAntSelect(inputId: string, options: string[]): string {
  const listId = `${inputId}_list`;
  return `
    <div class="ant-select">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item" title=""></span>
        <span class="ant-select-selection-search">
          <input id="${inputId}" class="ant-select-selection-search-input" role="combobox" aria-controls="${listId}" aria-owns="${listId}" aria-expanded="false" />
        </span>
      </div>
    </div>
    <div class="ant-select-dropdown ant-select-dropdown-hidden">
      <div class="rc-virtual-list-holder" style="height: 256px; overflow-y: auto;">
        <div id="${listId}" class="rc-virtual-list-holder-inner" role="listbox"></div>
      </div>
    </div>
    <script>
      (() => {
        const options = ${JSON.stringify(options)};
        const itemHeight = 40;
        const input = document.getElementById(${JSON.stringify(inputId)});
        const select = input.closest(".ant-select");
        const selector = select.querySelector(".ant-select-selector");
        const display = select.querySelector(".ant-select-selection-item");
        const dropdown = document.getElementById(input.getAttribute("aria-controls")).closest(".ant-select-dropdown");
        const holder = dropdown.querySelector(".rc-virtual-list-holder");
        const list = dropdown.querySelector(".rc-virtual-list-holder-inner");
        let open = false;
        let filteredOptions = options.slice();

        holder.style.height = "256px";
        list.style.position = "relative";
        list.style.height = (filteredOptions.length * itemHeight) + "px";

        const render = () => {
          const start = Math.max(0, Math.floor(holder.scrollTop / itemHeight) - 1);
          const end = Math.min(filteredOptions.length, start + 10);
          list.innerHTML = "";
          for (let index = start; index < end; index += 1) {
            const option = filteredOptions[index];
            const node = document.createElement("div");
            node.className = "ant-select-item-option";
            node.setAttribute("role", "option");
            node.setAttribute("title", option);
            node.style.position = "absolute";
            node.style.top = (index * itemHeight) + "px";
            node.style.height = itemHeight + "px";
            node.style.lineHeight = itemHeight + "px";
            const content = document.createElement("div");
            content.className = "ant-select-item-option-content";
            content.textContent = option;
            node.appendChild(content);
            node.addEventListener("click", () => {
              display.textContent = option;
              display.setAttribute("title", option);
              input.value = "";
              input.dispatchEvent(new Event("change", { bubbles: true }));
              close();
            });
            list.appendChild(node);
          }
        };

        const refreshSearch = () => {
          window.searchedTerms = [...(window.searchedTerms || []), input.value];
          filteredOptions = options.slice();
          list.style.height = (filteredOptions.length * itemHeight) + "px";
          render();
        };
        const show = () => {
          open = true;
          dropdown.classList.remove("ant-select-dropdown-hidden");
          input.setAttribute("aria-expanded", "true");
          render();
        };
        const close = () => {
          open = false;
          dropdown.classList.add("ant-select-dropdown-hidden");
          input.setAttribute("aria-expanded", "false");
        };

        holder.addEventListener("scroll", render);
        selector.addEventListener("mousedown", show);
        selector.addEventListener("click", show);
        input.addEventListener("focus", show);
        input.addEventListener("input", refreshSearch);
        input.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown") show();
          if (event.key === "Enter") {
            const first = list.querySelector("[role='option']");
            first?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          }
        });
        render();
      })();
    </script>
  `;
}
