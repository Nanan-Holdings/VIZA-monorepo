import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, "..", "start-local-official-helpers.ps1");

test("start-local-official-helpers dry-run enables local official helper endpoints", () => {
  const output = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-DryRun", "-Port", "18080"],
    { encoding: "utf8" },
  );
  const config = JSON.parse(output);

  assert.equal(config.port, 18080);
  assert.equal(config.env.VN_LOCAL_CARD_SESSION_ENABLED, "true");
  assert.equal(config.env.ID_LOCAL_CARD_SESSION_ENABLED, "true");
  assert.equal(config.env.KR_VISA_PORTAL_EFORM_LOCAL_ENABLED, "true");
  assert.equal(config.endpoints.includes("/local/vietnam/card-session"), true);
  assert.equal(config.endpoints.includes("/local/indonesia/card-session"), true);
  assert.equal(config.endpoints.includes("/local/korea-eform/generate"), true);
});
