import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Indonesia Fly topology is one cheap sticky scale-to-zero Machine", () => {
  const config = readRepoFile(
    "viza-be/submission-service/deploy/fly/fly.indonesia.toml",
  );
  const scaler = readRepoFile(
    "viza-be/submission-service/scripts/fly/scale-workers.sh",
  );
  const deployWorkflow = readRepoFile(
    ".github/workflows/deploy-submission-service-fly.yml",
  );
  const secretSync = readRepoFile(
    "viza-be/submission-service/scripts/fly/sync-runtime-secrets.sh",
  );
  const workerEntry = readRepoFile(
    "viza-be/submission-service/src/index.ts",
  );

  assert.match(config, /app = "viza-runner-indonesia"/);
  assert.match(config, /RUNNER_MACHINE_KIND = "indonesia"/);
  assert.match(config, /SUBMISSION_SERVICE_INDONESIA_QUEUE_ENABLED = "true"/);
  assert.match(config, /SUBMISSION_SERVICE_MAX_CONCURRENCY = "1"/);
  assert.match(config, /memory_mb = 2048/);
  assert.match(config, /cpu_kind = "shared"/);
  assert.match(config, /cpus = 1/);
  assert.match(config, /SUBMISSION_SERVICE_IDLE_EXIT_MS = "120000"/);
  assert.match(scaler, /kind" == "indonesia"/);
  assert.match(scaler, /viza-runner-indonesia/);
  assert.match(deployWorkflow, /deploy-indonesia\.sh/);
  assert.match(secretSync, /Missing required Indonesia card-session internal token/);
  assert.match(workerEntry, /hasIndonesiaCardSessions\(\)/);
  assert.match(workerEntry, /INDONESIA_QUEUE_ENABLED && await hasIndonesiaWorkerWork\(\)/);
});

test("Vietnam Pre-Arrival remains shared-pool only", () => {
  const autoscaler = readRepoFile(
    "viza-be/agent-backend/scripts/autoscale-runners.ts",
  );
  const poolConfig = readRepoFile(
    "viza-be/submission-service/deploy/fly/fly.pool.toml",
  );
  const wakeRouting = readRepoFile(
    "viza-fe/internal-website/lib/fly-machine-wake.server.ts",
  );
  const deployWorkflow = readRepoFile(
    ".github/workflows/deploy-submission-service-fly.yml",
  );

  const legacyStatuses =
    autoscaler.split("const LEGACY_CLAIMABLE_QUEUE_STATUSES")[1]
      ?.split("] as const;")[0] ?? "";
  const legacyScheduled =
    autoscaler.split("const LEGACY_SCHEDULED_QUEUE_STATUSES")[1]
      ?.split("] as const;")[0] ?? "";

  assert.doesNotMatch(legacyStatuses, /vn_prearrival/);
  assert.doesNotMatch(legacyScheduled, /vn_prearrival/);
  assert.match(poolConfig, /RUNNER_MACHINE_KIND = "pool"/);
  assert.match(poolConfig, /VN_PREARRIVAL_BROWSERBASE_ENABLED = "true"/);
  assert.match(wakeRouting, /vn: "pool"/);
  assert.doesNotMatch(wakeRouting, /viza-runner-vietnam/);
  assert.match(deployWorkflow, /deploy-pool\.sh/);
});
