import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, type Locator, type Page } from "@playwright/test";
import type { FormFieldMapping } from "../../form-mappings";
import {
  Ds160RepeatBrowserError,
  deriveDs160RepeatRowAnswers,
  fillDs160RepeatGroups,
} from "../repeat-browser-adapter";
import { fillPageFields } from "../orchestrator";

interface FixtureState {
  readonly phoneAddCount: number;
  readonly emailAddCount: number;
  readonly phoneRemoveIndices: readonly number[];
  readonly emailRemoveIndices: readonly number[];
}

const textMapping = (selector: string, label: string): FormFieldMapping => ({
  selector,
  type: "text",
  label,
});

const selectMapping = (selector: string, label: string): FormFieldMapping => ({
  selector,
  type: "select",
  label,
});

function phoneFixture(options: {
  readonly phoneRows: number;
  readonly emailRows?: number;
  readonly phoneAddButtons?: number;
  readonly includePhoneRemove?: boolean;
  readonly phoneIdPrefix?: string;
}): string {
  const emailRows = options.emailRows ?? 1;
  const phoneAddButtons = options.phoneAddButtons ?? 1;
  const includePhoneRemove = options.includePhoneRemove ?? true;
  const phoneIdPrefix = options.phoneIdPrefix ?? "phone";
  const phoneAdds = Array.from({ length: phoneAddButtons }, (_, index) =>
    `<button id="phone-add-${index + 1}" type="button">Add Another phone</button>`,
  ).join("");
  return `<!doctype html>
<html><body>
  <main>
    <section id="phone-group" data-repeat-group="additional_phones">
      <div id="phone-rows"></div>
      <div id="phone-controls">${phoneAdds}</div>
    </section>
    <section id="email-group" data-repeat-group="additional_emails">
      <div id="email-rows"></div>
      <button id="email-add" type="button">Add Another email</button>
    </section>
  </main>
  <script>
    (function () {
      var state = { phoneAddCount: 0, emailAddCount: 0, phoneRemoveIndices: [], emailRemoveIndices: [] };
      var phoneCount = ${options.phoneRows};
      var emailCount = ${emailRows};
      var phoneValues = {};
      var emailValues = {};
      var phoneRows = document.getElementById("phone-rows");
      var emailRows = document.getElementById("email-rows");
      var phoneControls = document.getElementById("phone-controls");
      function suffix(index) { return index === 0 ? "" : "__" + (index + 1); }
      function token(index) { return "ctl" + String(index).padStart(2, "0"); }
      function persist() { document.body.dataset.state = JSON.stringify(state); }
      function renderPhone() {
        phoneRows.innerHTML = "";
        for (var index = 0; index < phoneCount; index += 1) {
          var row = document.createElement("div");
          row.className = "repeat-row";
          row.setAttribute("data-row", String(index));
          var input = document.createElement("input");
          input.type = "text";
          input.id = "${phoneIdPrefix}_" + token(index) + "_additional_phone";
          input.name = input.id;
          input.setAttribute("data-field", "additional_phone");
          input.value = phoneValues[suffix(index)] || "";
          input.addEventListener("input", (function (key, control) {
            return function () { phoneValues[key] = control.value; persist(); };
          })(suffix(index), input));
          row.appendChild(input);
          if (${includePhoneRemove ? "true" : "false"} && phoneCount > 1) {
            var remove = document.createElement("button");
            remove.type = "button";
            remove.id = "phone_remove_" + token(index);
            remove.textContent = "Remove";
            remove.addEventListener("click", (function (removedIndex) {
              return function () {
                state.phoneRemoveIndices.push(removedIndex);
                for (var shift = removedIndex; shift < phoneCount - 1; shift += 1) {
                  phoneValues[suffix(shift)] = phoneValues[suffix(shift + 1)] || "";
                }
                delete phoneValues[suffix(phoneCount - 1)];
                phoneCount -= 1;
                renderPhone();
                persist();
              };
            })(index));
            row.appendChild(remove);
          }
          phoneRows.appendChild(row);
        }
        persist();
      }
      function renderEmail() {
        emailRows.innerHTML = "";
        for (var index = 0; index < emailCount; index += 1) {
          var row = document.createElement("div");
          row.className = "repeat-row";
          row.setAttribute("data-row", String(index));
          var input = document.createElement("input");
          input.type = "text";
          input.id = "email_" + token(index) + "_additional_email";
          input.name = input.id;
          input.setAttribute("data-field", "additional_email");
          input.value = emailValues[suffix(index)] || "";
          row.appendChild(input);
          emailRows.appendChild(row);
        }
        persist();
      }
      Array.prototype.forEach.call(phoneControls.querySelectorAll("button"), function (button) {
        button.addEventListener("click", function () {
          state.phoneAddCount += 1;
          phoneCount += 1;
          renderPhone();
        });
      });
      document.getElementById("email-add").addEventListener("click", function () {
        state.emailAddCount += 1;
        emailCount += 1;
        renderEmail();
      });
      renderPhone();
      renderEmail();
    }());
  </script>
</body></html>`;
}

function socialFixture(): string {
  return `<!doctype html>
<html><body>
  <section id="social-group" data-repeat-group="social_media">
    <div id="social-rows">
      <div class="repeat-row" data-row="0">
        <input id="social_ctl00_provider" name="social_ctl00_provider" data-field="social_media_provider">
        <input id="social_ctl00_identifier" name="social_ctl00_identifier" data-field="social_media_identifier">
      </div>
      <div class="repeat-row" data-row="1">
        <input id="social_ctl01_provider" name="social_ctl01_provider" data-field="social_media_provider">
        <input id="social_ctl01_identifier" name="social_ctl01_identifier" data-field="social_media_identifier">
      </div>
    </div>
  </section>
</body></html>`;
}

function formerSpouseDateFixture(): string {
  const rows = ["ctl00", "ctl01"].map((token, index) => `
    <div class="repeat-row" data-row="${index}">
      <select id="former_${token}_dob_day" data-field="former_spouse_date_of_birth_day">
        <option value="01">01</option><option value="02">02</option>
      </select>
      <select id="former_${token}_dob_month" data-field="former_spouse_date_of_birth_month">
        <option value="JAN">JAN</option><option value="FEB">FEB</option>
      </select>
      <select id="former_${token}_dob_year" data-field="former_spouse_date_of_birth_year">
        <option value="2000">2000</option><option value="2001">2001</option>
      </select>
    </div>`).join("");
  return `<!doctype html><html><body>
  <section id="former-group" data-repeat-group="former_spouses">
    <div id="former-rows">${rows}</div>
  </section>
</body></html>`;
}

function conditionalNationalityFixture(): string {
  return `<!doctype html><html><body>
  <section id="nationality-group" data-repeat-group="other_nationality">
    <div class="repeat-row" data-row="0">
      <input id="nationality_ctl00_country" data-field="other_nationality_country">
      <label><input id="nationality_ctl00_has_passport_yes" type="radio"
        name="nationality_ctl00_has_passport" value="Y"
        data-field="other_nationality_has_passport"
        onclick="document.getElementById('nationality_ctl00_passport_child').style.display = this.checked ? 'block' : 'none'"> Yes</label>
      <label><input id="nationality_ctl00_has_passport_no" type="radio"
        name="nationality_ctl00_has_passport" value="N"
        data-field="other_nationality_has_passport"> No</label>
      <div id="nationality_ctl00_passport_child" style="display:none">
        <input id="nationality_ctl00_passport_number" data-field="other_nationality_passport_number">
      </div>
    </div>
  </section>
</body></html>`;
}

function travelPurposePostbackFixture(wrapperIds = true): string {
  return `<!doctype html><html><body>
    <section id="travel-purpose-group">
      <div ${wrapperIds ? 'id="travel_ctl00_row"' : ''} data-fixture-row>
        <div ${wrapperIds ? 'id="travel_ctl00_main-cell"' : ''}>
          <select id="travel_ctl00_ddlPurposeOfTrip">
            <option value="">PLEASE SELECT A VISA CLASS</option>
            <option value="B">TEMP. BUSINESS OR PLEASURE VISITOR (B)</option>
          </select>
        </div>
      </div>
    </section>
    <script>
      (function () {
        var row = document.querySelector("[data-fixture-row]");
        var purpose = document.getElementById("travel_ctl00_ddlPurposeOfTrip");
        purpose.addEventListener("change", function () {
          // Simulate the CEAC UpdatePanel replacing the whole item after the
          // parent purpose is selected. The dependent select is a sibling of
          // the original control's cell, not its direct child.
          var replacement = document.createElement("div");
          ${wrapperIds ? 'replacement.id = "travel_ctl00_row";' : ''}
          replacement.innerHTML =
            '<div ${wrapperIds ? 'id="travel_ctl00_main-cell"' : ''}>' +
              '<select id="travel_ctl00_ddlPurposeOfTrip">' +
                '<option value="">PLEASE SELECT A VISA CLASS</option>' +
                '<option value="B" selected>TEMP. BUSINESS OR PLEASURE VISITOR (B)</option>' +
              '</select>' +
            '</div>' +
            '<div ${wrapperIds ? 'id="travel_ctl00_specify-cell"' : ''}>' +
              '<select id="travel_ctl00_ddlOtherPurpose">' +
                '<option value="">PLEASE SELECT</option>' +
                '<option value="B1-B2">BUSINESS &amp; TOURISM (TEMPORARY VISITOR) (B1/B2)</option>' +
              '</select>' +
            '</div>';
          row.replaceWith(replacement);
          row = replacement;
        });
      }());
    </script>
  </body></html>`;
}

async function withPage<T>(html: string, run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    return await run(page);
  } finally {
    await browser.close();
  }
}

async function readFixtureState(page: Page): Promise<FixtureState> {
  return page.evaluate(() => {
    const raw = document.body.dataset.state;
    if (!raw) throw new Error("Fixture state was not persisted.");
    return JSON.parse(raw) as FixtureState;
  });
}

test("browser adapter isolates same-page groups and re-resolves every row for final read-back", async () => {
  await withPage(phoneFixture({ phoneRows: 1, emailRows: 1 }), async (page) => {
    const filled: number[] = [];
    const verified: number[] = [];
    const result = await fillDs160RepeatGroups({
      page,
      pageId: "address_and_phone",
      answers: {
        has_other_phones: "yes",
        additional_phone: "FIRST PHONE",
        additional_phone__2: "SECOND PHONE",
      },
      mappings: {
        additional_phone: textMapping(
          'input[data-field="additional_phone"]',
          "Additional Phone Number",
        ),
      },
      groups: ["additional_phones"],
      fillRow: async ({ answers, scope, row }) => {
        assert.ok(scope);
        const key = row.index === 0 ? "additional_phone" : "additional_phone__2";
        await scope.locator('input[data-field="additional_phone"]').fill(answers[key]);
        filled.push(row.index);
      },
      verifyRow: async ({ answers, scope, row }) => {
        assert.ok(scope);
        const key = row.index === 0 ? "additional_phone" : "additional_phone__2";
        assert.equal(
          await scope.locator('input[data-field="additional_phone"]').inputValue(),
          answers[key],
        );
        verified.push(row.index);
      },
    });

    assert.equal(result.groups[0].status, "filled");
    assert.deepEqual(filled, [0, 1]);
    assert.deepEqual(verified, [0, 1]);
    assert.deepEqual(
      await page.locator('input[data-field="additional_phone"]').evaluateAll(
        (controls) => controls.map((control) => (control as HTMLInputElement).value),
      ),
      ["FIRST PHONE", "SECOND PHONE"],
    );
    const state = await readFixtureState(page);
    assert.equal(state.phoneAddCount, 1);
    assert.equal(state.emailAddCount, 0);
  });
});

test("browser adapter falls back to the existing extended mapping for a visible repeat field", async () => {
  await withPage(
    phoneFixture({
      phoneRows: 1,
      phoneAddButtons: 0,
      includePhoneRemove: false,
      phoneIdPrefix: "APP_ADD_TEL",
    }),
    async (page) => {
      let receivedMapping: FormFieldMapping | undefined;
      await fillDs160RepeatGroups({
        page,
        pageId: "address_and_phone",
        answers: {
          has_other_phones: "yes",
          additional_phone: "EXTENDED MAPPING PHONE",
        },
        mappings: {},
        groups: ["additional_phones"],
        fillRow: async ({ answers, mappings, scope }) => {
          assert.ok(scope);
          receivedMapping = mappings.additional_phone;
          await scope
            .locator('input[data-field="additional_phone"]')
            .fill(answers.additional_phone);
        },
      });
      assert.equal(receivedMapping?.type, "text");
      assert.match(receivedMapping?.selector ?? "", /APP_ADD_TEL/);
      assert.equal(
        await page.locator('input[data-field="additional_phone"]').inputValue(),
        "EXTENDED MAPPING PHONE",
      );
    },
  );
});

test("final read-back rejects a row identity changed by a later group's postback", async () => {
  await withPage(phoneFixture({ phoneRows: 1, emailRows: 1 }), async (page) => {
    let verified = 0;
    await assert.rejects(fillDs160RepeatGroups({
      page, pageId: "address_and_phone",
      answers: {
        has_other_phones: "yes", additional_phone: "FIRST PHONE",
        has_other_emails: "yes", additional_email: "first@example.invalid",
      },
      mappings: {
        additional_phone: textMapping('input[data-field="additional_phone"]', "Phone"),
        additional_email: textMapping('input[data-field="additional_email"]', "Email"),
      },
      groups: ["additional_phones", "additional_emails"],
      fillRow: async ({ group, scope, answers, mappings }) => {
        assert.ok(scope);
        for (const [key, mapping] of Object.entries(mappings)) {
          await scope.locator(mapping.selector).fill(answers[key]);
        }
        if (group === "additional_emails") {
          await page.locator('input[data-field="additional_phone"]').evaluate((input) => {
            input.id = input.id.replace("ctl00", "ctl04");
            const name = input.getAttribute("name");
            if (name) input.setAttribute("name", name.replace("ctl00", "ctl04"));
          });
        }
      },
      verifyRow: async () => { verified += 1; },
    }), /Repeat row identity changed/);
    assert.equal(verified, 0);
  });
});

test("browser adapter preserves aliases for two social rows", async () => {
  await withPage(socialFixture(), async (page) => {
    const received: Array<Record<string, string>> = [];
    await fillDs160RepeatGroups({
      page,
      pageId: "address_and_phone",
      answers: {
        social_media_platform: "FACEBOOK",
        social_media_handle: "first-handle",
        social_media_platform__2: "INSTAGRAM",
        social_media_handle__2: "second-handle",
      },
      mappings: {
        social_media_provider: textMapping(
          'input[data-field="social_media_provider"]',
          "Social Media Provider",
        ),
        social_media_identifier: textMapping(
          'input[data-field="social_media_identifier"]',
          "Social Media Identifier",
        ),
      },
      groups: ["social_media"],
      fillRow: async ({ answers, mappings, scope, resolveScope }) => {
        received.push({ ...answers });
        await fillPageFields(page, mappings, answers, {}, { scope, resolveScope, requireMappedAnswers: true });
      },
    });

    assert.deepEqual(received, [
      {
        social_media_provider: "FACEBOOK",
        social_media_identifier: "first-handle",
      },
      {
        social_media_provider__2: "INSTAGRAM",
        social_media_identifier__2: "second-handle",
      },
    ]);
    assert.deepEqual(
      await page.locator('input[data-field="social_media_provider"]').evaluateAll(
        (controls) => controls.map((control) => (control as HTMLInputElement).value),
      ),
      ["FACEBOOK", "INSTAGRAM"],
    );
    assert.deepEqual(
      await page.locator('input[data-field="social_media_identifier"]').evaluateAll(
        (controls) => controls.map((control) => (control as HTMLInputElement).value),
      ),
      ["first-handle", "second-handle"],
    );
  });
});

test("browser adapter derives and retains date parts for the second former-spouse row", async () => {
  await withPage(formerSpouseDateFixture(), async (page) => {
    const received: Array<Record<string, string>> = [];
    await fillDs160RepeatGroups({
      page,
      pageId: "family_spouse",
      answers: {
        marital_status: "divorced",
        former_spouse_date_of_birth: "2000-01-02",
        former_spouse_date_of_birth__2: "2001-02-01",
      },
      mappings: {
        former_spouse_date_of_birth_day: selectMapping(
          'select[data-field="former_spouse_date_of_birth_day"]',
          "Former Spouse Date of Birth Day",
        ),
        former_spouse_date_of_birth_month: selectMapping(
          'select[data-field="former_spouse_date_of_birth_month"]',
          "Former Spouse Date of Birth Month",
        ),
        former_spouse_date_of_birth_year: selectMapping(
          'select[data-field="former_spouse_date_of_birth_year"]',
          "Former Spouse Date of Birth Year",
        ),
      },
      groups: ["former_spouses"],
      fillRow: async ({ answers, scope, row }) => {
        assert.ok(scope);
        received.push({ ...answers });
        const suffix = row.index === 0 ? "" : "__2";
        await scope
          .locator('select[data-field="former_spouse_date_of_birth_day"]')
          .selectOption(answers[`former_spouse_date_of_birth_day${suffix}`]);
        await scope
          .locator('select[data-field="former_spouse_date_of_birth_month"]')
          .selectOption(answers[`former_spouse_date_of_birth_month${suffix}`]);
        await scope
          .locator('select[data-field="former_spouse_date_of_birth_year"]')
          .selectOption(answers[`former_spouse_date_of_birth_year${suffix}`]);
      },
    });

    assert.deepEqual(received, [
      {
        former_spouse_date_of_birth_day: "02",
        former_spouse_date_of_birth_month: "JAN",
        former_spouse_date_of_birth_year: "2000",
      },
      {
        former_spouse_date_of_birth_day__2: "01",
        former_spouse_date_of_birth_month__2: "FEB",
        former_spouse_date_of_birth_year__2: "2001",
      },
    ]);
    assert.deepEqual(
      await page.locator('select[data-field="former_spouse_date_of_birth_day"]').evaluateAll(
        (controls) => controls.map((control) => (control as HTMLSelectElement).value),
      ),
      ["02", "01"],
    );
    assert.deepEqual(
      deriveDs160RepeatRowAnswers({
        group: "former_spouses",
        index: 1,
        storageSuffix: "__2",
        values: { former_spouse_date_of_birth: "2001-02-01" },
        sourceKeys: { former_spouse_date_of_birth: "former_spouse_date_of_birth__2" },
      }),
      {
        former_spouse_date_of_birth__2: "2001-02-01",
        former_spouse_date_of_birth_day__2: "01",
        former_spouse_date_of_birth_month__2: "FEB",
        former_spouse_date_of_birth_year__2: "2001",
      },
    );
  });
});

test("browser adapter fills a child that appears from an inline conditional row controller", async () => {
  await withPage(conditionalNationalityFixture(), async (page) => {
    await fillDs160RepeatGroups({
      page,
      pageId: "personal_information_2",
      answers: {
        other_nationality: "yes",
        other_nationality_country: "CAN",
        other_nationality_has_passport: "yes",
        other_nationality_passport_number: "ROW-PASSPORT",
      },
      mappings: {
        other_nationality_country: textMapping(
          'input[data-field="other_nationality_country"]',
          "Other Nationality Country",
        ),
        other_nationality_has_passport: {
          selector: 'input[data-field="other_nationality_has_passport"]',
          type: "radio",
          label: "Does this nationality have a passport?",
        },
        other_nationality_passport_number: textMapping(
          'input[data-field="other_nationality_passport_number"]',
          "Other Nationality Passport Number",
        ),
      },
      groups: ["other_nationality"],
      fillRow: async ({ answers, scope }) => {
        assert.ok(scope);
        await scope
          .locator('input[data-field="other_nationality_country"]')
          .fill(answers.other_nationality_country);
        await scope
          .locator('input[data-field="other_nationality_has_passport"][value="Y"]')
          .check();
        await scope
          .locator('input[data-field="other_nationality_passport_number"]')
          .fill(answers.other_nationality_passport_number);
      },
    });

    assert.equal(
      await page.locator('input[data-field="other_nationality_passport_number"]').inputValue(),
      "ROW-PASSPORT",
    );
    assert.equal(
      await page.locator('input[data-field="other_nationality_passport_number"]').isVisible(),
      true,
    );
  });
});

for (const wrapperIds of [true, false]) {
test(`browser adapter rediscovers conditional siblings after postback (wrapper ids: ${wrapperIds})`, async () => {
  await withPage(travelPurposePostbackFixture(wrapperIds), async (page) => {
    await fillDs160RepeatGroups({
      page,
      pageId: "travel_information",
      answers: {
        purpose_of_trip: "B",
        purpose_of_trip_specify: "B1/B2",
      },
      mappings: {
        purpose_of_trip: selectMapping(
          'select[id*="ddlPurposeOfTrip"]',
          "Purpose of Trip",
        ),
        purpose_of_trip_specify: selectMapping(
          'select[id*="ddlOtherPurpose"]',
          "Specify Purpose",
        ),
      },
      groups: ["trip_purpose"],
      fillRow: async ({ answers, mappings, scope, resolveScope }) => {
        await fillPageFields(page, mappings, answers, {}, { scope, resolveScope, requireMappedAnswers: true });
      },
    });

    assert.equal(
      await page.locator('select[id*="ddlPurposeOfTrip"]').inputValue(),
      "B",
    );
    assert.equal(
      await page.locator('select[id*="ddlOtherPurpose"]').inputValue(),
      "B1-B2",
    );
  });
});
}

test("condition-off repeat branch skips DOM discovery, while a count-one row needs no controls", async () => {
  await withPage(phoneFixture({ phoneRows: 1, phoneAddButtons: 0, includePhoneRemove: false }), async (page) => {
    let fillCount = 0;
    const skipped = await fillDs160RepeatGroups({
      page,
      pageId: "address_and_phone",
      answers: {
        has_other_phones: "no",
        additional_phone: "MUST NOT FILL",
      },
      mappings: {
        additional_phone: textMapping(
          'input[data-field="additional_phone"]',
          "Additional Phone Number",
        ),
      },
      groups: ["additional_phones"],
      fillRow: () => { fillCount += 1; },
    });
    assert.equal(skipped.groups[0].status, "skipped");
    assert.equal(fillCount, 0);
    assert.equal(await page.locator('input[data-field="additional_phone"]').inputValue(), "");

    const active = await fillDs160RepeatGroups({
      page,
      pageId: "address_and_phone",
      answers: {
        has_other_phones: "yes",
        additional_phone: "ONE PHONE",
      },
      mappings: {
        additional_phone: textMapping(
          'input[data-field="additional_phone"]',
          "Additional Phone Number",
        ),
      },
      groups: ["additional_phones"],
      fillRow: async ({ answers, scope }) => {
        assert.ok(scope);
        await scope.locator('input[data-field="additional_phone"]').fill(answers.additional_phone);
        fillCount += 1;
      },
    });
    assert.equal(active.groups[0].status, "filled");
    assert.equal(fillCount, 1);
    assert.equal(await page.locator('input[data-field="additional_phone"]').inputValue(), "ONE PHONE");
  });
});

test("browser adapter fails closed on missing or ambiguous row controls", async () => {
  const mapping = {
    additional_phone: textMapping(
      'input[data-field="additional_phone"]',
      "Additional Phone Number",
    ),
  };

  await withPage(phoneFixture({ phoneRows: 1, phoneAddButtons: 0 }), async (page) => {
    await assert.rejects(
      () => fillDs160RepeatGroups({
        page,
        pageId: "address_and_phone",
        answers: {
          has_other_phones: "yes",
          additional_phone: "FIRST",
          additional_phone__2: "SECOND",
        },
        mappings: mapping,
        groups: ["additional_phones"],
        fillRow: () => undefined,
      }),
      (error: unknown) =>
        error instanceof Ds160RepeatBrowserError && error.code === "missing_add_control",
    );
  });

  await withPage(phoneFixture({ phoneRows: 1, phoneAddButtons: 2 }), async (page) => {
    await assert.rejects(
      () => fillDs160RepeatGroups({
        page,
        pageId: "address_and_phone",
        answers: {
          has_other_phones: "yes",
          additional_phone: "FIRST",
          additional_phone__2: "SECOND",
        },
        mappings: mapping,
        groups: ["additional_phones"],
        fillRow: () => undefined,
      }),
      (error: unknown) =>
        error instanceof Ds160RepeatBrowserError && error.code === "ambiguous_add_control",
    );
  });

  await withPage(phoneFixture({ phoneRows: 2, includePhoneRemove: false }), async (page) => {
    await assert.rejects(
      () => fillDs160RepeatGroups({
        page,
        pageId: "address_and_phone",
        answers: {
          has_other_phones: "yes",
          additional_phone: "ONLY FIRST",
        },
        mappings: mapping,
        groups: ["additional_phones"],
        fillRow: () => undefined,
      }),
      (error: unknown) =>
        error instanceof Ds160RepeatBrowserError && error.code === "missing_remove_control",
    );
  });
});

test("browser adapter removes only the last excess row and keeps row indexes stable", async () => {
  await withPage(phoneFixture({ phoneRows: 3 }), async (page) => {
    const filledRows: number[] = [];
    await fillDs160RepeatGroups({
      page,
      pageId: "address_and_phone",
      answers: {
        has_other_phones: "yes",
        additional_phone: "ROW ZERO",
        additional_phone__2: "ROW ONE",
      },
      mappings: {
        additional_phone: textMapping(
          'input[data-field="additional_phone"]',
          "Additional Phone Number",
        ),
      },
      groups: ["additional_phones"],
      fillRow: async ({ answers, scope, row }) => {
        assert.ok(scope);
        const key = row.index === 0 ? "additional_phone" : "additional_phone__2";
        await scope.locator('input[data-field="additional_phone"]').fill(answers[key]);
        filledRows.push(row.index);
      },
    });
    assert.deepEqual(filledRows, [0, 1]);
    assert.deepEqual((await readFixtureState(page)).phoneRemoveIndices, [2]);
    assert.equal(await page.locator('input[data-field="additional_phone"]').count(), 2);
    assert.deepEqual(
      await page.locator('input[data-field="additional_phone"]').evaluateAll(
        (controls) => controls.map((control) => (control as HTMLInputElement).value),
      ),
      ["ROW ZERO", "ROW ONE"],
    );
  });
});
