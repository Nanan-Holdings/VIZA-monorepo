import { describe, expect, it } from "vitest";
import {
  buildStaffQueue,
  isAwaitingStaffSubmission,
  isFailedSubmissionStatus,
  type QueueApplicationRow,
  type QueueSourceData,
} from "./queue-model";

function app(id: string, overrides: Partial<QueueApplicationRow> = {}): QueueApplicationRow {
  return {
    id,
    applicant_id: `p-${id}`,
    country: "japan",
    visa_type: "TOURIST",
    purpose: null,
    status: "draft",
    external_status: null,
    external_reference: null,
    result_status: null,
    result_notes: null,
    submitted_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    qa_archived_at: null,
    ...overrides,
  };
}

function data(overrides: Partial<QueueSourceData>): QueueSourceData {
  return { applications: [], profiles: [], staffEmails: [], runnerJobs: [], submissions: [], workItems: [], ...overrides };
}

describe("submission status classification", () => {
  it("treats failed, blocked and stalled as failed but not dry runs or superseded retries", () => {
    expect(isFailedSubmissionStatus("vn_live_assisted_failed")).toBe(true);
    expect(isFailedSubmissionStatus("ds160_blocked")).toBe(true);
    expect(isFailedSubmissionStatus("stalled")).toBe(true);
    expect(isFailedSubmissionStatus("tw_dry_run_failed")).toBe(false);
    expect(isFailedSubmissionStatus("retry_superseded")).toBe(false);
    expect(isFailedSubmissionStatus("done")).toBe(false);
  });

  it("treats prefilled rows and pending manual actions as waiting for staff", () => {
    expect(isAwaitingStaffSubmission({ status: "uk_prefilled", manual_action_status: null })).toBe(true);
    expect(isAwaitingStaffSubmission({ status: "pending", manual_action_status: "pending" })).toBe(true);
    expect(isAwaitingStaffSubmission({ status: "done", manual_action_status: "completed" })).toBe(false);
  });
});

describe("buildStaffQueue", () => {
  it("merges every source into one list, newest signal first", () => {
    const items = buildStaffQueue(data({
      applications: [
        app("a1", { status: "staff_action_required", updated_at: "2026-10-19T01:00:00Z" }),
        app("a2"),
        app("a3"),
        app("a4"),
        app("a5", { status: "submitted", external_status: "submitted", external_reference: "REF", submitted_at: "2026-10-10T00:00:00Z" }),
      ],
      runnerJobs: [
        { id: "j1", application_id: "a2", status: "failed", last_error: null, enqueued_at: "2026-10-10T00:00:00Z", finished_at: null },
        { id: "j2", application_id: "a2", status: "needs_human", last_error: "CAPTCHA", enqueued_at: "2026-10-18T00:00:00Z", finished_at: "2026-10-18T02:00:00Z" },
      ],
      submissions: [
        { id: "s1", application_id: "a3", status: "vn_live_assisted_failed", manual_action_status: null, error_code: "x", error_message: "Passenger controls not matched", last_error: null, created_at: "2026-10-17T00:00:00Z", updated_at: "2026-10-17T00:00:00Z" },
      ],
      workItems: [
        { id: "w1", application_id: "a4", kind: "submission_action_required", title: "Manual JP", status: "open", priority: "p1", created_at: "2026-10-16T00:00:00Z", updated_at: null },
      ],
    }));
    expect(items.map((item) => item.applicationId)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(items[1].signals[0]).toMatchObject({ reason: "runner_needs_human", detail: "CAPTCHA" });
    expect(items[2].signals[0].reason).toBe("submission_failed");
    expect(items[3].signals[0].reason).toBe("work_item");
    expect(items[4]).toMatchObject({ needsAction: false, signals: [{ reason: "awaiting_decision", detail: "REF" }] });
    expect(items.slice(0, 4).every((item) => item.needsAction)).toBe(true);
  });

  it("only counts the latest runner job and the latest live submission row", () => {
    const items = buildStaffQueue(data({
      applications: [app("a1"), app("a2")],
      runnerJobs: [
        { id: "j1", application_id: "a1", status: "needs_human", last_error: null, enqueued_at: "2026-10-01T00:00:00Z", finished_at: null },
        { id: "j2", application_id: "a1", status: "succeeded", last_error: null, enqueued_at: "2026-10-02T00:00:00Z", finished_at: null },
      ],
      submissions: [
        { id: "s1", application_id: "a2", status: "ds160_proof_failed", manual_action_status: null, error_code: null, error_message: null, last_error: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
        { id: "s2", application_id: "a2", status: "done", manual_action_status: null, error_code: null, error_message: null, last_error: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
        { id: "s3", application_id: "a2", status: "retry_superseded", manual_action_status: null, error_code: null, error_message: null, last_error: null, created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" },
      ],
    }));
    expect(items).toEqual([]);
  });

  it("drops stale automation failures once staff recorded an outcome", () => {
    const items = buildStaffQueue(data({
      applications: [app("a1", { status: "approved", result_status: "approved" })],
      runnerJobs: [{ id: "j1", application_id: "a1", status: "needs_human", last_error: null, enqueued_at: "2026-10-01T00:00:00Z", finished_at: null }],
    }));
    expect(items).toEqual([]);
  });

  it("hides QA, staff and archived test data unless asked", () => {
    const source = data({
      applications: [
        app("qa", { status: "staff_action_required" }),
        app("staff", { status: "staff_action_required" }),
        app("dry", { status: "staff_action_required", purpose: "VIZA_PLACEHOLDER_DRY_RUN" }),
        app("arch", { status: "archived", qa_archived_at: "2026-10-19T00:00:00Z" }),
        app("real", { status: "staff_action_required" }),
      ],
      profiles: [
        { id: "p-qa", full_name: "QA", email: "qa+1@viza.test" },
        { id: "p-staff", full_name: "Staff", email: "Ops@Viza.it.com" },
        { id: "p-real", full_name: "Real", email: "edward.zehua.zhang+vizatest@gmail.com" },
      ],
      staffEmails: ["ops@viza.it.com"],
    });
    expect(buildStaffQueue(source).map((item) => item.applicationId)).toEqual(["real"]);
    const withTest = buildStaffQueue(source, { includeTest: true });
    expect(withTest.map((item) => item.applicationId).sort()).toEqual(["dry", "qa", "real", "staff"]);
    expect(withTest.find((item) => item.applicationId === "qa")?.isTest).toBe(true);
  });
});
