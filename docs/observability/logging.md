# Structured Run Logging (OBSV-003)

Every runner_job run is traceable end-to-end by `correlation_id`:

1. Portal producer (`viza-fe/internal-website/lib/queue/enqueue.ts`) sets
   `correlation_id` on the job (e.g. `card:<orderId>`, `wechat:<orderId>`).
2. The worker claims the row (carries `correlation_id`).
3. The handler (`src/queue/handler.ts`) logs every line as
   `[queue] cid=<correlation_id> job=<id8> country=<c> ...` across dispatch →
   runOne → outcome/throw, and emits `runner_job_event` (OBSV-001).

Grep a full run: `cid=card:<orderId>`. The correlation id ties portal payment →
queue → runner outcome in one searchable key.
