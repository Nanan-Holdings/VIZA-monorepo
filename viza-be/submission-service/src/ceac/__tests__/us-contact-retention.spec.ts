import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { ds160UsContactMappings } from "../../ds160-form-mappings";
import { fitUsContactAddressLines, verifyUsContactPageValues } from "../orchestrator";
import { detectPage } from "../pages";

describe("CEAC U.S. contact value retention", () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  after(async () => {
    await browser.close();
  });

  it("maps every canonical U.S. contact answer to a CEAC control", () => {
    const expectedFields = [
      "us_contact_surname",
      "us_contact_given_names",
      "us_contact_organization",
      "us_contact_relationship",
      "us_contact_address_street1",
      "us_contact_address_street2",
      "us_contact_city",
      "us_contact_state",
      "us_contact_zip",
      "us_contact_phone",
      "us_contact_email",
      "us_contact_email_na",
      "us_contact_organization_na",
      "us_contact_name_na",
    ];

    for (const fieldName of expectedFields) {
      assert.ok(ds160UsContactMappings[fieldName], `${fieldName} is not mapped`);
    }
    assert.equal(ds160UsContactMappings.us_contact_address_street2.selector, 'input[id*="tbxUS_POC_ADDR_LN2"]');
  });

  it("copies every supplied scalar value without format judgement", async () => {
    await page.setContent(`
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_SURNAME" value="old">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_GIVEN_NAME" value="old">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ORG" value="old">
      <select id="ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_REL">
        <option value="FRIEND">FRIEND</option>
        <option value="RELATIVE">RELATIVE</option>
      </select>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_LN1" value="old">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_LN2" value="old">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_CITY" value="old">
      <select id="ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_ADDR_STATE">
        <option value="">- Select One -</option>
        <option value="CA">CALIFORNIA</option>
        <option value="NY">NEW YORK</option>
      </select>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_POSTAL_CD" value="bad">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_HOME_TEL" value="old">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_EMAIL" value="bad">
    `);

    const answers = {
      us_contact_surname: "CHEN",
      us_contact_given_names: "LI WEI",
      us_contact_organization: "VIZA SOURCE ORGANIZATION",
      us_contact_relationship: "RELATIVE",
      us_contact_address_street1: "17 HARBOUR CREST AVENUE",
      us_contact_address_street2: "#12-04",
      us_contact_city: "SINGAPORE",
      us_contact_state: "CA",
      us_contact_zip: "VALUE-FROM-VIZA",
      us_contact_phone: "+65 6123 4567",
      us_contact_email: "VALUE-FROM-VIZA",
    };

    await verifyUsContactPageValues(page, answers);

    for (const fieldName of [
      "us_contact_surname",
      "us_contact_given_names",
      "us_contact_organization",
      "us_contact_address_street1",
      "us_contact_address_street2",
      "us_contact_city",
      "us_contact_zip",
      "us_contact_phone",
      "us_contact_email",
    ] as const) {
      assert.equal(
        await page.locator(ds160UsContactMappings[fieldName].selector).inputValue(),
        answers[fieldName],
      );
    }

    assert.equal(
      await page.locator('select[id*="ddlUS_POC_REL"]').inputValue(),
      "RELATIVE",
    );
    assert.equal(
      await page.locator('select[id*="ddlUS_POC_ADDR_STATE"]').inputValue(),
      "CA",
    );
  });

  it("copies every supplied not-applicable checkbox value", async () => {
    await page.setContent(`
      <input id="ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA" type="checkbox">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_ORG_NA_IND" type="checkbox" checked>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_cbexUS_POC_EMAIL_ADDR_NA" type="checkbox">
    `);

    await verifyUsContactPageValues(page, {
      us_contact_name_na: "Y",
      us_contact_organization_na: "N",
      us_contact_email_na: "Y",
    });

    assert.equal(
      await page.locator(ds160UsContactMappings.us_contact_name_na.selector).isChecked(),
      true,
    );
    assert.equal(
      await page.locator(ds160UsContactMappings.us_contact_organization_na.selector).isChecked(),
      false,
    );
    assert.equal(
      await page.locator(ds160UsContactMappings.us_contact_email_na.selector).isChecked(),
      true,
    );
  });

  it("selects a CEAC state when VIZA supplies the visible option text", async () => {
    await page.setContent(`
      <select id="ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_ADDR_STATE">
        <option value="">- Select One -</option>
        <option value="CA">CALIFORNIA</option>
        <option value="NY">NEW YORK</option>
      </select>
    `);

    await verifyUsContactPageValues(page, { us_contact_state: "CALIFORNIA" });

    assert.equal(
      await page.locator(ds160UsContactMappings.us_contact_state.selector).inputValue(),
      "CA",
    );
  });

  it("deduplicates and splits an overlong saved address across the two CEAC lines", () => {
    const address = "17 HARBOUR CREST AVENUE, #12-04, SINGAPORE";

    const fitted = fitUsContactAddressLines(address, address, 40, 40);

    assert.ok(fitted.line1.length <= 40);
    assert.ok(fitted.line2.length <= 40);
    assert.equal(`${fitted.line1} ${fitted.line2}`, address);
  });

  it("recognizes the timeout overlay before treating the page as U.S. contact", async () => {
    await page.setContent(`
      <h2>U.S. Point of Contact Information</h2>
      <div>Your session has timed out. To recover your application, enter the requested information.</div>
    `);

    assert.equal((await detectPage(page)).id, "session_expired");
  });

  it("recognizes the CEAC application recovery URL when no standard heading is present", async () => {
    await page.route("https://ceac.state.gov/GenNIV/common/Recovery.aspx", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<main>Recover Your Application</main>",
      });
    });
    await page.goto("https://ceac.state.gov/GenNIV/common/Recovery.aspx");

    assert.equal((await detectPage(page)).id, "retrieve_application");
  });
});
