import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  ds160SecurityBackground1Mappings,
  ds160SecurityBackground2Mappings,
  ds160SecurityBackground3Mappings,
  ds160SecurityBackground4Mappings,
  ds160SecurityBackground5Mappings,
} from "../../ds160-form-mappings";
import {
  DS160_SECURITY_BACKGROUND_KEYS,
  buildDs160SecurityBackgroundPlan,
  fillSecurityBackgroundPage,
  findMissingDs160SecurityBackgroundAnswers,
  type Ds160SecurityBackgroundKey,
} from "../security-background";

const SECURITY_FIXTURE: ReadonlyArray<{
  key: Ds160SecurityBackgroundKey;
  fragment: string;
  part: 1 | 2 | 3 | 4 | 5;
}> = [
  { key: "has_communicable_disease", fragment: "Disease", part: 1 },
  { key: "has_physical_mental_disorder", fragment: "Disorder", part: 1 },
  { key: "is_drug_abuser", fragment: "Druguser", part: 1 },
  { key: "has_arrest_conviction", fragment: "Arrested", part: 2 },
  { key: "has_violated_controlled_substance", fragment: "ControlledSubstances", part: 2 },
  { key: "has_prostitution", fragment: "Prostitution", part: 2 },
  { key: "has_money_laundering", fragment: "MoneyLaundering", part: 2 },
  { key: "has_human_trafficking", fragment: "HumanTrafficking_", part: 2 },
  { key: "has_aided_human_trafficking", fragment: "AssistedSevereTrafficking", part: 2 },
  { key: "has_trafficking_beneficiary", fragment: "HumanTraffickingRelated", part: 2 },
  { key: "intend_illegal_activity", fragment: "IllegalActivity", part: 3 },
  { key: "intend_terrorist_activity", fragment: "TerroristActivity", part: 3 },
  { key: "has_provided_terrorist_support", fragment: "TerroristSupport", part: 3 },
  { key: "is_terrorist_member", fragment: "TerroristOrg", part: 3 },
  { key: "is_terrorist_family", fragment: "TerroristRel", part: 3 },
  { key: "has_genocide", fragment: "Genocide", part: 3 },
  { key: "has_torture", fragment: "Torture", part: 3 },
  { key: "has_extrajudicial_killings", fragment: "ExViolence", part: 3 },
  { key: "has_child_soldier", fragment: "ChildSoldier", part: 3 },
  { key: "has_religious_freedom_violation", fragment: "ReligiousFreedom", part: 3 },
  { key: "has_population_control", fragment: "PopulationControls", part: 3 },
  { key: "has_coercive_transplant", fragment: "Transplant", part: 3 },
  { key: "has_immigration_fraud", fragment: "ImmigrationFraud", part: 4 },
  { key: "has_removal_deportation_hearing", fragment: "RemovalHearing", part: 4 },
  { key: "has_failed_removal_hearing", fragment: "FailToAttend", part: 4 },
  { key: "has_overstayed", fragment: "UnlawfulPresence", part: 4 },
  { key: "has_removal_order", fragment: "Deport", part: 4 },
  { key: "has_withheld_child_custody", fragment: "ChildCustody", part: 5 },
  { key: "has_voted_illegally", fragment: "VotingViolation", part: 5 },
  { key: "has_renounced_citizenship", fragment: "RenounceExp", part: 5 },
];

const MAPPINGS_BY_PART = {
  1: ds160SecurityBackground1Mappings,
  2: ds160SecurityBackground2Mappings,
  3: ds160SecurityBackground3Mappings,
  4: ds160SecurityBackground4Mappings,
  5: ds160SecurityBackground5Mappings,
} as const;

function allSecurityAnswers(answer: "yes" | "no"): Record<string, string> {
  return Object.fromEntries(DS160_SECURITY_BACKGROUND_KEYS.flatMap((key) => [
    [key, answer],
    ...(answer === "yes" ? [[`${key}_explain`, `EXAMPLE ${key}`]] : []),
  ]));
}

async function mountPart(page: Page, part: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const fields = SECURITY_FIXTURE.filter((field) => field.part === part);
  await page.setContent(fields.map(({ key, fragment }) => `
    <section data-key="${key}">
      <label><input type="radio" name="rbl${fragment}" value="Y">Yes</label>
      <label><input type="radio" name="rbl${fragment}" value="N">No</label>
      <textarea id="tbx${fragment}" hidden></textarea>
    </section>
  `).join("") + `
    <script>
      document.querySelectorAll('section[data-key]').forEach((section) => {
        const detail = section.querySelector('textarea');
        section.querySelectorAll('input[type="radio"]').forEach((radio) => {
          radio.addEventListener('click', () => { detail.hidden = radio.value !== 'Y'; });
        });
      });
    </script>
  `);
}

describe("DS-160 Security and Background planning", () => {
  it("requires every gate and every Yes explanation", () => {
    const answers = allSecurityAnswers("no");
    delete answers.has_communicable_disease;
    answers.has_arrest_conviction = "yes";

    assert.deepEqual(findMissingDs160SecurityBackgroundAnswers(answers), [
      "has_communicable_disease",
      "has_arrest_conviction_explain",
    ]);
  });

  it("builds each page only when its mapping and answers are complete", () => {
    const answers = allSecurityAnswers("yes");
    const plan = buildDs160SecurityBackgroundPlan(ds160SecurityBackground1Mappings, answers);
    assert.equal(plan.length, 3);
    assert.ok(plan.every((item) => item.answer && item.explanation?.startsWith("EXAMPLE")));

    const brokenMappings = { ...ds160SecurityBackground1Mappings };
    delete brokenMappings.has_communicable_disease_explain;
    assert.throws(
      () => buildDs160SecurityBackgroundPlan(brokenMappings, answers),
      /missing has_communicable_disease_explain/,
    );
  });

  it("reads legacy aliases but emits only canonical Part 4 keys", () => {
    const answers = allSecurityAnswers("no");
    delete answers.has_removal_deportation_hearing;
    delete answers.has_failed_removal_hearing;
    delete answers.has_overstayed;
    answers.subject_to_removal_order = "yes";
    answers.subject_to_removal_order_explain = "EXAMPLE HEARING";
    answers.failed_removal_hearing = "yes";
    answers.failed_removal_hearing_explain = "EXAMPLE MISSED HEARING";
    answers.has_unlawful_presence = "yes";
    answers.has_unlawful_presence_explain = "EXAMPLE OVERSTAY";

    const plan = buildDs160SecurityBackgroundPlan(ds160SecurityBackground4Mappings, answers);
    const byKey = new Map(plan.map((item) => [item.key, item]));
    assert.equal(byKey.get("has_removal_deportation_hearing")?.explanation, "EXAMPLE HEARING");
    assert.equal(byKey.get("has_failed_removal_hearing")?.explanation, "EXAMPLE MISSED HEARING");
    assert.equal(byKey.get("has_overstayed")?.explanation, "EXAMPLE OVERSTAY");
    assert.equal(plan.some((item) => item.key === ("subject_to_removal_order" as never)), false);
    assert.equal(plan.some((item) => item.key === ("failed_removal_hearing" as never)), false);
    assert.equal(plan.some((item) => item.key === ("has_unlawful_presence" as never)), false);
  });

  it("fails closed on missing Part 4 answers or Yes explanations", () => {
    const answers = allSecurityAnswers("no");
    delete answers.has_removal_deportation_hearing;
    answers.has_failed_removal_hearing = "yes";
    answers.has_overstayed = "yes";

    assert.deepEqual(
      findMissingDs160SecurityBackgroundAnswers(answers).filter((key) =>
        key.startsWith("has_removal_deportation_hearing")
        || key.startsWith("has_failed_removal_hearing")
        || key.startsWith("has_overstayed")
      ),
      [
        "has_removal_deportation_hearing",
        "has_failed_removal_hearing_explain",
        "has_overstayed_explain",
      ],
    );
  });

  it("rejects obsolete non-official Security mappings", () => {
    assert.equal(DS160_SECURITY_BACKGROUND_KEYS.includes("has_been_detained" as never), false);
    assert.equal(DS160_SECURITY_BACKGROUND_KEYS.includes("practicing_polygamy" as never), false);
    const obsoleteMapping = {
      ...ds160SecurityBackground4Mappings,
      has_been_detained: {
        selector: 'input[name="obsolete"]',
        type: "radio" as const,
        label: "Obsolete",
      },
      has_been_detained_explain: {
        selector: 'textarea[name="obsolete_explain"]',
        type: "text" as const,
        label: "Obsolete Explanation",
      },
    };
    assert.throws(
      () => buildDs160SecurityBackgroundPlan(obsoleteMapping, allSecurityAnswers("no")),
      /unsupported keys: has_been_detained/,
    );
  });
});

describe("DS-160 Security and Background CEAC fill", () => {
  let browser: Browser;

  before(async () => {
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    await browser.close();
  });

  it("fills and reads back every Yes explanation across Parts 1-5", async () => {
    const answers = allSecurityAnswers("yes");
    for (const part of [1, 2, 3, 4, 5] as const) {
      const page = await browser.newPage();
      await mountPart(page, part);
      await fillSecurityBackgroundPage(page, MAPPINGS_BY_PART[part], answers);
      for (const { key, fragment } of SECURITY_FIXTURE.filter((field) => field.part === part)) {
        assert.equal(await page.locator(`[name="rbl${fragment}"][value="Y"]`).isChecked(), true);
        assert.equal(await page.locator(`#tbx${fragment}`).inputValue(), `EXAMPLE ${key}`);
      }
      await page.close();
    }
  });

  it("fails closed when an applicable explanation control is absent", async () => {
    const page = await browser.newPage();
    await mountPart(page, 1);
    await page.locator("#tbxDisease").evaluate((node) => node.remove());
    await assert.rejects(
      fillSecurityBackgroundPage(page, ds160SecurityBackground1Mappings, allSecurityAnswers("yes")),
      /has_communicable_disease_explain control was not found/,
    );
    await page.close();
  });
});
