import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const script = readFileSync(new URL("../start-all.ps1", import.meta.url), "utf8");

test("start-all restarts an existing frontend so Vietnam card-session env is injected", () => {
  assert.match(script, /\$frontendNeedsRestartForSubmissionServiceEnv\s*=\s*\$frontendAlreadyRunning/u);
  assert.match(script, /Stop-ProcessesByPath -Path \$frontendDir/u);
  assert.match(script, /\$frontendAlreadyRunning\s*=\s*\$false/u);
});

test("start-all starts submission-service and frontend with matching card-session URL", () => {
  assert.match(script, /\$env:VN_LOCAL_CARD_SESSION_ENABLED = 'true'/u);
  assert.match(script, /\$env:SUBMISSION_SERVICE_LOCAL_URL = 'http:\/\/127\.0\.0\.1:\$SubmissionPort'/u);
});
