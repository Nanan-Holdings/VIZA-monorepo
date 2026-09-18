# DS-160 captured-resume operator recovery

This command is an operator-only continuation for a DS-160 queue row that
already contains a captured CEAC Application ID and encrypted retrieval
question/answer. It does not create a new CEAC draft and it never submits the
official form by itself.

The command is read-only unless `--execute` is supplied. Both identifiers are
mandatory and must be exact UUIDs:

```powershell
cd viza-be\submission-service
npm run queue:recover-ds160 -- --application-id=<application-uuid> --job-id=<queue-job-uuid>
```

The dry-run must report an empty blocker list before an operator applies the
transition:

```powershell
npm run queue:recover-ds160 -- --application-id=<application-uuid> --job-id=<queue-job-uuid> --execute
```

The preflight verifies the application country and DS-160 type, exact queue
ownership, `ds160_blocked` plus
`final_submission_recovery_required`, live-assisted CEAC routing, remaining
queue attempts, an unlocked row, all three encrypted checkpoint fields, and a
decrypted checkpoint Application ID matching `applications.ds160_application_id`.
It also rejects official success evidence, any final-submission fence, active
sibling queue work, and active or successful rows in `ds160_submission_jobs`.

The conditional update changes only the queue status/stage and recovery
metadata. It preserves every encrypted checkpoint and the existing
`ds160_final_submission_attempts` fence. Its `WHERE` clause repeats the exact
application/job/status/stage/attempt/checkpoint/lease/success predicates; a
zero-row response is treated as a concurrent race and fails closed.

The existing `submission_queue_one_active_job_per_application_idx` partial
unique index is the database-level sibling-job fence. If another active queue
row is inserted between the read-only preflight and the conditional update,
Postgres rejects the status change rather than allowing two active jobs. The
command does not bypass that constraint or introduce a second public RPC.

After a successful transition, run the worker with the server-only exact job
gate, after verifying the live deployment flags through the operator runbook:

```powershell
$env:DS160_RESUME_CAPTURED_JOB_ID = "<queue-job-uuid>"
$env:SUBMISSION_SERVICE_TARGET_JOB_ID = "<queue-job-uuid>"
```

For a single isolated local operator run, use the following complete scope.
The process inherits `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUBMISSION_RESULT_SECRET_KEY`, `BROWSERBASE_API_KEY`, and `TWOCAPTCHA_API_KEY`
from the approved runtime environment; do not put their values in the shell
history or this document. `PORT=18082` keeps the health server away from the
usual local process. The idle exit is honored on a Fly machine that already
provides `FLY_MACHINE_ID`; do not invent a machine ID on a workstation.

```powershell
cd viza-be\submission-service
$env:PORT = "18082"
$env:SUBMISSION_SERVICE_PROVIDER_ALLOWLIST = "ceac_live"
$env:SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED = "true"
$env:SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED = "false"
$env:SUBMISSION_SERVICE_LEGACY_US_APPOINTMENT_POLL_ENABLED = "false"
$env:VN_CLOUD_QUEUE_ENABLED = "false"
$env:SUBMISSION_SERVICE_INDONESIA_QUEUE_ENABLED = "false"
$env:SUBMISSION_SERVICE_MAX_CONCURRENCY = "1"
$env:SUBMISSION_SERVICE_TARGET_JOB_ID = "<queue-job-uuid>"
$env:DS160_RESUME_CAPTURED_JOB_ID = "<queue-job-uuid>"
$env:DS160_SUBMISSION_MODE = "live_assisted"
$env:DS160_LIVE_SUBMISSION_ENABLED = "true"
$env:DS160_LIVE_ASSISTED_ONLY = "true"
$env:DS160_REQUIRE_FINAL_USER_CONFIRMATION = "true"
$env:DS160_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS = "true"
$env:CEAC_BROWSERBASE_ENABLED = "true"
$env:CEAC_BROWSERBASE_PROXIES = "true"
$env:CEAC_BROWSERBASE_REGION = "us-east-1"
$env:CEAC_BROWSERBASE_COUNTRY = "US"
$env:CEAC_BROWSERBASE_TIMEOUT_SECONDS = "900"
$env:BROWSERBASE_MAX_CONCURRENCY = "1"
$env:SUBMISSION_SERVICE_IDLE_EXIT_MS = "120000"
npm run dev
```

The allowlist plus the disabled consumers limits this process to the targeted
`ceac_live` legacy queue row. CEAC closes its Playwright context and browser
and releases its local Browserbase concurrency permit. The current CEAC
bootstrap uses the basic Browserbase connector, so the provider session is
bounded by `CEAC_BROWSERBASE_TIMEOUT_SECONDS` (900 seconds here); it does not
retain the provider session ID for an explicit `REQUEST_RELEASE` call on
normal close. Keep `BROWSERBASE_MAX_CONCURRENCY=1` for this one-shot run.

The CEAC worker still performs captured-resume validation, retrieves the same
official Application ID, applies the official review-diff gate, and uses the
durable final-submission guard before any final click. The normal retry route
and `intent=new_application` must not be used because they supersede the
captured checkpoint and create a different queue/draft.
