import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const {
  createAdminClient,
  getClientSessionReadResult,
  loadLiveSubmissionSummaries,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionReadResult: vi.fn(),
  loadLiveSubmissionSummaries: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/client-session", () => ({ getClientSessionReadResult }));
vi.mock("@/lib/submission-live-status", () => ({ loadLiveSubmissionSummaries }));
vi.mock("@/lib/applications/qa-safety", () => ({
  isQaDryRunPurpose: (purpose: string | null) => purpose === "VIZA_PLACEHOLDER_DRY_RUN",
}));
vi.mock("@/lib/submission-result-evidence", () => ({
  getAutomatedOnlineSubmissionEvidence: () => ({
    submitted: false,
    approved: false,
    reference: null,
    pdfPaths: [],
    qrPaths: [],
  }),
  isAutomatedOnlineVisaType: () => false,
}));
vi.mock("@/lib/client/recent-application-form", () => ({
  buildApplicationLongFormHref: ({ applicationId }: { applicationId: string | null }) =>
    `/client/application?applicationId=${applicationId ?? ""}`,
}));
vi.mock("@/lib/visa-destinations", () => ({
  getCanonicalApplicationProductCountry: (country: string) => country,
  getDestinationDisplayName: (country: string) => country,
  getDestinationDisplayNameZh: (country: string) => `${country}-zh`,
  getDestinationFlag: (country: string) => country,
  getFormVisaType: (visaType: string) => visaType,
  getVisaDestinationKey: (country: string, visaType: string) => `${country}:${visaType}`,
  getVisaTypeDisplayName: (visaType: string) => visaType,
  getVisaTypeDisplayNameZh: (visaType: string) => `${visaType}-zh`,
}));

import {
  getClientStatusIndexData,
  getClientStatusData,
  type ClientStatusData,
} from "./status-data";
import { isOngoingApplicationState } from "@/lib/client/active-application-selection";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_PROFILE_ID = "99999999-9999-4999-8999-999999999999";
const PROFILE_APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const LINKED_APPLICATION_ID = "33333333-3333-4333-8333-333333333333";
const SGAC_APPLICATION_ID = "44444444-4444-4444-8444-444444444444";
const PACKAGE_ID = "55555555-5555-4555-8555-555555555555";
const PACKAGE_ONLY_ID = "66666666-6666-4666-8666-666666666666";
const FOREIGN_APPLICATION_ID = "77777777-7777-4777-8777-777777777777";
const NORMAL_APPLICATION_ID = "88888888-8888-4888-8888-888888888888";
const NORMAL_PACKAGE_ID = "99999999-9999-4999-8999-999999999999";
const APPROVED_APPLICATION_ID = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const APPROVED_PACKAGE_ID = "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const REJECTED_APPLICATION_ID = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const REJECTED_PACKAGE_ID = "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const QA_APPLICATION_ID = "ccccccc1-cccc-4ccc-8ccc-ccccccccccc1";
const STORAGE_APPLICATION_ID = "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1";
const STORAGE_SECOND_APPLICATION_ID = "ddddddd2-dddd-4ddd-8ddd-ddddddddddd2";
const STORAGE_ABSOLUTE_APPLICATION_ID = "ddddddd3-dddd-4ddd-8ddd-ddddddddddd3";
const STORAGE_VIETNAM_APPLICATION_ID = "ddddddd4-dddd-4ddd-8ddd-ddddddddddd4";
const STORAGE_FOREIGN_APPLICATION_ID = "ddddddd5-dddd-4ddd-8ddd-ddddddddddd5";
const STORAGE_PACKAGE_ID = "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1";
const STORAGE_SECOND_PACKAGE_ID = "eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2";
const STORAGE_ABSOLUTE_PACKAGE_ID = "eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3";
const STORAGE_VIETNAM_PACKAGE_ID = "eeeeeee4-eeee-4eee-8eee-eeeeeeeeeee4";

type Row = Record<string, unknown>;
type TableRows = Record<string, Row[]>;
type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "in"; column: string; values: readonly unknown[] }
  | { kind: "or"; expression: string };

interface QueryCall {
  table: string;
  filters: Filter[];
}

interface FakeAdmin {
  client: SupabaseClient;
  calls: QueryCall[];
  storageSignatures: Array<{ bucket: string; path: string; expiresIn: number }>;
  storageBatches: Array<{ bucket: string; paths: string[]; expiresIn: number }>;
  storageSingleCalls: Array<{ bucket: string; path: string; expiresIn: number }>;
}

interface FakeAdminOptions {
  failedTables?: ReadonlySet<string>;
  failedStorageBuckets?: ReadonlySet<string>;
  failedStorageTargets?: ReadonlySet<string>;
}

function applicationRow(overrides: Row): Row {
  return {
    id: PROFILE_APPLICATION_ID,
    applicant_id: PROFILE_ID,
    country: "singapore",
    visa_type: "SG_ARRIVAL_CARD",
    purpose: null,
    status: "draft",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    submitted_at: null,
    confirmation_number: null,
    receipt_url: null,
    visa_package_id: PACKAGE_ID,
    packet_status: null,
    packet_storage_path: null,
    packet_ready_at: null,
    external_status: null,
    external_reference: null,
    external_status_updated_at: null,
    result_status: null,
    result_storage_path: null,
    submission_result: null,
    submission_result_status: null,
    submission_result_updated_at: null,
    government_fee_cents: null,
    government_fee_currency: null,
    government_fee_mode: null,
    official_fee_status: null,
    official_fee_quote_id: null,
    official_fee_payment_intent_id: null,
    official_fee_receipt_id: null,
    ...overrides,
  };
}

function visaPackageRow(
  packageId: string,
  country = "singapore",
  visaType = "SG_ARRIVAL_CARD",
): Row {
  return {
    id: packageId,
    country,
    visa_type: visaType,
    name: `${country} package`,
    description: null,
    price_cents: 10000,
    currency: "USD",
    metadata: null,
  };
}

function userPackageRow(
  packageId: string,
  applicationId: string | null,
  country = "singapore",
  visaType = "SG_ARRIVAL_CARD",
): Row {
  return {
    auth_user_id: AUTH_USER_ID,
    visa_package_id: packageId,
    application_id: applicationId,
    assigned_at: "2026-08-31T00:00:00.000Z",
    status: "active",
    visa_packages: visaPackageRow(packageId, country, visaType),
  };
}

function paymentRow(overrides: Row): Row {
  return {
    id: "88888888-8888-4888-8888-888888888888",
    application_id: PROFILE_APPLICATION_ID,
    visa_package_id: PACKAGE_ID,
    status: "paid",
    amount_cents: 10000,
    currency: "USD",
    fee_type: "agency",
    receipt_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    applicant_id: PROFILE_ID,
    ...overrides,
  };
}

function parseOrExpression(expression: string): Array<{ column: string; values: string[] }> {
  const clauses: Array<{ column: string; values: string[] }> = [];
  const pattern = /(?:^|,)(applicant_id|application_id)\.in\.\(([^)]*)\)/g;
  for (const match of expression.matchAll(pattern)) {
    const column = match[1];
    if (!column) continue;
    clauses.push({
      column,
      values: (match[2] ?? "").split(",").filter(Boolean),
    });
  }
  return clauses;
}

function matchesFilters(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter.kind === "eq") return row[filter.column] === filter.value;
    if (filter.kind === "in") return filter.values.includes(row[filter.column]);
    return parseOrExpression(filter.expression).some(({ column, values }) =>
      values.includes(String(row[column] ?? "")),
    );
  });
}

function createFakeAdmin(
  tableRows: TableRows,
  options: FakeAdminOptions = {},
): FakeAdmin {
  const calls: QueryCall[] = [];
  const storageSignatures: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  const storageBatches: Array<{ bucket: string; paths: string[]; expiresIn: number }> = [];
  const storageSingleCalls: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  const failedTables = options.failedTables ?? new Set<string>();
  const failedStorageBuckets = options.failedStorageBuckets ?? new Set<string>();
  const failedStorageTargets = options.failedStorageTargets ?? new Set<string>();
  const admin = {
    from(table: string) {
      const call: QueryCall = { table, filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn((column: string, value: unknown) => {
        call.filters.push({ kind: "eq", column, value });
        return chain;
      });
      chain.in = vi.fn((column: string, values: readonly unknown[]) => {
        call.filters.push({ kind: "in", column, values });
        return chain;
      });
      chain.or = vi.fn((expression: string) => {
        call.filters.push({ kind: "or", expression });
        return chain;
      });
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.then = (
        resolve: (result: { data: Row[]; error: { message: string } | null }) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(failedTables.has(table)
        ? { data: [], error: { message: `synthetic ${table} failure` } }
        : {
            data: (tableRows[table] ?? []).filter((row) => matchesFilters(row, call.filters)),
            error: null,
          }).then(resolve, reject);
      return chain;
    },
    storage: {
      from(bucket: string) {
        const createSignedUrl = vi.fn(async (path: string, expiresIn: number) => {
          storageSingleCalls.push({ bucket, path, expiresIn });
          storageSignatures.push({ bucket, path, expiresIn });
          return {
            data: { signedUrl: `https://signed.example.test/${bucket}/${path}` },
            error: null,
          };
        });
        const createSignedUrls = vi.fn(async (paths: string[], expiresIn: number) => {
          const normalizedPaths = [...paths];
          storageBatches.push({ bucket, paths: normalizedPaths, expiresIn });
          const failed =
            failedStorageBuckets.has(bucket) ||
            normalizedPaths.some((path) => failedStorageTargets.has(`${bucket}/${path}`));
          if (failed) {
            return {
              data: null,
              error: { message: `synthetic storage failure for ${bucket}` },
            };
          }
          for (const path of normalizedPaths) {
            storageSignatures.push({ bucket, path, expiresIn });
          }
          return {
            data: normalizedPaths.map((path) => ({
              path,
              signedUrl: `https://signed.example.test/${bucket}/${path}`,
              error: null,
            })),
            error: null,
          };
        });
        return {
          createSignedUrl,
          createSignedUrls,
        };
      },
    },
  };
  return {
    client: admin as unknown as SupabaseClient,
    calls,
    storageSignatures,
    storageBatches,
    storageSingleCalls,
  };
}

function baseFixture(): TableRows {
  return {
    applicant_profiles: [{
      id: PROFILE_ID,
      email: "owner@example.test",
      auth_user_id: AUTH_USER_ID,
    }],
    user_packages: [userPackageRow(PACKAGE_ID, PROFILE_APPLICATION_ID)],
    applications: [applicationRow({})],
    payment_records: [paymentRow({})],
    consent_events: [],
    application_signatures: [],
    application_documents: [],
    visa_application_answers: [],
    application_packets: [],
    application_events: [],
    notification_events: [],
    official_application_tracking: [],
  };
}

function richFixture(): TableRows {
  return {
    applicant_profiles: [{
      id: PROFILE_ID,
      email: "owner@example.test",
      auth_user_id: AUTH_USER_ID,
    }],
    user_packages: [
      userPackageRow(NORMAL_PACKAGE_ID, NORMAL_APPLICATION_ID, "japan", "JP_TOURIST"),
      userPackageRow(APPROVED_PACKAGE_ID, APPROVED_APPLICATION_ID, "france", "FR_VISIT"),
      userPackageRow(REJECTED_PACKAGE_ID, REJECTED_APPLICATION_ID, "canada", "CA_VISIT"),
      userPackageRow(PACKAGE_ONLY_ID, null, "australia", "AU_VISIT"),
    ],
    applications: [
      applicationRow({
        id: NORMAL_APPLICATION_ID,
        country: "japan",
        visa_type: "JP_TOURIST",
        status: "in_progress",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-03T00:00:00.000Z",
        visa_package_id: NORMAL_PACKAGE_ID,
        receipt_url: "application-documents/receipts/normal-application.pdf",
        packet_status: "ready",
        packet_ready_at: "2026-09-02T12:00:00.000Z",
      }),
      applicationRow({
        id: APPROVED_APPLICATION_ID,
        country: "france",
        visa_type: "FR_VISIT",
        status: "approved",
        result_status: "approved",
        result_storage_path: "application-results/approved.pdf",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-06T00:00:00.000Z",
        visa_package_id: APPROVED_PACKAGE_ID,
      }),
      applicationRow({
        id: REJECTED_APPLICATION_ID,
        country: "canada",
        visa_type: "CA_VISIT",
        status: "rejected",
        result_status: "rejected",
        result_storage_path: "application-results/rejected.pdf",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-05T00:00:00.000Z",
        visa_package_id: REJECTED_PACKAGE_ID,
      }),
      applicationRow({
        id: SGAC_APPLICATION_ID,
        // Profile ownership keeps this legacy PDF-only artifact visible; the
        // separate scoped-loader case above covers email-linked ownership.
        applicant_id: PROFILE_ID,
        country: "singapore",
        visa_type: "SG_ARRIVAL_CARD",
        status: "draft",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-04T00:00:00.000Z",
        submission_result: {
          confirmationPdfStoragePath: "submission-artifacts/sgac/confirmation.pdf",
        },
      }),
      applicationRow({
        id: FOREIGN_APPLICATION_ID,
        applicant_id: OTHER_PROFILE_ID,
        country: "germany",
        visa_type: "DE_VISIT",
        status: "draft",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-02T00:00:00.000Z",
      }),
      applicationRow({
        id: QA_APPLICATION_ID,
        purpose: "VIZA_PLACEHOLDER_DRY_RUN",
        country: "italy",
        visa_type: "IT_VISIT",
        status: "draft",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-02T00:00:00.000Z",
        visa_package_id: null,
      }),
    ],
    payment_records: [
      paymentRow({
        id: "normal-payment",
        application_id: NORMAL_APPLICATION_ID,
        visa_package_id: NORMAL_PACKAGE_ID,
        status: "paid",
        amount_cents: 12000,
        receipt_url: "application-documents/receipts/normal-payment.pdf",
        updated_at: "2026-09-01T12:00:00.000Z",
      }),
      paymentRow({
        id: "approved-payment",
        application_id: APPROVED_APPLICATION_ID,
        visa_package_id: APPROVED_PACKAGE_ID,
        status: "paid",
      }),
      paymentRow({
        id: "rejected-payment",
        application_id: REJECTED_APPLICATION_ID,
        visa_package_id: REJECTED_PACKAGE_ID,
        status: "paid",
      }),
      paymentRow({
        id: "package-only-payment",
        application_id: null,
        visa_package_id: PACKAGE_ONLY_ID,
        status: "paid",
      }),
    ],
    consent_events: [{
      application_id: NORMAL_APPLICATION_ID,
      accepted: true,
      created_at: "2026-09-01T13:00:00.000Z",
    }],
    application_signatures: [{
      application_id: NORMAL_APPLICATION_ID,
      signed_at: "2026-09-01T13:05:00.000Z",
      created_at: "2026-09-01T13:05:00.000Z",
    }],
    application_documents: [
      { application_id: NORMAL_APPLICATION_ID, status: "validated", required: true },
      { application_id: NORMAL_APPLICATION_ID, status: "uploaded", required: true },
    ],
    visa_application_answers: [
      { application_id: NORMAL_APPLICATION_ID, field_name: "given_name", value_text: "Ada", value_json: null },
      { application_id: NORMAL_APPLICATION_ID, field_name: "passport_number", value_text: "P123", value_json: null },
      { application_id: SGAC_APPLICATION_ID, field_name: "email_address", value_text: "owner@example.test", value_json: null },
    ],
    application_packets: [{
      application_id: NORMAL_APPLICATION_ID,
      status: "ready",
      storage_path: "application-packets/normal.zip",
      generated_at: "2026-09-02T12:00:00.000Z",
      created_at: "2026-09-02T11:00:00.000Z",
      updated_at: "2026-09-02T12:00:00.000Z",
    }],
    application_events: [{
      application_id: NORMAL_APPLICATION_ID,
      event_type: "packet_ready",
      created_at: "2026-09-02T12:00:00.000Z",
    }],
    notification_events: [{
      application_id: NORMAL_APPLICATION_ID,
      status: "sent",
      sent_at: "2026-09-02T12:01:00.000Z",
      created_at: "2026-09-02T12:01:00.000Z",
    }],
    official_application_tracking: [{
      application_id: NORMAL_APPLICATION_ID,
      tracking_status: "pending",
      last_successful_check_at: null,
      next_daily_check_at: "2026-09-03T00:00:00.000Z",
      consecutive_failures: 0,
    }],
  };
}

function storageFixture(): TableRows {
  return {
    applicant_profiles: [{
      id: PROFILE_ID,
      email: "owner@example.test",
      auth_user_id: AUTH_USER_ID,
    }],
    user_packages: [
      userPackageRow(STORAGE_PACKAGE_ID, STORAGE_APPLICATION_ID, "japan", "JP_TOURIST"),
      userPackageRow(STORAGE_SECOND_PACKAGE_ID, STORAGE_SECOND_APPLICATION_ID, "france", "FR_VISIT"),
      userPackageRow(STORAGE_ABSOLUTE_PACKAGE_ID, STORAGE_ABSOLUTE_APPLICATION_ID, "canada", "CA_VISIT"),
      userPackageRow(STORAGE_VIETNAM_PACKAGE_ID, STORAGE_VIETNAM_APPLICATION_ID, "vietnam", "evisa_tourism"),
    ],
    applications: [
      applicationRow({
        id: STORAGE_APPLICATION_ID,
        country: "japan",
        visa_type: "JP_TOURIST",
        status: "approved",
        result_status: "approved",
        receipt_url: "application-documents/shared.pdf",
        result_storage_path: "application-results/other.pdf",
        submitted_at: "2026-09-01T10:00:00.000Z",
        updated_at: "2026-09-01T11:00:00.000Z",
        visa_package_id: STORAGE_PACKAGE_ID,
      }),
      applicationRow({
        id: STORAGE_SECOND_APPLICATION_ID,
        country: "france",
        visa_type: "FR_VISIT",
        status: "approved",
        result_status: "approved",
        receipt_url: "application-documents/shared.pdf",
        result_storage_path: "application-results/shared.pdf",
        packet_status: "ready",
        external_status: "approved",
        submitted_at: "2026-09-02T10:00:00.000Z",
        updated_at: "2026-09-02T11:00:00.000Z",
        visa_package_id: STORAGE_SECOND_PACKAGE_ID,
      }),
      applicationRow({
        id: STORAGE_ABSOLUTE_APPLICATION_ID,
        country: "canada",
        visa_type: "CA_VISIT",
        status: "draft",
        receipt_url: "https://files.example.test/client-receipt.pdf",
        updated_at: "2026-09-03T11:00:00.000Z",
        visa_package_id: STORAGE_ABSOLUTE_PACKAGE_ID,
      }),
      applicationRow({
        id: STORAGE_VIETNAM_APPLICATION_ID,
        country: "vietnam",
        visa_type: "evisa_tourism",
        status: "approved",
        result_status: "approved",
        result_storage_path: "application-results/vietnam.pdf",
        submitted_at: "2026-09-04T10:00:00.000Z",
        updated_at: "2026-09-04T11:00:00.000Z",
        visa_package_id: STORAGE_VIETNAM_PACKAGE_ID,
      }),
      applicationRow({
        id: STORAGE_FOREIGN_APPLICATION_ID,
        applicant_id: OTHER_PROFILE_ID,
        country: "germany",
        visa_type: "DE_VISIT",
        status: "approved",
        result_status: "approved",
        result_storage_path: "application-results/foreign.pdf",
        updated_at: "2026-09-05T11:00:00.000Z",
        visa_package_id: STORAGE_PACKAGE_ID,
      }),
    ],
    payment_records: [paymentRow({
      id: "storage-second-payment",
      application_id: STORAGE_SECOND_APPLICATION_ID,
      visa_package_id: STORAGE_SECOND_PACKAGE_ID,
      applicant_id: PROFILE_ID,
      status: "paid",
      receipt_url: null,
    })],
    consent_events: [{
      application_id: STORAGE_SECOND_APPLICATION_ID,
      accepted: true,
      created_at: "2026-09-02T09:00:00.000Z",
    }],
    application_signatures: [{
      application_id: STORAGE_SECOND_APPLICATION_ID,
      signed_at: "2026-09-02T09:01:00.000Z",
      created_at: "2026-09-02T09:01:00.000Z",
    }],
    application_documents: [],
    visa_application_answers: [],
    application_packets: [],
    application_events: [],
    notification_events: [],
    official_application_tracking: [],
  };
}

function applicationIdsReadFromDependentTables(calls: QueryCall[]): Map<string, string[]> {
  const dependentTables = new Set([
    "consent_events",
    "application_signatures",
    "application_documents",
    "visa_application_answers",
    "application_packets",
    "application_events",
    "notification_events",
    "official_application_tracking",
  ]);
  return new Map(
    calls
      .filter((call) => dependentTables.has(call.table))
      .map((call) => [
        call.table,
        call.filters
          .filter((filter): filter is Extract<Filter, { kind: "in" }> => filter.kind === "in" && filter.column === "application_id")
          .flatMap((filter) => filter.values.map(String)),
      ]),
  );
}

async function runLoader(
  tableRows: TableRows,
  applicationId?: string,
  failedTables: readonly string[] = [],
  storageOptions: Omit<FakeAdminOptions, "failedTables"> = {},
): Promise<{ data: ClientStatusData; fake: FakeAdmin }> {
  const fake = createFakeAdmin(tableRows, {
    ...storageOptions,
    failedTables: new Set(failedTables),
  });
  createAdminClient.mockReturnValue(fake.client);
  const data = await getClientStatusData(applicationId === undefined ? {} : { applicationId });
  return { data, fake };
}

async function runIndexLoader(
  tableRows: TableRows,
  failedTables: readonly string[] = [],
): Promise<{ data: Awaited<ReturnType<typeof getClientStatusIndexData>>; fake: FakeAdmin }> {
  const fake = createFakeAdmin(tableRows, { failedTables: new Set(failedTables) });
  createAdminClient.mockReturnValue(fake.client);
  const data = await getClientStatusIndexData();
  return { data, fake };
}

beforeEach(() => {
  createAdminClient.mockReset();
  getClientSessionReadResult.mockReset();
  loadLiveSubmissionSummaries.mockReset();
  getClientSessionReadResult.mockResolvedValue({
    status: "authenticated",
    source: "cookie",
    session: {
      userId: PROFILE_ID,
      authUserId: AUTH_USER_ID,
      email: "owner@example.test",
    },
  });
  loadLiveSubmissionSummaries.mockResolvedValue(new Map());
});

describe("getClientStatusData application scope", () => {
  it("returns the same profile-owned detail as the full history loader", async () => {
    const all = await runLoader(baseFixture());
    const scoped = await runLoader(baseFixture(), PROFILE_APPLICATION_ID);
    const allDetail = all.data.detailApplications.find((application) => application.id === PROFILE_APPLICATION_ID);

    expect(allDetail).toBeDefined();
    expect(scoped.data.detailApplications).toHaveLength(1);
    expect(scoped.data.detailApplications[0]).toEqual(allDetail);
    expect(scoped.data.applications).toHaveLength(1);

    const scopedApplicationQuery = scoped.fake.calls.find((call) =>
      call.table === "applications" && call.filters.some((filter) =>
        filter.kind === "eq" && filter.column === "id" && filter.value === PROFILE_APPLICATION_ID,
      ),
    );
    expect(scopedApplicationQuery).toBeDefined();
    expect(scoped.fake.calls.filter((call) => call.table === "payment_records")).toHaveLength(1);
  });

  it("keeps an authenticated application linked through user_packages", async () => {
    const fixture = baseFixture();
    fixture.user_packages = [userPackageRow(PACKAGE_ID, LINKED_APPLICATION_ID)];
    fixture.applications = [
      applicationRow({
        id: PROFILE_APPLICATION_ID,
        visa_package_id: null,
      }),
      applicationRow({
        id: LINKED_APPLICATION_ID,
        applicant_id: OTHER_PROFILE_ID,
      }),
    ];
    fixture.payment_records = [paymentRow({
      application_id: LINKED_APPLICATION_ID,
      applicant_id: OTHER_PROFILE_ID,
    })];

    const all = await runLoader(fixture);
    const scoped = await runLoader(fixture, LINKED_APPLICATION_ID);

    expect(all.data.detailApplications.map((application) => application.id)).toContain(LINKED_APPLICATION_ID);
    expect(scoped.data.detailApplications).toHaveLength(1);
    expect(scoped.data.detailApplications[0]).toEqual(
      all.data.detailApplications.find((application) => application.id === LINKED_APPLICATION_ID),
    );
    expect(scoped.data.detailApplications[0]?.payment.status).toBe("paid");
  });

  it("retains a submitted SGAC application linked by the legacy email answer", async () => {
    const fixture = baseFixture();
    fixture.user_packages = [];
    fixture.applications = [applicationRow({
      id: SGAC_APPLICATION_ID,
      applicant_id: OTHER_PROFILE_ID,
      submission_result: { submitted: true, reference: "SGAC-123" },
      submission_result_status: "submitted",
    })];
    fixture.visa_application_answers = [{
      application_id: SGAC_APPLICATION_ID,
      field_name: "email_address",
      value_text: "owner@example.test",
      value_json: null,
    }];

    const all = await runLoader(fixture);
    const scoped = await runLoader(fixture, SGAC_APPLICATION_ID);

    expect(all.data.detailApplications.map((application) => application.id)).toContain(SGAC_APPLICATION_ID);
    expect(scoped.data.detailApplications).toHaveLength(1);
    expect(scoped.data.detailApplications[0]).toEqual(
      all.data.detailApplications.find((application) => application.id === SGAC_APPLICATION_ID),
    );
  });

  it("fails closed for a foreign application before live or detail fan-out reads", async () => {
    const fixture = baseFixture();
    fixture.applications = [applicationRow({
      id: FOREIGN_APPLICATION_ID,
      applicant_id: OTHER_PROFILE_ID,
    })];

    const { data, fake } = await runLoader(fixture, FOREIGN_APPLICATION_ID);

    expect(data).toEqual({
      authenticated: true,
      applications: [],
      detailApplications: [],
      partialData: false,
    });
    expect(loadLiveSubmissionSummaries).not.toHaveBeenCalled();
    expect(fake.calls.map((call) => call.table)).not.toContain("payment_records");
    expect(fake.calls.map((call) => call.table)).not.toContain("consent_events");
    expect(fake.calls.map((call) => call.table)).not.toContain("application_events");
  });

  it("does not widen dependent reads when one application is selected", async () => {
    const fixture = baseFixture();
    const secondApplicationId = "99999999-8888-4888-8888-888888888888";
    fixture.applications = [
      applicationRow({ id: PROFILE_APPLICATION_ID }),
      applicationRow({
        id: secondApplicationId,
        created_at: "2026-08-30T00:00:00.000Z",
        updated_at: "2026-08-30T00:00:00.000Z",
      }),
    ];
    fixture.consent_events = [
      { application_id: PROFILE_APPLICATION_ID, accepted: true, created_at: "2026-09-01T00:00:00.000Z" },
      { application_id: secondApplicationId, accepted: true, created_at: "2026-08-30T00:00:00.000Z" },
    ];

    const { fake } = await runLoader(fixture, PROFILE_APPLICATION_ID);
    const dependentReads = applicationIdsReadFromDependentTables(fake.calls);

    expect(dependentReads.size).toBe(8);
    for (const ids of dependentReads.values()) expect(ids).toEqual([PROFILE_APPLICATION_ID]);
    const scopedApplicationRows = fake.calls
      .filter((call) => call.table === "applications")
      .flatMap((call) => call.filters.filter((filter): filter is Extract<Filter, { kind: "eq" }> => filter.kind === "eq" && filter.column === "id"));
    expect(scopedApplicationRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: PROFILE_APPLICATION_ID }),
    ]));
    expect(loadLiveSubmissionSummaries).toHaveBeenCalledWith(
      expect.anything(),
      [PROFILE_APPLICATION_ID],
      [{
        id: PROFILE_APPLICATION_ID,
        country: "singapore",
        visa_type: "SG_ARRIVAL_CARD",
      }],
    );
  });

  it("preserves the full loader's package-only history entry", async () => {
    const fixture = baseFixture();
    fixture.user_packages = [
      userPackageRow(PACKAGE_ID, PROFILE_APPLICATION_ID),
      userPackageRow(PACKAGE_ONLY_ID, null, "japan", "JP_VISIT_JAPAN_WEB"),
    ];
    const { data } = await runLoader(fixture);


    expect(data.authenticated).toBe(true);
    expect(data.detailApplications.map((application) => application.id)).toContain(PROFILE_APPLICATION_ID);
    expect(data.detailApplications.some((application) => application.id === null && application.packageId === PACKAGE_ONLY_ID)).toBe(true);
  });

  it.each(["", " ", "not-a-uuid", `${PROFILE_APPLICATION_ID},foreign`])(
    "does not turn invalid application selector %j into a full read",
    async (applicationId) => {
      const fixture = baseFixture();
      const { data, fake } = await runLoader(fixture, applicationId);

      expect(data).toEqual({
        authenticated: false,
        applications: [],
        detailApplications: [],
        partialData: false,
      });
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(fake.calls).toHaveLength(0);
      expect(loadLiveSubmissionSummaries).not.toHaveBeenCalled();
    },
  );
});

describe("getClientStatusData package-linked payment files", () => {
  it("keeps the newest owner-linked receipt when its application id is legacy or mismatched", async () => {
    const fixture = baseFixture();
    fixture.applications = [applicationRow({
      receipt_url: null,
      submitted_at: null,
    })];
    fixture.payment_records = [
      paymentRow({
        id: "older-application-payment",
        application_id: PROFILE_APPLICATION_ID,
        visa_package_id: PACKAGE_ID,
        receipt_url: "application-documents/older-payment.pdf",
        updated_at: "2026-09-01T12:00:00.000Z",
      }),
      paymentRow({
        id: "newer-legacy-package-payment",
        // Legacy payment rows may point at a previous application while the
        // applicant/package ownership remains valid for the selected record.
        application_id: FOREIGN_APPLICATION_ID,
        visa_package_id: PACKAGE_ID,
        receipt_url: "application-documents/legacy-payment.pdf",
        updated_at: "2026-09-03T12:00:00.000Z",
      }),
    ];

    const { data, fake } = await runLoader(fixture, PROFILE_APPLICATION_ID);
    const application = data.detailApplications[0];

    expect(application?.files).toEqual([
      {
        key: "paymentReceipt",
        href: "https://signed.example.test/application-documents/legacy-payment.pdf",
        reference: "application-documents/legacy-payment.pdf",
        createdAt: "2026-09-03T12:00:00.000Z",
      },
    ]);
    expect(fake.storageBatches).toEqual([
      {
        bucket: "application-documents",
        paths: ["legacy-payment.pdf"],
        expiresIn: 60 * 60,
      },
    ]);
    expect(fake.storageSignatures).toEqual([
      {
        bucket: "application-documents",
        path: "legacy-payment.pdf",
        expiresIn: 60 * 60,
      },
    ]);
    expect(fake.storageSingleCalls).toHaveLength(0);
  });
});

describe("getClientStatusData storage URL resolution", () => {
  it("signs only authorized targets, deduplicates paths, preserves file metadata and action links", async () => {
    const { data, fake } = await runLoader(storageFixture());

    expect(fake.storageSingleCalls).toHaveLength(0);
    expect(fake.storageBatches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bucket: "application-documents",
        paths: ["shared.pdf"],
        expiresIn: 60 * 60,
      }),
      expect.objectContaining({
        bucket: "application-results",
        paths: expect.arrayContaining(["other.pdf", "shared.pdf"]),
        expiresIn: 60 * 60,
      }),
    ]));

    expect(fake.storageSignatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "application-documents", path: "shared.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "other.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "shared.pdf" }),
    ]));
    expect(fake.storageSignatures.filter(({ bucket, path }) =>
      bucket === "application-documents" && path === "shared.pdf",
    )).toHaveLength(1);
    expect(fake.storageSignatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "application-results", path: "foreign.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "vietnam.pdf" }),
    ]));

    const second = data.detailApplications.find(
      (application) => application.id === STORAGE_SECOND_APPLICATION_ID,
    );
    expect(second?.files).toEqual([
      {
        key: "applicationReceipt",
        href: "https://signed.example.test/application-documents/shared.pdf",
        reference: "application-documents/shared.pdf",
        createdAt: "2026-09-02T10:00:00.000Z",
      },
      {
        key: "approvedResult",
        href: "https://signed.example.test/application-results/shared.pdf",
        printHref: null,
        reference: "application-results/shared.pdf",
        createdAt: "2026-09-02T11:00:00.000Z",
      },
    ]);
    expect(second?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "downloadResult",
        href: "https://signed.example.test/application-results/shared.pdf",
        primary: true,
      }),
    ]));

    const absolute = data.detailApplications.find(
      (application) => application.id === STORAGE_ABSOLUTE_APPLICATION_ID,
    );
    expect(absolute?.files).toEqual([
      expect.objectContaining({
        key: "applicationReceipt",
        href: "https://files.example.test/client-receipt.pdf",
        reference: "https://files.example.test/client-receipt.pdf",
      }),
    ]);

    const vietnam = data.detailApplications.find(
      (application) => application.id === STORAGE_VIETNAM_APPLICATION_ID,
    );
    expect(vietnam?.files).toEqual([
      {
        key: "approvedResult",
        href: `/api/applications/${STORAGE_VIETNAM_APPLICATION_ID}/evisa-artifact?disposition=attachment`,
        printHref: `/api/applications/${STORAGE_VIETNAM_APPLICATION_ID}/evisa-artifact?disposition=inline`,
        reference: "application-results/vietnam.pdf",
        createdAt: "2026-09-04T11:00:00.000Z",
      },
    ]);
  });

  it("keeps selected loading inside its target's storage scope", async () => {
    const { data, fake } = await runLoader(storageFixture(), STORAGE_SECOND_APPLICATION_ID);

    expect(data.detailApplications).toHaveLength(1);
    expect(data.detailApplications[0]?.id).toBe(STORAGE_SECOND_APPLICATION_ID);
    expect(fake.storageSingleCalls).toHaveLength(0);
    expect(fake.storageSignatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "application-documents", path: "shared.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "shared.pdf" }),
    ]));
    expect(fake.storageSignatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "application-results", path: "other.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "vietnam.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "foreign.pdf" }),
    ]));
    expect(fake.storageSignatures).toHaveLength(2);
  });

  it("returns null for a failed storage batch while keeping other files available", async () => {
    const { data, fake } = await runLoader(
      storageFixture(),
      undefined,
      [],
      { failedStorageBuckets: new Set(["application-documents"]) },
    );

    const second = data.detailApplications.find(
      (application) => application.id === STORAGE_SECOND_APPLICATION_ID,
    );
    expect(second?.files).toEqual([
      expect.objectContaining({
        key: "applicationReceipt",
        href: null,
        reference: "application-documents/shared.pdf",
      }),
      expect.objectContaining({
        key: "approvedResult",
        href: "https://signed.example.test/application-results/shared.pdf",
        reference: "application-results/shared.pdf",
      }),
    ]);
    expect(data.partialData).toBe(false);
    expect(fake.storageSingleCalls).toHaveLength(0);
    expect(fake.storageBatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "application-documents" }),
      expect.objectContaining({ bucket: "application-results" }),
    ]));
  });
});

describe("getClientStatusIndexData projection", () => {
  it("preserves list state, progress, ordering and links while skipping detail fan-out and storage signing", async () => {
    const fixture = richFixture();
    const full = await runLoader(fixture);
    const index = await runIndexLoader(fixture);
    const projectApplication = (application: ClientStatusData["applications"][number]) => ({
      id: application.id,
      key: application.key,
      countryKey: application.countryKey,
      packageId: application.packageId,
      country: application.country,
      visaType: application.visaType,
      countryName: application.countryName,
      countryNameZh: application.countryNameZh,
      countryFlag: application.countryFlag,
      visaTypeLabel: application.visaTypeLabel,
      visaTypeLabelZh: application.visaTypeLabelZh,
      state: application.state,
      progressPercent: application.progressPercent,
      applicationRecords: application.applicationRecords.map((record) => ({
        id: record.id,
        applicationId: record.applicationId,
        packageId: record.packageId,
        country: record.country,
        visaType: record.visaType,
        visaTypeLabel: record.visaTypeLabel,
        visaTypeLabelZh: record.visaTypeLabelZh,
        state: record.state,
        progressPercent: record.progressPercent,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        submittedAt: record.submittedAt,
        detailHref: record.detailHref,
        // The index deliberately replaces an arrival-card download action's
        // signed URL with the authenticated internal status route. Other
        // application actions must remain byte-for-byte equivalent.
        continueHref: record.file?.key === "arrivalCardConfirmation"
          ? record.detailHref
          : record.continueHref,
      })),
    });

    expect(index.data.applications).toEqual(full.data.applications.map(projectApplication));
    expect(index.data.detailApplications).toEqual(
      full.data.detailApplications.map(({ id, packageId, country, visaType }) => ({
        id,
        packageId,
        country,
        visaType,
      })),
    );
    expect(index.data.detailApplications.map((application) => application.id)).toEqual(
      full.data.detailApplications.map((application) => application.id),
    );

    const normal = full.data.detailApplications.find((application) => application.id === NORMAL_APPLICATION_ID);
    expect(normal).toMatchObject({
      state: "in_progress",
      progressPercent: 71,
      payment: { status: "paid", amountCents: 12000 },
      consent: { accepted: true, signaturePresent: true },
      formAnswerCount: 2,
      documents: { total: 2, uploaded: 1, validated: 1, missing: 0, rejected: 0 },
      packet: { status: "ready", storagePath: "application-packets/normal.zip" },
    });

    const sgacRecord = index.data.applications
      .flatMap((application) => application.applicationRecords)
      .find((record) => record.applicationId === SGAC_APPLICATION_ID);
    const sgacDetailHref = `/client/application?applicationId=${SGAC_APPLICATION_ID}`;
    expect(sgacRecord).toMatchObject({
      state: "submitted",
      detailHref: sgacDetailHref,
      continueHref: sgacDetailHref,
    });
    expect(isOngoingApplicationState(sgacRecord?.state)).toBe(true);

    const sgac = full.data.detailApplications.find((application) => application.id === SGAC_APPLICATION_ID);
    expect(sgac?.files).toEqual([
      expect.objectContaining({
        key: "arrivalCardConfirmation",
        reference: "submission-artifacts/sgac/confirmation.pdf",
        href: "https://signed.example.test/submission-artifacts/sgac/confirmation.pdf",
      }),
    ]);
    expect(full.data.detailApplications.find((application) => application.id === APPROVED_APPLICATION_ID)?.files)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "approvedResult", reference: "application-results/approved.pdf" }),
      ]));
    expect(full.data.detailApplications.find((application) => application.id === REJECTED_APPLICATION_ID)?.files)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "rejectionLetter", reference: "application-results/rejected.pdf" }),
      ]));

    const skippedDetailTables = new Set([
      "application_events",
      "notification_events",
      "official_application_tracking",
    ]);
    expect(index.fake.calls.filter((call) => skippedDetailTables.has(call.table))).toHaveLength(0);
    expect(full.fake.calls.filter((call) => skippedDetailTables.has(call.table))).toHaveLength(3);
    expect(full.fake.calls.length - index.fake.calls.length).toBe(3);
    expect(loadLiveSubmissionSummaries).toHaveBeenCalledTimes(2);
    expect(loadLiveSubmissionSummaries).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.arrayContaining([
        NORMAL_APPLICATION_ID,
        APPROVED_APPLICATION_ID,
        REJECTED_APPLICATION_ID,
        SGAC_APPLICATION_ID,
      ]),
      expect.arrayContaining([
        expect.objectContaining({ id: NORMAL_APPLICATION_ID }),
        expect.objectContaining({ id: APPROVED_APPLICATION_ID }),
        expect.objectContaining({ id: REJECTED_APPLICATION_ID }),
        expect.objectContaining({ id: SGAC_APPLICATION_ID }),
      ]),
    );
    expect(index.fake.storageSignatures).toHaveLength(0);
    expect(index.fake.storageBatches).toHaveLength(0);
    expect(index.fake.storageSingleCalls).toHaveLength(0);
    expect(full.fake.storageSignatures.length).toBeGreaterThan(0);
    expect(full.fake.storageSingleCalls).toHaveLength(0);
    expect(full.fake.storageSignatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "submission-artifacts", path: "sgac/confirmation.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "approved.pdf" }),
      expect.objectContaining({ bucket: "application-results", path: "rejected.pdf" }),
    ]));

    const serializedIndex = JSON.stringify(index.data);
    expect(serializedIndex).not.toContain("application-results/approved.pdf");
    expect(serializedIndex).not.toContain("application-results/rejected.pdf");
    expect(serializedIndex).not.toContain("submission-artifacts/sgac/confirmation.pdf");
    expect(serializedIndex).not.toContain("confirmationPdfStoragePath");
    expect(serializedIndex).not.toContain('"confirmationNumber"');
    expect(serializedIndex).not.toContain('"files"');

    const detailIds = full.data.detailApplications.map((application) => application.id);
    expect(detailIds).toEqual(expect.arrayContaining([
      NORMAL_APPLICATION_ID,
      APPROVED_APPLICATION_ID,
      REJECTED_APPLICATION_ID,
      SGAC_APPLICATION_ID,
    ]));
    expect(detailIds).not.toContain(FOREIGN_APPLICATION_ID);
    expect(detailIds).not.toContain(QA_APPLICATION_ID);
    expect(index.data.applications.flatMap((application) => application.applicationRecords)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ applicationId: null, packageId: PACKAGE_ONLY_ID }),
      ]),
    );
  });

  it("marks core failures as partial while ignored detail failures do not affect the index", async () => {
    const fixture = richFixture();
    const coreFailure = await runIndexLoader(fixture, ["applications"]);
    expect(coreFailure.data.authenticated).toBe(true);
    expect(coreFailure.data.partialData).toBe(true);

    const detailFailure = await runIndexLoader(fixture, [
      "application_events",
      "notification_events",
      "official_application_tracking",
    ]);
    expect(detailFailure.data.authenticated).toBe(true);
    expect(detailFailure.data.partialData).toBe(false);
    expect(detailFailure.fake.calls.filter((call) => [
      "application_events",
      "notification_events",
      "official_application_tracking",
    ].includes(call.table))).toHaveLength(0);

    const fullDetailFailure = await runLoader(fixture, undefined, [
      "application_events",
      "notification_events",
      "official_application_tracking",
    ]);
    expect(fullDetailFailure.data.partialData).toBe(true);
  });

  it("returns unauthenticated without creating an admin client", async () => {
    getClientSessionReadResult.mockResolvedValue({
      status: "unauthenticated",
      session: null,
      reason: "missing_auth_session",
    });

    const data = await getClientStatusIndexData();

    expect(data).toEqual({
      authenticated: false,
      applications: [],
      detailApplications: [],
      partialData: false,
    });
    expect(getClientSessionReadResult).toHaveBeenCalledOnce();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("keeps a session provider outage distinct from an unauthenticated session", async () => {
    getClientSessionReadResult.mockResolvedValue({
      status: "unavailable",
      session: null,
      reason: "timeout",
    });

    const data = await getClientStatusIndexData();

    expect(data).toEqual({
      authenticated: false,
      applications: [],
      detailApplications: [],
      partialData: false,
      unavailable: true,
    });
    expect(getClientSessionReadResult).toHaveBeenCalledOnce();
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
