import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  application_id: string;
  status: string | null;
  mode: string | null;
  provider: string | null;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

type ManualActionTable = {
  tableName: string;
  queueColumn: "submission_queue_id" | "job_id";
  metadataColumn: "metadata" | "redacted_metadata_json";
  hasCountryColumn?: boolean;
};

type RawManualActionRow = {
  id: string;
  submission_queue_id?: string | null;
  job_id?: string | null;
  application_id: string | null;
  country?: string | null;
  action_type: string;
  status: string | null;
  instruction: string | null;
  screenshot_url: string | null;
  metadata?: Record<string, unknown> | null;
  redacted_metadata_json?: Record<string, unknown> | null;
  created_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
};

function isMissingManualActionSchema(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("submission_manual_actions") ||
    message.includes("ds160_live_manual_actions") ||
    message.includes("france_live_manual_actions") ||
    message.includes("vietnam_live_manual_actions")
  );
}

function normalizeCountry(country: string | null | undefined): string {
  return (country ?? "").trim().toLowerCase();
}

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toLowerCase();
}

function isDs160Job(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  const visaType = normalizeVisaType(application.visa_type);
  return (
    queue.provider === "ceac_live" ||
    queue.status?.startsWith("ds160_") === true ||
    visaType === "ds160" ||
    country === "united_states" ||
    country === "united states" ||
    country === "us" ||
    country === "美国"
  );
}

function isFranceJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return (
    queue.provider === "france_visas_live" ||
    country === "france" ||
    country === "fr" ||
    country === "法国"
  );
}

function isVietnamJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return (
    queue.provider === "vietnam_evisa_live" ||
    country === "vietnam" ||
    country === "vn" ||
    country === "viet_nam"
  );
}

function manualActionTables(queue: QueueRow, application: ApplicationRow): ManualActionTable[] {
  const tables: ManualActionTable[] = [
    {
      tableName: "submission_manual_actions",
      queueColumn: "submission_queue_id",
      metadataColumn: "metadata",
      hasCountryColumn: true,
    },
  ];

  if (isFranceJob(queue, application)) {
    tables.push({
      tableName: "france_live_manual_actions",
      queueColumn: "job_id",
      metadataColumn: "redacted_metadata_json",
    });
  }
  if (isVietnamJob(queue, application)) {
    tables.push({
      tableName: "vietnam_live_manual_actions",
      queueColumn: "job_id",
      metadataColumn: "redacted_metadata_json",
    });
  }
  if (isDs160Job(queue, application)) {
    tables.push({
      tableName: "ds160_live_manual_actions",
      queueColumn: "job_id",
      metadataColumn: "redacted_metadata_json",
    });
  }

  return tables;
}

function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetadata);
  if (typeof value !== "object" || value === null) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/answer|captcha|password|cookie|token|secret|passport|reference/i.test(key)) {
      redacted[key] = "<redacted>";
    } else {
      redacted[key] = redactMetadata(nested);
    }
  }
  return redacted;
}

async function authorizeSubmissionJob(jobId: string): Promise<
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      queue: QueueRow;
      application: ApplicationRow;
    }
  | { ok: false; response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, response: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Applicant profile not found" }, { status: 404 }) };
  }

  const { data: queueData, error: queueError } = await admin
    .from("submission_queue")
    .select("id, application_id, status, mode, provider")
    .eq("id", jobId)
    .maybeSingle();

  if (queueError) {
    return { ok: false, response: NextResponse.json({ error: queueError.message }, { status: 500 }) };
  }
  const queue = queueData as QueueRow | null;
  if (!queue) {
    return { ok: false, response: NextResponse.json({ error: "Submission job not found" }, { status: 404 }) };
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", queue.application_id)
    .maybeSingle();

  if (applicationError) {
    return { ok: false, response: NextResponse.json({ error: applicationError.message }, { status: 500 }) };
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return { ok: false, response: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, admin, queue, application };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing submission job id" }, { status: 400 });
  }

  const authorized = await authorizeSubmissionJob(jobId);
  if (!authorized.ok) return authorized.response;

  const allActions: Array<RawManualActionRow & { sourceTable: string }> = [];
  const missingTables: string[] = [];

  for (const table of manualActionTables(authorized.queue, authorized.application)) {
    const countrySelect = table.hasCountryColumn ? ", country" : "";
    const selectColumns =
      table.queueColumn === "submission_queue_id"
        ? `id, submission_queue_id, application_id${countrySelect}, action_type, status, instruction, screenshot_url, metadata, created_at, completed_at, expires_at`
        : "id, job_id, application_id, action_type, status, instruction, screenshot_url, redacted_metadata_json, created_at, completed_at, expires_at";

    const { data, error } = await authorized.admin
      .from(table.tableName)
      .select(selectColumns)
      .eq(table.queueColumn, jobId)
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      if (isMissingManualActionSchema(error)) {
        missingTables.push(table.tableName);
        continue;
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    allActions.push(
      ...((data ?? []) as unknown as RawManualActionRow[]).map((action) => ({
        ...action,
        sourceTable: table.tableName,
      })),
    );
  }

  if (allActions.length === 0 && missingTables.length > 0) {
    return NextResponse.json(
      {
        error:
          "Manual actions are not available because the live-assisted manual action schema has not been applied.",
        code: "manual_actions_schema_not_ready",
        missingTables,
      },
      { status: 503 },
    );
  }

  const manualActions = allActions.map((action) => ({
    id: action.id,
    jobId: action.submission_queue_id ?? action.job_id ?? null,
    applicationId: action.application_id,
    country: action.country ?? authorized.application.country,
    actionType: action.action_type,
    status: action.status ?? "pending",
    instruction: action.instruction,
    screenshotUrl: action.screenshot_url,
    metadata: redactMetadata(action.metadata ?? action.redacted_metadata_json ?? {}),
    sourceTable: action.sourceTable,
    createdAt: action.created_at,
    completedAt: action.completed_at,
    expiresAt: action.expires_at,
  }));

  return NextResponse.json({
    ok: true,
    jobId,
    applicationId: authorized.queue.application_id,
    country: authorized.application.country,
    visaType: authorized.application.visa_type,
    manualActions,
  });
}
