import { describe, expect, it } from "vitest";
import {
  hasActiveVietnamRun,
  hasVietnamOfficialSubmission,
  isOpenSiblingApplication,
  startNewVietnamApplication,
  type VietnamSourceApplication,
} from "./vietnam";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Minimal in-memory stand-in for the Supabase admin client used by vietnam.ts. */
function fakeAdmin(tables: Tables, options: { failInsertInto?: string; rpcOutcome?: string } = {}) {
  const rpcCalls: { name: string; args: unknown }[] = [];
  let nextId = 1;
  const from = (table: string) => {
    let op: "select" | "update" | "insert" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let returnRows = false;
    const filters: ((row: Row) => boolean)[] = [];
    const run = () => {
      const rows = (tables[table] ??= []);
      if (op === "insert") {
        if (options.failInsertInto === table) return { data: null, error: { message: "insert failed" } };
        const inserted = (Array.isArray(payload) ? payload : [payload as Row]).map((row) => ({
          id: row.id ?? `new-${nextId++}`,
          ...row,
        }));
        rows.push(...inserted);
        return { data: inserted, error: null };
      }
      const matched = rows.filter((row) => filters.every((filter) => filter(row)));
      if (op === "update") {
        matched.forEach((row) => Object.assign(row, payload));
        return { data: returnRows ? matched.map((row) => ({ id: row.id })) : null, error: null };
      }
      if (op === "delete") {
        tables[table] = rows.filter((row) => !matched.includes(row));
        // Mirror the 0211 restore trigger: deleting a draft restores what it superseded.
        if (table === "applications") {
          for (const removed of matched) {
            for (const older of tables.applications) {
              if (older.superseded_by_application_id === removed.id) {
                older.status = older.superseded_previous_status;
                older.superseded_by_application_id = null;
                older.superseded_previous_status = null;
              }
            }
          }
        }
        return { data: null, error: null };
      }
      return { data: matched, error: null };
    };
    const builder = {
      select: () => {
        if (op !== "select") returnRows = true;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      update: (value: Row) => {
        op = "update";
        payload = value;
        return builder;
      },
      insert: (value: Row | Row[]) => {
        op = "insert";
        payload = value;
        return builder;
      },
      delete: () => {
        op = "delete";
        return builder;
      },
      single: async () => {
        const result = run();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { data, error: result.error };
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  };
  const admin = {
    from,
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      for (const session of tables.takeover_session ?? []) session.status = "cancelled";
      return { data: [{ outcome: options.rpcOutcome ?? "cancelled" }], error: null };
    },
  };
  return { admin: admin as unknown as Parameters<typeof startNewVietnamApplication>[0], rpcCalls };
}

const SOURCE: VietnamSourceApplication = {
  id: "app-1",
  applicant_id: "applicant-1",
  country: "vietnam",
  visa_type: "VN_E_VISA",
  visa_package_id: "pkg-1",
  status: "action_required",
  submission_result: null,
};

function baseTables(overrides: Partial<Tables> = {}): Tables {
  return {
    applications: [{ ...SOURCE }],
    submission_queue: [{ application_id: "app-1", status: "vn_live_assisted_failed", official_status: "official_portal_error" }],
    visa_application_answers: [
      { application_id: "app-1", field_name: "surname", value_text: "RAN", value_json: null },
      { application_id: "app-1", field_name: "date_of_birth", value_text: "2006-05-23", value_json: null },
    ],
    application_documents: [
      { application_id: "app-1", document_type: "passport_copy", storage_path: "a/passport.jpg", filename: "passport.jpg", status: "uploaded", rejection_reason: null },
    ],
    takeover_session: [],
    ...overrides,
  };
}

describe("Vietnam new-application rules", () => {
  it("treats queued or running VIZA work as active", () => {
    expect(hasActiveVietnamRun([{ status: "vn_cloud_live_pending" }])).toBe(true);
    expect(hasActiveVietnamRun([{ status: "vn_live_assisted_processing" }])).toBe(true);
    expect(hasActiveVietnamRun([{ status: "vn_live_assisted_failed" }, { status: "retry_superseded" }])).toBe(false);
  });

  it("recognises an application that already reached the official site", () => {
    expect(hasVietnamOfficialSubmission({ submission_result: { registrationCode: "E123456ABCDEFGH" } }, [])).toBe(true);
    expect(hasVietnamOfficialSubmission({ submission_result: { status: "stopped_at_pay" } }, [])).toBe(true);
    expect(hasVietnamOfficialSubmission({ submission_result: { submittedBy: "applicant_on_official_portal" } }, [])).toBe(true);
    expect(hasVietnamOfficialSubmission({ submission_result: null }, [{ official_status: "registration_code_captured_payment_pending" }])).toBe(true);
    expect(hasVietnamOfficialSubmission({ submission_result: { status: "official_portal_error" } }, [{ official_status: "official_portal_error" }])).toBe(false);
  });
});

describe("startNewVietnamApplication", () => {
  it("copies answers and documents into a new draft and archives the old application", async () => {
    const tables = baseTables();
    const { admin } = fakeAdmin(tables);
    const result = await startNewVietnamApplication(admin, SOURCE);

    expect(result.status).toBe(201);
    const newId = "applicationId" in result ? result.applicationId : "";
    const old = tables.applications.find((row) => row.id === "app-1");
    expect(old).toMatchObject({ status: "archived", superseded_previous_status: "action_required", superseded_by_application_id: newId });
    expect(tables.applications.find((row) => row.id === newId)).toMatchObject({ status: "draft", applicant_id: "applicant-1", visa_package_id: "pkg-1" });
    expect(tables.visa_application_answers.filter((row) => row.application_id === newId)).toHaveLength(2);
    expect(tables.application_documents.filter((row) => row.application_id === newId)).toHaveLength(1);
  });

  it("refuses while VIZA is still working on the application", async () => {
    const tables = baseTables({ submission_queue: [{ application_id: "app-1", status: "vn_live_assisted_processing" }] });
    const { admin } = fakeAdmin(tables);
    const result = await startNewVietnamApplication(admin, SOURCE);
    expect(result).toMatchObject({ status: 409, code: "submission_in_progress" });
    expect(tables.applications).toHaveLength(1);
    expect(tables.applications[0].status).toBe("action_required");
  });

  it("asks for confirmation when the old attempt reached the official site, then proceeds", async () => {
    const tables = baseTables({
      submission_queue: [{ application_id: "app-1", status: "vn_blocked", official_status: "registration_code_captured_payment_pending" }],
    });
    const { admin } = fakeAdmin(tables);
    const first = await startNewVietnamApplication(admin, SOURCE);
    expect(first).toMatchObject({ status: 409, code: "official_submission_exists" });
    expect(tables.applications).toHaveLength(1);

    const confirmed = await startNewVietnamApplication(admin, SOURCE, { confirmOfficialDuplicate: true });
    expect(confirmed.status).toBe(201);
  });

  it("closes an open official handoff before archiving", async () => {
    const tables = baseTables({
      takeover_session: [{ application_id: "app-1", handoff_kind: "official_applicant_final_submit", status: "claimed", id: "t-1" }],
      submission_queue: [{ application_id: "app-1", status: "vn_applicant_handoff", official_status: "processing" }],
    });
    const { admin, rpcCalls } = fakeAdmin(tables);
    const result = await startNewVietnamApplication(admin, SOURCE);
    expect(result.status).toBe(201);
    expect(rpcCalls).toEqual([
      { name: "cancel_official_applicant_submission", args: { p_application_id: "app-1", p_applicant_id: "applicant-1" } },
    ]);
  });

  it("does not archive when the handoff cancel says a run is still in progress", async () => {
    const tables = baseTables({
      takeover_session: [{ application_id: "app-1", handoff_kind: "official_applicant_final_submit", status: "queued", id: "t-1" }],
    });
    const { admin } = fakeAdmin(tables, { rpcOutcome: "cancel_requested" });
    const result = await startNewVietnamApplication(admin, SOURCE);
    expect(result).toMatchObject({ status: 409, code: "submission_in_progress" });
    expect(tables.applications[0].status).toBe("action_required");
  });

  it("fails without changes when the application changed concurrently", async () => {
    const tables = baseTables();
    tables.applications[0].status = "draft";
    const { admin } = fakeAdmin(tables);
    const result = await startNewVietnamApplication(admin, SOURCE);
    expect(result).toMatchObject({ status: 409, code: "source_changed" });
    expect(tables.applications).toHaveLength(1);
  });

  it("restores the old application when copying the documents fails", async () => {
    const tables = baseTables();
    const { admin } = fakeAdmin(tables, { failInsertInto: "application_documents" });
    const result = await startNewVietnamApplication(admin, SOURCE);
    expect(result).toMatchObject({ status: 500, code: "copy_failed" });
    expect(tables.applications).toHaveLength(1);
    expect(tables.applications[0]).toMatchObject({ id: "app-1", status: "action_required", superseded_by_application_id: null });
    expect(tables.visa_application_answers.every((row) => row.application_id === "app-1")).toBe(true);
  });

  it("refuses an application with no saved answers", async () => {
    const tables = baseTables({ visa_application_answers: [] });
    const { admin } = fakeAdmin(tables);
    expect(await startNewVietnamApplication(admin, SOURCE)).toMatchObject({ status: 409, code: "no_answers" });
  });

  it("archives another open draft of the same product so the new draft is allowed", async () => {
    const tables = baseTables();
    tables.applications.push(
      { id: "draft-2", applicant_id: "applicant-1", country: "vietnam", visa_type: "VN_E_VISA", status: "draft", purpose: null, submission_result_status: null },
      { id: "other-country", applicant_id: "applicant-1", country: "indonesia", visa_type: "C1", status: "draft", purpose: null, submission_result_status: null },
    );
    const { admin } = fakeAdmin(tables);
    const result = await startNewVietnamApplication(admin, SOURCE);

    expect(result.status).toBe(201);
    const newId = "applicationId" in result ? result.applicationId : "";
    expect(tables.applications.find((row) => row.id === "draft-2")).toMatchObject({
      status: "archived",
      superseded_previous_status: "draft",
      superseded_by_application_id: newId,
    });
    expect(tables.applications.find((row) => row.id === "other-country")?.status).toBe("draft");
  });

  it("refuses when VIZA is working on another open application of the same product", async () => {
    const tables = baseTables();
    tables.applications.push({ id: "draft-2", applicant_id: "applicant-1", country: "vietnam", visa_type: "VN_E_VISA", status: "processing", purpose: null, submission_result_status: null });
    tables.submission_queue.push({ application_id: "draft-2", status: "vn_cloud_live_pending" });
    const { admin } = fakeAdmin(tables);
    expect(await startNewVietnamApplication(admin, SOURCE)).toMatchObject({ status: 409, code: "submission_in_progress" });
    expect(tables.applications.map((row) => row.status)).toEqual(["action_required", "processing"]);
  });

  it("restores the other open draft too when the copy fails", async () => {
    const tables = baseTables();
    tables.applications.push({ id: "draft-2", applicant_id: "applicant-1", country: "vietnam", visa_type: "VN_E_VISA", status: "draft", purpose: null, submission_result_status: null });
    const { admin } = fakeAdmin(tables, { failInsertInto: "visa_application_answers" });
    expect(await startNewVietnamApplication(admin, SOURCE)).toMatchObject({ status: 500, code: "copy_failed" });
    expect(tables.applications.map((row) => [row.id, row.status])).toEqual([["app-1", "action_required"], ["draft-2", "draft"]]);
  });
});

describe("isOpenSiblingApplication", () => {
  const source = { id: "app-1", country: "vietnam", visa_type: "VN_E_VISA" };
  const row = { id: "x", country: "Vietnam", visa_type: "vn_e_visa", status: "draft", purpose: null, submission_result_status: null };
  it("matches only open rows of the same product, like the ongoing index", () => {
    expect(isOpenSiblingApplication(source, row)).toBe(true);
    expect(isOpenSiblingApplication(source, { ...row, id: "app-1" })).toBe(false);
    expect(isOpenSiblingApplication(source, { ...row, status: "archived" })).toBe(false);
    expect(isOpenSiblingApplication(source, { ...row, submission_result_status: "submitted" })).toBe(false);
    expect(isOpenSiblingApplication(source, { ...row, purpose: "VIZA_PLACEHOLDER_DRY_RUN" })).toBe(false);
    expect(isOpenSiblingApplication(source, { ...row, visa_type: "evisa_tourism" })).toBe(false);
  });
});

