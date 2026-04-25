/**
 * Diagnostic #3: land on Personal Information 1 and dump the input/select/
 * radio IDs so we can update DS-160 mappings with real CEAC selectors.
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
config({ path: path.join(__dirname, "../../.env") });

import { startCeacSession } from "./session";
import { handleConfirmApplicationPage } from "./confirm-application";

const OUT_DIR = path.join(__dirname, "../../diag-out");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const session = await startCeacSession({ headless: true, runId: "diag3" });
  try {
    const page = session.page;
    console.log(`[diag3] After bootstrap: ${page.url()}`);

    const confirm = await handleConfirmApplicationPage(page, {
      securityAnswer: "VIZATEST",
      securityQuestionValue: "3",
    });
    console.log(`[diag3] applicationId=${confirm.applicationId}`);
    console.log(`[diag3] Now on: ${page.url()}`);

    const dump = await page.evaluate(`
      (function() {
        function list(sel) {
          var out = [];
          var ns = document.querySelectorAll(sel);
          for (var i = 0; i < ns.length; i++) {
            out.push({ id: ns[i].id, name: ns[i].name, type: ns[i].type || '', value: ns[i].value || '', tag: ns[i].tagName });
          }
          return out;
        }
        return {
          inputs_text: list('input[type="text"], input:not([type])'),
          selects: list('select'),
          radios: list('input[type="radio"]'),
          checkboxes: list('input[type="checkbox"]'),
          submits: list('input[type="submit"]'),
        };
      })()
    `);

    fs.writeFileSync(path.join(OUT_DIR, "pi1-elements.json"), JSON.stringify(dump, null, 2));
    console.log(`[diag3] Wrote pi1-elements.json`);
    console.log(JSON.stringify(dump, null, 2));

    await page.screenshot({ path: path.join(OUT_DIR, "pi1.png"), fullPage: true });
  } finally {
    await session.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
