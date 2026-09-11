import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import {
  buildTravelCompanionsPlan,
  fillTravelCompanionsPage,
} from "../orchestrator";

describe("DS-160 travel companion planning", () => {
  it("supports zero companions without inventing dependent answers", () => {
    assert.deepEqual(buildTravelCompanionsPlan({ "travel.hasCompanions": "no" }), {
      hasCompanions: false,
      groupTravel: null,
      groupName: null,
      companions: [],
    });
  });

  it("consumes nested travel and companions[] for multiple people", () => {
    const plan = buildTravelCompanionsPlan({
      travel: { hasCompanions: "yes", companionGroupTravel: "no" },
      "companions[]": [
        { firstName: "JANE", lastName: "DOE", relationship: "friend" },
        { givenNames: "JOHN", surname: "SMITH", relationship: "business_partner" },
      ],
    });
    assert.deepEqual(plan.companions, [
      { givenNames: "JANE", surname: "DOE", relationship: "FRIEND" },
      { givenNames: "JOHN", surname: "SMITH", relationship: "BUSINESS ASSOCIATE" },
    ]);
  });

  it("supports exactly one individual companion", () => {
    const plan = buildTravelCompanionsPlan({
      "travel.hasCompanions": "yes",
      "travel.companionGroupTravel": "no",
      "companions[]": [{ firstName: "JANE", lastName: "DOE", relationship: "friend" }],
    });
    assert.deepEqual(plan.companions, [
      { givenNames: "JANE", surname: "DOE", relationship: "FRIEND" },
    ]);
  });

  it("accepts legacy flat and numbered companion fields", () => {
    const plan = buildTravelCompanionsPlan({
      has_companions: "Y",
      companion_group_travel: "N",
      companion_surname: "DOE",
      companion_given_names: "JANE",
      companion_relationship: "FRIEND",
      companion_surname__2: "SMITH",
      companion_given_names__2: "JOHN",
      companion_relationship__2: "OTHER RELATIVE",
    });
    assert.equal(plan.companions.length, 2);
    assert.equal(plan.companions[1].surname, "SMITH");
  });

  it("supports named group travel without requiring individual people", () => {
    const plan = buildTravelCompanionsPlan({
      "travel.hasCompanions": "yes",
      "travel.companionGroupTravel": "yes",
      "travel.companionGroupName": "SCHOOL TOUR",
    });
    assert.equal(plan.groupName, "SCHOOL TOUR");
    assert.deepEqual(plan.companions, []);
  });

  it("fails closed when the branch is contradictory or incomplete", () => {
    assert.throws(
      () => buildTravelCompanionsPlan({
        "travel.hasCompanions": "no",
        "companions[]": [{ firstName: "JANE", lastName: "DOE", relationship: "friend" }],
      }),
      /is no but companions\[\] is not empty/i,
    );
    assert.throws(
      () => buildTravelCompanionsPlan({
        "travel.hasCompanions": "yes",
        "travel.companionGroupTravel": "no",
        "companions[]": [{ firstName: "JANE", lastName: "DOE" }],
      }),
      /relationship is required/i,
    );
  });
});

describe("DS-160 travel companion CEAC repeater fill", () => {
  let browser: Browser;

  before(async () => {
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    await browser.close();
  });

  it("adds and fills each companion without overwriting the previous row", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="Y">Yes</label>
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="N">No</label>
      <section id="dependent" hidden>
        <label><input type="radio" name="rblGroupTravel" value="Y">Yes</label>
        <label><input type="radio" name="rblGroupTravel" value="N">No</label>
        <input id="tbxGroupName" hidden>
        <div id="people" hidden>
          <div id="rows"></div>
          <button id="InsertButtonPrincipalPOT" type="button">Add Another</button>
        </div>
      </section>
      <script>
        const rows = document.querySelector('#rows');
        function addRow() {
          const index = rows.children.length;
          rows.insertAdjacentHTML('beforeend', '<div>' +
            '<input id="dlPrincipalPOT_ctl0' + index + '_tbxSurname">' +
            '<input id="dlPrincipalPOT_ctl0' + index + '_tbxGivenName">' +
            '<select id="dlPrincipalPOT_ctl0' + index + '_ddlTCRelationship">' +
              '<option value="">Select</option><option value="FRIEND">Friend</option>' +
              '<option value="BUSINESS ASSOCIATE">Business Associate</option>' +
            '</select></div>');
        }
        document.querySelectorAll('[name="rblOtherPersonsTravelingWithYou"]').forEach((radio) => {
          radio.addEventListener('click', () => {
            document.querySelector('#dependent').hidden = radio.value !== 'Y';
            const replacement = radio.cloneNode(true);
            replacement.checked = true;
            radio.replaceWith(replacement);
          });
        });
        document.querySelectorAll('[name="rblGroupTravel"]').forEach((radio) => {
          radio.addEventListener('click', () => {
            document.querySelector('#tbxGroupName').hidden = radio.value !== 'Y';
            document.querySelector('#people').hidden = radio.value !== 'N';
            if (radio.value === 'N' && rows.children.length === 0) addRow();
            const replacement = radio.cloneNode(true);
            replacement.checked = true;
            radio.replaceWith(replacement);
          });
        });
        document.querySelector('#InsertButtonPrincipalPOT').addEventListener('click', addRow);
      </script>
    `);

    await fillTravelCompanionsPage(page, {
      "travel.hasCompanions": "yes",
      "travel.companionGroupTravel": "no",
      "companions[]": JSON.stringify([
        { firstName: "JANE", lastName: "DOE", relationship: "friend" },
        { firstName: "JOHN", lastName: "SMITH", relationship: "business_partner" },
      ]),
    });

    const values = (selector: string) => page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement | HTMLSelectElement).value));
    assert.deepEqual(await values('input[id*="tbxSurname"]'), ["DOE", "SMITH"]);
    assert.deepEqual(await values('input[id*="tbxGivenName"]'), ["JANE", "JOHN"]);
    assert.deepEqual(await values('select[id*="ddlTCRelationship"]'), [
      "FRIEND",
      "BUSINESS ASSOCIATE",
    ]);
    await page.close();
  });

  it("selects no companions without touching dependent controls", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="Y">Yes</label>
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="N">No</label>
    `);

    await fillTravelCompanionsPage(page, { "travel.hasCompanions": "no" });

    assert.equal(await page.locator('[name="rblOtherPersonsTravelingWithYou"][value="N"]').isChecked(), true);
    await page.close();
  });

  it("fills a named group without inventing individual companions", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="Y">Yes</label>
      <label><input type="radio" name="rblOtherPersonsTravelingWithYou" value="N">No</label>
      <section id="dependent" hidden>
        <label><input type="radio" name="rblGroupTravel" value="Y">Yes</label>
        <label><input type="radio" name="rblGroupTravel" value="N">No</label>
        <input id="tbxGroupName" hidden>
      </section>
      <script>
        document.querySelectorAll('[name="rblOtherPersonsTravelingWithYou"]').forEach((radio) => {
          radio.addEventListener('click', () => {
            document.querySelector('#dependent').hidden = radio.value !== 'Y';
          });
        });
        document.querySelectorAll('[name="rblGroupTravel"]').forEach((radio) => {
          radio.addEventListener('click', () => {
            document.querySelector('#tbxGroupName').hidden = radio.value !== 'Y';
          });
        });
      </script>
    `);

    await fillTravelCompanionsPage(page, {
      "travel.hasCompanions": "yes",
      "travel.companionGroupTravel": "yes",
      "travel.companionGroupName": "SCHOOL TOUR",
    });

    assert.equal(await page.locator('#tbxGroupName').inputValue(), "SCHOOL TOUR");
    await page.close();
  });
});
