import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, "..", "..");
const repositoryRoot = path.resolve(serviceRoot, "..", "..");

function read(relativePath) {
  return readFileSync(path.join(serviceRoot, relativePath), "utf8");
}

test("Philippines is a country-scoped runner_job worker", () => {
  const countryConfig = JSON.parse(read("deploy/fly/countries.json"));
  const template = read("deploy/fly/fly.country.toml.template");
  const deployScript = read("scripts/fly/deploy-country.sh");

  assert.equal(countryConfig.countries.includes("philippines"), true);
  assert.match(deployScript, /app="viza-runner-\$\{country\/\/_\/-\}"/);
  assert.equal(`viza-runner-${"philippines".replaceAll("_", "-")}`, "viza-runner-philippines");
  assert.match(template, /RUNNER_JOB_COUNTRY = "__COUNTRY__"/);
  assert.match(template, /SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED = "true"/);
  assert.match(template, /SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED = "false"/);
});

test("Philippines syncs only its existing browser and CAPTCHA capabilities", () => {
  const secretSyncScript = read("scripts/fly/sync-runtime-secrets.sh");
  const philippinesCase = secretSyncScript.match(
    /philippines\)\s*([\s\S]*?)\s*;;/,
  )?.[1];

  assert.ok(philippinesCase, "missing philippines secret-sync branch");
  assert.match(philippinesCase, /capability=\(BROWSERBASE_API_KEY TWOCAPTCHA_API_KEY\)/);
  assert.doesNotMatch(philippinesCase, /IMAP_/);
});

test("Fly workflow deploys country workers from the shared country list", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "deploy-submission-service-fly.yml"),
    "utf8",
  );

  assert.match(workflow, /\.countries\[\]/);
  assert.match(workflow, /scripts\/fly\/deploy-country\.sh "\$country"/);
  assert.doesNotMatch(workflow, /legacy worker that serves Philippines/i);
});
