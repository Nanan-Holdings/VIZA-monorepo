import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const script = readFileSync(new URL("../start-all.ps1", import.meta.url), "utf8");
const devScript = readFileSync(new URL("../start-viza-dev.ps1", import.meta.url), "utf8");

test("start-all restarts an existing frontend so Vietnam card-session env is injected", () => {
  assert.match(script, /\$frontendNeedsRestartForSubmissionServiceEnv\s*=\s*\$frontendAlreadyRunning/u);
  assert.match(script, /Stop-ProcessesByPath -Path \$frontendDir/u);
  assert.match(script, /\$frontendAlreadyRunning\s*=\s*\$false/u);
});

test("start-all starts submission-service and frontend with matching Vietnam and Indonesia card-session settings", () => {
  assert.match(script, /\$env:VN_LOCAL_CARD_SESSION_ENABLED = 'true'/u);
  assert.match(script, /\$env:ID_LOCAL_CARD_SESSION_ENABLED = 'true'/u);
  assert.match(script, /\$env:SUBMISSION_SERVICE_LOCAL_URL = 'http:\/\/127\.0\.0\.1:\$SubmissionPort'/u);
  assert.match(script, /\$env:NEXT_PUBLIC_INDONESIA_LIVE_SUBMISSION_ENABLED = 'true'/u);
  assert.match(script, /local\/indonesia\/card-session/u);
});

test("start-viza-dev starts the Indonesia worker and points the frontend at the same local service", () => {
  assert.match(devScript, /\$env:ID_LOCAL_CARD_SESSION_ENABLED = 'true'/u);
  assert.match(devScript, /\$env:SUBMISSION_SERVICE_LOCAL_URL = 'http:\/\/127\.0\.0\.1:\$SubmissionPort'/u);
  assert.match(devScript, /\$env:NEXT_PUBLIC_INDONESIA_LIVE_SUBMISSION_ENABLED = 'true'/u);
  assert.match(devScript, /Indonesia one-time card session endpoint/u);
  assert.match(devScript, /local\/indonesia\/card-session/u);
});
