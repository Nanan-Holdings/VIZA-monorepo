import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import { TwOfficialValidationError } from "../errors";
import { assertTwOfficialValidationGate, type TwRepairOperation } from "../repair-loop";
import type { TwFieldVerificationEntry } from "../fillers";

let browser: Browser;
let buildTwApplicationFieldOperations: typeof import("../apply").buildTwApplicationFieldOperations;

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

before(async () => {
  ({ buildTwApplicationFieldOperations } = await import("../apply"));
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newPage(html = "<!doctype html><body></body>"): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(html);
  return page;
}

function buildOperations(
  page: Page,
  answers: Record<string, string>,
  audit: TwFieldVerificationEntry[] = [],
): TwRepairOperation[] {
  return buildTwApplicationFieldOperations(
    page,
    {
      eligibility_category: "1",
      embassy_office: "53",
      has_other_nationality_passport: "no",
      mainland_id_number_not_applicable: "true",
      ...answers,
    },
    {},
    null,
    audit,
  );
}

function op(operations: TwRepairOperation[], fieldKey: string): TwRepairOperation {
  const found = operations.find((operation) => operation.fieldKey === fieldKey);
  assert.ok(found, `missing operation ${fieldKey}`);
  return found;
}

describe("Taiwan formal application mapping and validation gate", () => {
  it("maps father and mother fields to their official indexed kinship controls", async () => {
    const page = await newPage();
    try {
      const operations = buildOperations(page, { kin_father_status: "1", kin_mother_status: "1" });
      assert.deepEqual(
        [
          op(operations, "kin_father_status").controlName,
          op(operations, "kin_father_name").controlName,
          op(operations, "kin_father_current_address").controlName,
          op(operations, "kin_mother_status").controlName,
          op(operations, "kin_mother_name").controlName,
          op(operations, "kin_mother_current_address").controlName,
        ],
        [
          "kinships[0].deadMark",
          "kinships[0].chineseName",
          "kinships[0].address",
          "kinships[1].deadMark",
          "kinships[1].chineseName",
          "kinships[1].address",
        ],
      );
    } finally {
      await page.close();
    }
  });

  it("waits for the official Mainland dependent option and selects it", async () => {
    const page = await newPage(`
      <!doctype html><body>
        <select name="traveller.birthPlaceCode">
          <option value="">請選擇</option><option value="1">中國大陸</option><option value="5">其他</option>
        </select>
        <select name="traveller.birthPlace1"><option value="">請選擇</option></select>
        <script>
          document.querySelector('[name="traveller.birthPlaceCode"]').addEventListener('change', () => {
            setTimeout(() => {
              document.querySelector('[name="traveller.birthPlace1"]').innerHTML =
                '<option value="">請選擇</option><option value="湖南">湖南</option>';
            }, 300);
          });
        </script>
      </body>
    `);
    const audit: TwFieldVerificationEntry[] = [];
    try {
      const operations = buildOperations(
        page,
        { birth_place_is_mainland: "mainland", birth_place_mainland_region: "湖南" },
        audit,
      );
      await op(operations, "birth_place_is_mainland").run();
      await op(operations, "birth_place_mainland_region").run();
      assert.equal(await page.locator('[name="traveller.birthPlace1"]').inputValue(), "湖南");
      assert.ok(audit.some((entry) => entry.fieldName === "birth_place_mainland_region" && entry.status === "matched"));
    } finally {
      await page.close();
    }
  });

  it("keeps a student school operation and omits job title", async () => {
    const page = await newPage();
    try {
      const operations = buildOperations(page, {
        current_occupation: "14",
        company_name: "National University of Singapore",
        job_title: "STALE_TITLE",
      });
      assert.equal(op(operations, "company_name").controlName, "careersInformations[0].unitTitle");
      assert.equal(operations.some((operation) => operation.fieldKey === "job_title"), false);
    } finally {
      await page.close();
    }
  });

  it("blocks final submission when HTML validity or a visible official format error remains", async () => {
    const page = await newPage(`
      <!doctype html><body>
        <form>
          <input name="traveller.chineseName" required value="">
          <div><input name="careersInformations[0].unitTitle" aria-invalid="true" value="Bad"></div>
          <div class="invalid-feedback" style="display:block">格式錯誤</div>
        </form>
      </body>
    `);
    const operations: TwRepairOperation[] = [
      { fieldKey: "name_chinese", controlName: "traveller.chineseName", kind: "text", run: async () => undefined },
      { fieldKey: "company_name", controlName: "careersInformations[0].unitTitle", kind: "text", run: async () => undefined },
    ];
    try {
      await assert.rejects(
        () => assertTwOfficialValidationGate(page, operations),
        (error) =>
          error instanceof TwOfficialValidationError &&
          error.validationKeys.includes("name_chinese") &&
          error.validationKeys.includes("company_name"),
      );
    } finally {
      await page.close();
    }
  });

  it("allows final submission only when the official validation count is zero", async () => {
    const page = await newPage('<!doctype html><body><input name="traveller.chineseName" required value="王小明"></body>');
    try {
      await assert.doesNotReject(() => assertTwOfficialValidationGate(page, [
        { fieldKey: "name_chinese", controlName: "traveller.chineseName", kind: "text", run: async () => undefined },
      ]));
    } finally {
      await page.close();
    }
  });

  it("runs official validation before the formal submit stage", async () => {
    const source = await readFile(join(process.cwd(), "src", "tw", "apply.ts"), "utf8");
    const gate = source.indexOf("validate: () => collectTwOfficialValidationIssues(page)");
    const submit = source.indexOf("submit: () => solveTwCaptchaAndSubmitWithRetry(page, {");
    assert.ok(gate > 0 && submit > gate);
  });
});
