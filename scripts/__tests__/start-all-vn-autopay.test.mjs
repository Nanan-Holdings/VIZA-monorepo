import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const script = readFileSync(new URL("../start-all.ps1", import.meta.url), "utf8");
const devScript = readFileSync(new URL("../start-viza-dev.ps1", import.meta.url), "utf8");

test("start-all restarts an existing frontend so submission service env is injected", () => {
  assert.match(script, /\$frontendNeedsRestartForSubmissionServiceEnv\s*=\s*\$frontendAlreadyRunning/u);
  assert.match(script, /Stop-ProcessesByPath -Path \$frontendDir/u);
  assert.match(script, /\$frontendAlreadyRunning\s*=\s*\$false/u);
});

test("start-all starts submission-service and frontend without payment configuration", () => {
  assert.doesNotMatch(script, /VN_LOCAL_CARD_SESSION_ENABLED/u);
  assert.doesNotMatch(script, /ID_LOCAL_CARD_SESSION_ENABLED/u);
  assert.match(script, /\$env:SUBMISSION_SERVICE_LOCAL_URL = 'http:\/\/127\.0\.0\.1:\$SubmissionPort'/u);
  assert.match(script, /\$env:NEXT_PUBLIC_INDONESIA_LIVE_SUBMISSION_ENABLED = 'true'/u);
  assert.doesNotMatch(script, /card-session/u);
});

test("start-viza-dev starts the Indonesia worker and points the frontend at the same local service", () => {
  assert.doesNotMatch(devScript, /ID_LOCAL_CARD_SESSION_ENABLED/u);
  assert.match(devScript, /\$env:SUBMISSION_SERVICE_LOCAL_URL = 'http:\/\/127\.0\.0\.1:\$SubmissionPort'/u);
  assert.match(devScript, /\$env:NEXT_PUBLIC_INDONESIA_LIVE_SUBMISSION_ENABLED = 'true'/u);
  assert.doesNotMatch(devScript, /Indonesia one-time card session endpoint/u);
  assert.doesNotMatch(devScript, /card-session/u);
});
