import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildStaffQueue,
  type QueueApplicationRow,
  type QueueItem,
  type QueueProfileRow,
  type QueueRunnerJobRow,
  type QueueSubmissionRow,
  type QueueWorkItemRow,
} from "./queue-model";

const APPLICATION_SELECT =
  "id, applicant_id, country, visa_type, purpose, status, external_status, external_reference, result_status, result_notes, submitted_at, created_at, updated_at, qa_archived_at";
const SIGNAL_LIMIT = 500;

function chunk<T>(values: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

export async function loadStaffQueue(options: { includeTest?: boolean } = {}): Promise<{
  items: QueueItem[];
  error: string | null;
}> {
  try {
    const admin = createAdminClient();

    const [statusApps, jobSignals, submissionSignals, workItems, staff] = await Promise.all([
      admin
        .from("applications")
        .select(APPLICATION_SELECT)
        .or("status.in.(staff_action_required,failed,awaiting_applicant),and(status.eq.submitted,external_status.eq.submitted,result_status.is.null)")
        .is("qa_archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(SIGNAL_LIMIT),
      admin
        .from("runner_job")
        .select("application_id")
        .eq("status", "needs_human")
        .order("enqueued_at", { ascending: false })
        .limit(SIGNAL_LIMIT),
      admin
        .from("submission_queue")
        .select("application_id")
        .or("status.like.*_failed,status.like.*_blocked,status.eq.stalled,status.eq.failed,status.like.*_prefilled,status.like.*_official_portal_opened,manual_action_status.in.(pending,required)")
        .order("updated_at", { ascending: false })
        .limit(SIGNAL_LIMIT),
      admin
        .from("admin_work_items")
        .select("id, application_id, kind, title, status, priority, created_at, updated_at")
        .not("application_id", "is", null)
        .in("status", ["open", "in_progress", "waiting_customer", "blocked"])
        .limit(SIGNAL_LIMIT),
      admin.from("users").select("email").is("deleted_at", null),
    ]);

    for (const result of [statusApps, jobSignals, submissionSignals, workItems, staff]) {
      if (result.error) throw new Error(result.error.message);
    }

    const applications = new Map<string, QueueApplicationRow>(
      ((statusApps.data ?? []) as QueueApplicationRow[]).map((row) => [row.id, row]),
    );
    const candidateIds = new Set<string>([
      ...applications.keys(),
      ...((jobSignals.data ?? []) as Array<{ application_id: string | null }>).map((row) => row.application_id ?? ""),
      ...((submissionSignals.data ?? []) as Array<{ application_id: string | null }>).map((row) => row.application_id ?? ""),
      ...((workItems.data ?? []) as QueueWorkItemRow[]).map((row) => row.application_id ?? ""),
    ]);
    candidateIds.delete("");
    const ids = [...candidateIds];

    const missing = ids.filter((id) => !applications.has(id));
    const runnerJobs: QueueRunnerJobRow[] = [];
    const submissions: QueueSubmissionRow[] = [];
    for (const group of chunk(ids)) {
      const [apps, jobs, subs] = await Promise.all([
        missing.length > 0
          ? admin.from("applications").select(APPLICATION_SELECT).in("id", group.filter((id) => !applications.has(id)))
          : Promise.resolve({ data: [], error: null }),
        admin
          .from("runner_job")
          .select("id, application_id, status, last_error, enqueued_at, finished_at")
          .in("application_id", group),
        admin
          .from("submission_queue")
          .select("id, application_id, status, manual_action_status, error_code, error_message, last_error, created_at, updated_at")
          .in("application_id", group)
          .neq("status", "retry_superseded"),
      ]);
      for (const result of [apps, jobs, subs]) {
        if (result.error) throw new Error(result.error.message);
      }
      for (const row of (apps.data ?? []) as QueueApplicationRow[]) applications.set(row.id, row);
      runnerJobs.push(...((jobs.data ?? []) as QueueRunnerJobRow[]));
      submissions.push(...((subs.data ?? []) as QueueSubmissionRow[]));
    }

    const applicantIds = [...new Set([...applications.values()].map((row) => row.applicant_id).filter(Boolean))];
    const profiles: QueueProfileRow[] = [];
    for (const group of chunk(applicantIds)) {
      const { data, error } = await admin.from("applicant_profiles").select("id, full_name, email").in("id", group);
      if (error) throw new Error(error.message);
      profiles.push(...((data ?? []) as QueueProfileRow[]));
    }

    const items = buildStaffQueue(
      {
        applications: [...applications.values()],
        profiles,
        staffEmails: ((staff.data ?? []) as Array<{ email: string | null }>).map((row) => row.email ?? ""),
        runnerJobs,
        submissions,
        workItems: (workItems.data ?? []) as QueueWorkItemRow[],
      },
      options,
    );
    return { items, error: null };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : "Failed to load the staff queue" };
  }
}
