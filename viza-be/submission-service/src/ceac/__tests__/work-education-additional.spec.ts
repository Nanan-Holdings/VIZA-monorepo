import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  buildDs160WorkAdditionalPlan,
  fillWorkEducationAdditionalPage,
  findMissingDs160WorkAdditionalAnswers,
} from "../work-education-additional";

const NO_BRANCHES: Record<string, string> = {
  has_clan_tribe: "no",
  language_name: "ENGLISH",
  has_countries_visited: "no",
  has_organization: "no",
  has_specialized_skills: "no",
  has_served_military: "no",
  has_served_paramilitary: "no",
};

const YES_BRANCHES: Record<string, string> = {
  has_clan_tribe: "yes",
  clan_tribe_name: "EXAMPLE CLAN",
  language_name: "ENGLISH",
  language_name__2: "MANDARIN",
  has_countries_visited: "yes",
  traveled_country: "JPN",
  traveled_country__2: "SING",
  has_organization: "yes",
  organization_name: "EXAMPLE ORGANIZATION",
  organization_name__2: "EXAMPLE ASSOCIATION",
  has_specialized_skills: "yes",
  specialized_skills_explain: "EXAMPLE TRAINING",
  has_served_military: "yes",
  military_country: "CHIN",
  military_branch: "EXAMPLE BRANCH",
  military_rank: "EXAMPLE RANK",
  military_specialty: "EXAMPLE SPECIALTY",
  military_date_from: "2010-01-02",
  military_date_to: "2011-03-04",
  military_country__2: "CHIN",
  military_branch__2: "EXAMPLE BRANCH 2",
  military_rank__2: "EXAMPLE RANK 2",
  military_specialty__2: "EXAMPLE SPECIALTY 2",
  military_date_from__2: "2012-05-06",
  military_date_to__2: "2013-07-08",
  has_served_paramilitary: "yes",
  paramilitary_explain: "EXAMPLE EXPLANATION",
};

async function mountFixture(page: Page): Promise<void> {
  await page.setContent(`
    <label><input type="radio" name="rblCLAN_TRIBE_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblCLAN_TRIBE_IND" value="N">No</label>
    <input id="tbxCLAN_TRIBE_NAME" hidden>

    <div id="languages"></div>
    <button id="dtlLANGUAGES_ctl00_InsertButtonLANGUAGE" type="button">Add Language</button>

    <label><input type="radio" name="rblCOUNTRIES_VISITED_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblCOUNTRIES_VISITED_IND" value="N">No</label>
    <section id="countriesSection" hidden>
      <div id="countries"></div>
      <button id="dtlCountriesVisited_ctl00_InsertButtonCOUNTRY" type="button">Add Country</button>
    </section>

    <label><input type="radio" name="rblORGANIZATION_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblORGANIZATION_IND" value="N">No</label>
    <section id="organizationsSection" hidden>
      <div id="organizations"></div>
      <button id="dtlORGANIZATIONS_ctl00_InsertButtonORGANIZATION" type="button">Add Organization</button>
    </section>

    <label><input type="radio" name="rblSPECIALIZED_SKILLS_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblSPECIALIZED_SKILLS_IND" value="N">No</label>
    <textarea id="tbxSPECIALIZED_SKILLS_EXPL" hidden></textarea>

    <label><input type="radio" name="rblMILITARY_SERVICE_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblMILITARY_SERVICE_IND" value="N">No</label>
    <section id="militarySection" hidden>
      <div id="military"></div>
      <button id="dtlMILITARY_ctl00_InsertButtonMILITARY" type="button">Add Military Service</button>
    </section>

    <label><input type="radio" name="rblINSURGENT_ORG_IND" value="Y">Yes</label>
    <label><input type="radio" name="rblINSURGENT_ORG_IND" value="N">No</label>
    <textarea id="tbxINSURGENT_ORG_EXPL" hidden></textarea>

    <script>
      const byId = (id) => document.getElementById(id);
      function bindGate(name, dependent) {
        document.querySelectorAll('[name="' + name + '"]').forEach((radio) => {
          radio.addEventListener('click', () => { byId(dependent).hidden = radio.value !== 'Y'; });
        });
      }
      function options(values) {
        return '<option value="">Select</option>' + values.map((value) => '<option value="' + value + '">' + value + '</option>').join('');
      }
      function addLanguage() {
        const index = byId('languages').children.length;
        byId('languages').insertAdjacentHTML('beforeend', '<input id="dtlLANGUAGES_ctl0' + index + '_tbxLANGUAGE_NAME">');
      }
      function addCountry() {
        const index = byId('countries').children.length;
        byId('countries').insertAdjacentHTML('beforeend', '<select id="dtlCountriesVisited_ctl0' + index + '_ddlCOUNTRIES_VISITED">' + options(['JPN', 'SING']) + '</select>');
      }
      function addOrganization() {
        const index = byId('organizations').children.length;
        byId('organizations').insertAdjacentHTML('beforeend', '<input id="dtlORGANIZATIONS_ctl0' + index + '_tbxORGANIZATION_NAME">');
      }
      function dateSelect(id, values) { return '<select id="' + id + '">' + options(values) + '</select>'; }
      function addMilitary() {
        const index = byId('military').children.length;
        const prefix = 'dtlMILITARY_ctl0' + index + '_';
        byId('military').insertAdjacentHTML('beforeend', '<div>' +
          '<select id="' + prefix + 'ddlMILITARY_SVC_CNTRY">' + options(['CHIN']) + '</select>' +
          '<input id="' + prefix + 'tbxMILITARY_SVC_BRANCH">' +
          '<input id="' + prefix + 'tbxMILITARY_SVC_RANK">' +
          '<input id="' + prefix + 'tbxMILITARY_SVC_SPECIALTY">' +
          dateSelect(prefix + 'ddlMILITARY_SVC_FROMDay', ['02', '06']) +
          dateSelect(prefix + 'ddlMILITARY_SVC_FROMMonth', ['JAN', 'MAY']) +
          '<input id="' + prefix + 'tbxMILITARY_SVC_FROMYear">' +
          dateSelect(prefix + 'ddlMILITARY_SVC_TODay', ['04', '08']) +
          dateSelect(prefix + 'ddlMILITARY_SVC_TOMonth', ['MAR', 'JUL']) +
          '<input id="' + prefix + 'tbxMILITARY_SVC_TOYear">' +
          '</div>');
      }

      addLanguage();
      addCountry();
      addOrganization();
      addMilitary();
      byId('dtlLANGUAGES_ctl00_InsertButtonLANGUAGE').addEventListener('click', addLanguage);
      byId('dtlCountriesVisited_ctl00_InsertButtonCOUNTRY').addEventListener('click', addCountry);
      byId('dtlORGANIZATIONS_ctl00_InsertButtonORGANIZATION').addEventListener('click', addOrganization);
      byId('dtlMILITARY_ctl00_InsertButtonMILITARY').addEventListener('click', addMilitary);
      bindGate('rblCLAN_TRIBE_IND', 'tbxCLAN_TRIBE_NAME');
      bindGate('rblCOUNTRIES_VISITED_IND', 'countriesSection');
      bindGate('rblORGANIZATION_IND', 'organizationsSection');
      bindGate('rblSPECIALIZED_SKILLS_IND', 'tbxSPECIALIZED_SKILLS_EXPL');
      bindGate('rblMILITARY_SERVICE_IND', 'militarySection');
      bindGate('rblINSURGENT_ORG_IND', 'tbxINSURGENT_ORG_EXPL');
    </script>
  `);
}

describe("DS-160 Work/Education Additional planning", () => {
  it("accepts complete No branches without inventing hidden details", () => {
    assert.deepEqual(findMissingDs160WorkAdditionalAnswers(NO_BRANCHES), []);
    const plan = buildDs160WorkAdditionalPlan(NO_BRANCHES);
    assert.equal(plan.hasServedMilitary, false);
    assert.deepEqual(plan.militaryServices, []);
    assert.equal(plan.paramilitaryExplain, null);
  });

  it("fails closed for missing gates, partial repeaters, and incomplete military rows", () => {
    const partial: Record<string, string> = { ...YES_BRANCHES };
    delete partial.has_clan_tribe;
    partial.language_name__2 = "";
    delete partial.traveled_country;
    partial["organizations[]"] = JSON.stringify(["EXAMPLE ORGANIZATION", ""]);
    delete partial.military_rank__2;
    partial.military_date_to = "invalid";
    delete partial.paramilitary_explain;

    const missing = findMissingDs160WorkAdditionalAnswers(partial);
    assert.ok(missing.includes("has_clan_tribe"));
    assert.ok(missing.includes("language_name__2"));
    assert.ok(missing.includes("traveled_country"));
    assert.ok(missing.includes("organization_name__2"));
    assert.ok(missing.includes("military_rank__2"));
    assert.ok(missing.includes("military_date_to"));
    assert.ok(missing.includes("paramilitary_explain"));
  });
});

describe("DS-160 Work/Education Additional CEAC fill", () => {
  let browser: Browser;

  before(async () => {
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    await browser.close();
  });

  it("fills every Yes branch, adds repeat rows, and reads values back", async () => {
    const page = await browser.newPage();
    await mountFixture(page);
    await fillWorkEducationAdditionalPage(page, YES_BRANCHES);

    const values = (selector: string) => page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement | HTMLSelectElement).value));
    assert.equal(await page.locator('[name="rblCLAN_TRIBE_IND"][value="Y"]').isChecked(), true);
    assert.equal(await page.locator('#tbxCLAN_TRIBE_NAME').inputValue(), "EXAMPLE CLAN");
    assert.deepEqual(await values('input[id*="tbxLANGUAGE_NAME"]'), ["ENGLISH", "MANDARIN"]);
    assert.deepEqual(await values('select[id*="ddlCOUNTRIES_VISITED"]'), ["JPN", "SING"]);
    assert.deepEqual(await values('input[id*="tbxORGANIZATION_NAME"]'), ["EXAMPLE ORGANIZATION", "EXAMPLE ASSOCIATION"]);
    assert.equal(await page.locator('#tbxSPECIALIZED_SKILLS_EXPL').inputValue(), "EXAMPLE TRAINING");
    assert.deepEqual(await values('input[id*="tbxMILITARY_SVC_RANK"]'), ["EXAMPLE RANK", "EXAMPLE RANK 2"]);
    assert.deepEqual(await values('select[id*="ddlMILITARY_SVC_FROMMonth"]'), ["JAN", "MAY"]);
    assert.equal(await page.locator('#tbxINSURGENT_ORG_EXPL').inputValue(), "EXAMPLE EXPLANATION");
    await page.close();
  });

  it("fails without touching DOM when a Yes branch is incomplete", async () => {
    const page = await browser.newPage();
    await mountFixture(page);
    let clicks = 0;
    await page.locator('input[type="radio"]').evaluateAll((nodes) => {
      nodes.forEach((node) => node.addEventListener("click", () => {
        (window as unknown as { testClickCount?: number }).testClickCount =
          ((window as unknown as { testClickCount?: number }).testClickCount ?? 0) + 1;
      }));
    });

    const incomplete = { ...YES_BRANCHES };
    delete incomplete.paramilitary_explain;
    await assert.rejects(fillWorkEducationAdditionalPage(page, incomplete), /paramilitary_explain/);
    clicks = await page.evaluate(() => (window as unknown as { testClickCount?: number }).testClickCount ?? 0);
    assert.equal(clicks, 0);
    await page.close();
  });
});
