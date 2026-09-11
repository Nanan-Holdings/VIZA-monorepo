import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  buildDs160SocialMediaPlan,
  fillSocialMediaPage,
} from "../orchestrator";

async function mountSocialMediaFixture(page: Page): Promise<void> {
  await page.setContent(`
    <div id="socialRows"></div>
    <button id="dtlSocial_ctl00_InsertButtonSOCIAL_MEDIA_INFO" type="button">Add Another</button>

    <label><input type="radio" name="rblAddSocial" value="Y">Yes</label>
    <label><input type="radio" name="rblAddSocial" value="N">No</label>
    <section id="otherSocial" hidden>
      <div id="otherSocialRows"></div>
      <button id="dtlAddSocial_ctl00_InsertButtonADD_SOCIAL" type="button">Add Another</button>
    </section>

    <script>
      const socialRows = document.querySelector('#socialRows');
      const otherRows = document.querySelector('#otherSocialRows');

      function addSocialRow() {
        const index = socialRows.children.length;
        const providerId = 'dtlSocial_ctl0' + index + '_ddlSocialMedia';
        const identifierId = 'dtlSocial_ctl0' + index + '_tbxSocialMediaIdent';
        socialRows.insertAdjacentHTML('beforeend', '<div>' +
          '<label for="' + providerId + '">Social Media Provider/Platform</label>' +
          '<select id="' + providerId + '">' +
            '<option value="">Select</option>' +
            '<option value="INST">INSTAGRAM</option>' +
            '<option value="RDDT">REDDIT</option>' +
            '<option value="NONE">NONE</option>' +
          '</select>' +
          '<label for="' + identifierId + '">Social Media Identifier</label>' +
          '<input id="' + identifierId + '" disabled>' +
          '</div>');
        const provider = document.querySelector('#' + providerId);
        provider.addEventListener('change', () => {
          const identifier = document.querySelector('#' + identifierId);
          identifier.disabled = provider.value === 'NONE' || provider.value === '';
          if (provider.value === 'NONE') identifier.value = '';
        });
      }

      function addOtherRow() {
        const index = otherRows.children.length;
        const platformId = 'dtlAddSocial_ctl0' + index + '_tbxPlatform';
        const handleId = 'dtlAddSocial_ctl0' + index + '_tbxHandle';
        otherRows.insertAdjacentHTML('beforeend', '<div>' +
          '<label for="' + platformId + '">Additional Social Media Platform</label>' +
          '<input id="' + platformId + '">' +
          '<label for="' + handleId + '">Additional Social Media Handle</label>' +
          '<input id="' + handleId + '">' +
          '</div>');
      }

      addSocialRow();
      document.querySelector('#dtlSocial_ctl00_InsertButtonSOCIAL_MEDIA_INFO')
        .addEventListener('click', addSocialRow);
      document.querySelector('#dtlAddSocial_ctl00_InsertButtonADD_SOCIAL')
        .addEventListener('click', addOtherRow);
      document.querySelectorAll('[name="rblAddSocial"]').forEach((radio) => {
        radio.addEventListener('click', () => {
          document.querySelector('#otherSocial').hidden = radio.value !== 'Y';
          if (radio.value === 'Y' && otherRows.children.length === 0) addOtherRow();
        });
      });
    </script>
  `);
}

describe("DS-160 social-media planning", () => {
  it("keeps NONE exclusive and does not carry an identifier", () => {
    assert.deepEqual(buildDs160SocialMediaPlan({
      "social_media[]": JSON.stringify([{ platform: "NONE", identifier: "stale" }]),
      has_other_social_media: "no",
    }), {
      socialMedia: [{ platform: "NONE", identifier: "" }],
      hasOtherSocialMedia: false,
      otherSocialMedia: [],
    });

    assert.throws(() => buildDs160SocialMediaPlan({
      "social_media[]": JSON.stringify([
        { platform: "NONE", identifier: "" },
        { platform: "INSTAGRAM", identifier: "account" },
      ]),
      has_other_social_media: "no",
    }), /cannot mix NONE/i);
  });

  it("fails closed when either conditional other-social field is missing", () => {
    assert.throws(() => buildDs160SocialMediaPlan({
      "social_media[]": JSON.stringify([{ platform: "NONE", identifier: "" }]),
      has_other_social_media: "yes",
      "other_social_media[]": JSON.stringify([{ platform: "Example site", handle: "" }]),
    }), /other_social_media\[0\]\.handle is required/i);
  });
});

describe("DS-160 CEAC social-media repeater fill", () => {
  let browser: Browser;

  before(async () => {
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    await browser.close();
  });

  it("fills both repeaters in order without advancing or overwriting rows", async () => {
    const page = await browser.newPage();
    await mountSocialMediaFixture(page);

    await fillSocialMediaPage(page, {
      "social_media[]": JSON.stringify([
        { platform: "INSTAGRAM", identifier: "first-account" },
        { platform: "REDDIT", identifier: "second-account" },
      ]),
      has_other_social_media: "yes",
      "other_social_media[]": JSON.stringify([
        { platform: "Example portfolio", handle: "profile-one" },
        { platform: "Example video site", handle: "profile-two" },
      ]),
    });

    const values = (selector: string) => page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement | HTMLSelectElement).value));
    assert.deepEqual(await values('select[id*="dtlSocial"]'), ["INST", "RDDT"]);
    assert.deepEqual(await values('input[id*="tbxSocialMediaIdent"]'), [
      "first-account",
      "second-account",
    ]);
    assert.equal(await page.locator('[name="rblAddSocial"][value="Y"]').isChecked(), true);
    assert.deepEqual(await values('input[id*="dtlAddSocial"][id*="Platform"]'), [
      "Example portfolio",
      "Example video site",
    ]);
    assert.deepEqual(await values('input[id*="dtlAddSocial"][id*="Handle"]'), [
      "profile-one",
      "profile-two",
    ]);
    await page.close();
  });

  it("maps NONE and other-social No without filling hidden detail controls", async () => {
    const page = await browser.newPage();
    await mountSocialMediaFixture(page);

    await fillSocialMediaPage(page, {
      "social_media[]": JSON.stringify([{ platform: "NONE", identifier: "" }]),
      has_other_social_media: "no",
      "other_social_media[]": "[]",
    });

    assert.equal(await page.locator('select[id*="dtlSocial"]').inputValue(), "NONE");
    assert.equal(await page.locator('input[id*="tbxSocialMediaIdent"]').isDisabled(), true);
    assert.equal(await page.locator('[name="rblAddSocial"][value="N"]').isChecked(), true);
    assert.equal(await page.locator('#otherSocial').isHidden(), true);
    assert.equal(await page.locator('input[id*="dtlAddSocial"]').count(), 0);
    await page.close();
  });
});
