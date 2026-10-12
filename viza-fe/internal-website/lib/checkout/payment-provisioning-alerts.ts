import type { SupabaseClient } from "@supabase/supabase-js";

export const PAYMENT_PROVISIONING_STALE_AFTER_MS = 15 * 60_000;

type ProvisioningAlertStatus =
  | "queued"
  | "running"
  | "retry"
  | "succeeded"
  | "dead_letter";

export interface ProvisioningAlertJob {
  id: string;
  order_id: string;
  provider: string;
  status: ProvisioningAlertStatus;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface ProvisioningAlertSignal {
  reason: "dead_letter" | "stale_queued" | "stale_retry" | "stale_running";
  priority: "p0" | "p1";
  ageMs: number;
}

interface ProvisioningAlertWorkItem {
  id: string;
  source_id: string | null;
  status: "open" | "in_progress" | "waiting_customer" | "blocked" | "resolved" | "cancelled";
  priority: "p0" | "p1" | "p2" | "p3";
  metadata_redacted: Record<string, unknown> | null;
}

interface WorkItemCreate {
  order_id: string;
  source_type: "payment_provisioning_jobs";
  source_id: string;
  dedupe_key: string;
  kind: "payment_provisioning_alert";
  title: string;
  description: string;
  status: "open";
  priority: "p0" | "p1";
  owning_team: "operations";
  due_at: string;
  checklist: Array<{ label: string; completed: false }>;
  metadata_redacted: Record<string, unknown>;
}

interface WorkItemUpdate {
  status?: "open" | "resolved";
  priority?: "p0" | "p1";
  title?: string;
  due_at?: string;
  metadata_redacted?: Record<string, unknown>;
  resolution_code?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  updated_at: string;
}

export interface ProvisioningAlertRepository {
  listJobs(): Promise<ProvisioningAlertJob[]>;
  listWorkItems(): Promise<ProvisioningAlertWorkItem[]>;
  createWorkItem(input: WorkItemCreate): Promise<"created" | "exists">;
  updateWorkItem(id: string, patch: WorkItemUpdate): Promise<void>;
}

export interface PaymentProvisioningAlertSweepResult {
  opened: number;
  reopened: number;
  escalated: number;
  resolved: number;
}

const ACTIVE_WORK_ITEM_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_customer",
  "blocked",
]);

export function classifyProvisioningAlert(
  job: ProvisioningAlertJob,
  nowMs: number,
  staleAfterMs = PAYMENT_PROVISIONING_STALE_AFTER_MS,
): ProvisioningAlertSignal | null {
  if (job.status === "dead_letter") {
    return { reason: "dead_letter", priority: "p0", ageMs: Math.max(0, nowMs - Date.parse(job.created_at)) };
  }
  if (job.status !== "queued" && job.status !== "retry" && job.status !== "running") return null;

  const createdAtMs = Date.parse(job.created_at);
  if (!Number.isFinite(createdAtMs)) return null;
  const ageMs = Math.max(0, nowMs - createdAtMs);
  if (ageMs < staleAfterMs) return null;
  return {
    reason: job.status === "queued"
      ? "stale_queued"
      : job.status === "retry"
        ? "stale_retry"
        : "stale_running",
    priority: "p1",
    ageMs,
  };
}

function alertMetadata(
  job: ProvisioningAlertJob,
  signal: ProvisioningAlertSignal,
  nowIso: string,
): Record<string, unknown> {
  return {
    alert_active: true,
    alert_reason: signal.reason,
    observed_status: job.status,
    provider: job.provider,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    job_created_at: job.created_at,
    job_updated_at: job.updated_at,
    observed_at: nowIso,
  };
}

function alertTitle(signal: ProvisioningAlertSignal): string {
  return signal.reason === "dead_letter"
    ? "Payment provisioning reached dead letter"
    : "Payment provisioning is overdue";
}

export async function reconcilePaymentProvisioningAlerts(
  repository: ProvisioningAlertRepository,
  options: { now?: Date; staleAfterMs?: number } = {},
): Promise<PaymentProvisioningAlertSweepResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const staleAfterMs = options.staleAfterMs ?? PAYMENT_PROVISIONING_STALE_AFTER_MS;
  const [jobs, workItems] = await Promise.all([
    repository.listJobs(),
    repository.listWorkItems(),
  ]);
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const workItemsByJobId = new Map(
    workItems.filter((item) => item.source_id).map((item) => [item.source_id as string, item]),
  );
  const result: PaymentProvisioningAlertSweepResult = {
    opened: 0,
    reopened: 0,
    escalated: 0,
    resolved: 0,
  };

  for (const job of jobs) {
    const signal = classifyProvisioningAlert(job, nowMs, staleAfterMs);
    if (!signal) continue;
    const existing = workItemsByJobId.get(job.id);
    const metadata = alertMetadata(job, signal, nowIso);
    if (!existing) {
      const created = await repository.createWorkItem({
        order_id: job.order_id,
        source_type: "payment_provisioning_jobs",
        source_id: job.id,
        dedupe_key: `payment-provisioning-alert:${job.id}`,
        kind: "payment_provisioning_alert",
        title: alertTitle(signal),
        description: "Restore applicant portal provisioning and verify account, application, inbox, and payment-linked access.",
        status: "open",
        priority: signal.priority,
        owning_team: "operations",
        due_at: signal.priority === "p0"
          ? nowIso
          : new Date(nowMs + 60 * 60_000).toISOString(),
        checklist: [
          { label: "Inspect the provisioning job and its last completed step", completed: false },
          { label: "Retry or repair provisioning without duplicating payment or access", completed: false },
          { label: "Confirm the applicant can sign in and access the application", completed: false },
        ],
        metadata_redacted: metadata,
      });
      if (created === "created") result.opened += 1;
      continue;
    }
    if (existing.status === "resolved") {
      await repository.updateWorkItem(existing.id, {
        status: "open",
        priority: signal.priority,
        title: alertTitle(signal),
        due_at: signal.priority === "p0"
          ? nowIso
          : new Date(nowMs + 60 * 60_000).toISOString(),
        metadata_redacted: metadata,
        resolution_code: null,
        resolution_notes: null,
        resolved_at: null,
        updated_at: nowIso,
      });
      result.reopened += 1;
      continue;
    }
    if (existing.status !== "cancelled" && signal.priority === "p0" && existing.priority !== "p0") {
      await repository.updateWorkItem(existing.id, {
        priority: "p0",
        title: alertTitle(signal),
        due_at: nowIso,
        metadata_redacted: metadata,
        updated_at: nowIso,
      });
      result.escalated += 1;
    }
  }

  for (const workItem of workItems) {
    if (!workItem.source_id || !ACTIVE_WORK_ITEM_STATUSES.has(workItem.status)) continue;
    const job = jobsById.get(workItem.source_id);
    if (job && classifyProvisioningAlert(job, nowMs, staleAfterMs)) continue;
    await repository.updateWorkItem(workItem.id, {
      status: "resolved",
      metadata_redacted: {
        ...(workItem.metadata_redacted ?? {}),
        alert_active: false,
        recovered_status: job?.status ?? "job_removed",
        recovered_at: nowIso,
      },
      resolution_code: "provisioning_recovered",
      resolution_notes: "Automatically resolved after the durable provisioning job recovered.",
      resolved_at: nowIso,
      updated_at: nowIso,
    });
    result.resolved += 1;
  }

  return result;
}

function supabaseRepository(admin: SupabaseClient): ProvisioningAlertRepository {
  return {
    async listJobs() {
      const { data, error } = await admin
        .from("payment_provisioning_jobs")
        .select("id, order_id, provider, status, attempts, max_attempts, created_at, updated_at");
      if (error) throw new Error(`payment provisioning alert jobs: ${error.message}`);
      return (data ?? []) as ProvisioningAlertJob[];
    },
    async listWorkItems() {
      const { data, error } = await admin
        .from("admin_work_items")
        .select("id, source_id, status, priority, metadata_redacted")
        .eq("source_type", "payment_provisioning_jobs")
        .eq("kind", "payment_provisioning_alert");
      if (error) throw new Error(`payment provisioning alert work items: ${error.message}`);
      return (data ?? []) as ProvisioningAlertWorkItem[];
    },
    async createWorkItem(input) {
      const { error } = await admin.from("admin_work_items").insert(input);
      if (!error) return "created";
      if (error.code === "23505") return "exists";
      throw new Error(`payment provisioning alert create: ${error.message}`);
    },
    async updateWorkItem(id, patch) {
      const { error } = await admin.from("admin_work_items").update(patch).eq("id", id);
      if (error) throw new Error(`payment provisioning alert update: ${error.message}`);
    },
  };
}

export function runPaymentProvisioningAlertSweep(
  admin: SupabaseClient,
  options?: { now?: Date; staleAfterMs?: number },
): Promise<PaymentProvisioningAlertSweepResult> {
  return reconcilePaymentProvisioningAlerts(supabaseRepository(admin), options);
}
