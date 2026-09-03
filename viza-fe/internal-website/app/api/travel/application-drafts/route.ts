import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTravelUserSession } from "@/lib/travel/auth";
import {
  previewTravelApplicationAutofill,
  type TravelAutofillApplication,
  type TravelAutofillField,
} from "@/lib/travel/application-draft-autofill";
import type { TravelState } from "@/lib/travel/planner";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import {
  applicationIdentityMatches,
  isOngoingApplicationRecord,
} from "@/lib/applications/ongoing-application";
import {
  NON_SCHENGEN_VISA_DESTINATIONS,
  SCHENGEN_VISA_DESTINATIONS,
} from "@/lib/visa-destinations";
import type { Json } from "@/types/database";

type RequestBody = {
  mode?: "preview" | "commit";
  state?: TravelState;
  planDigest?: string;
  confirmIntendedTravel?: boolean;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  submitted_at: string | null;
  purpose: string | null;
  status: string | null;
  submission_result_status: string | null;
  result_status: string | null;
  submission_result: unknown;
};

type SchemaRow = {
  visa_type: string;
  field_name: string;
  field_type: string;
  options: unknown;
};

type DraftAnswerRow = {
  application_id: string;
  field_name: string;
  value_text: string;
  source: string;
  source_profile_updated_at: null;
  source_metadata: Json;
  updated_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseBody(value: unknown): RequestBody | null {
  if (!isRecord(value) || !isRecord(value.state)) return null;
  const mode = value.mode === "commit" ? "commit" : "preview";
  return {
    mode,
    state: value.state as unknown as TravelState,
    planDigest: typeof value.planDigest === "string" ? value.planDigest : undefined,
    confirmIntendedTravel: value.confirmIntendedTravel === true,
  };
}

function validateState(state: TravelState): string[] {
  const errors: string[] = [];
  if (!Array.isArray(state.countries) || !Array.isArray(state.cities)) {
    errors.push("The plan has no structured country/city list.");
  } else if (state.countries.length !== state.cities.length) {
    errors.push("Each country must have exactly one unambiguous destination city.");
  }
  if (!state.destination_confirmed) errors.push("Destinations are not confirmed.");
  if (state.date_flexibility !== "fixed") {
    errors.push("Choose a fixed intended departure date before filling applications.");
  }
  if (!state.departure_date || !/^\d{4}-\d{2}-\d{2}$/.test(state.departure_date)) {
    errors.push("A valid intended departure date is required.");
  }
  return errors;
}

function planDigest(state: TravelState): string {
  return createHash("sha256")
    .update(JSON.stringify(state))
    .digest("hex");
}

async function saveEmptyDraftRows(
  admin: ReturnType<typeof createAdminClient>,
  rows: DraftAnswerRow[]
): Promise<{ savedFields: number; updatedApplications: number; error?: string }> {
  const savedApplicationIds = new Set<string>();
  const results = await Promise.all(
    rows.map(async (row) => {
      const updateResult = await admin
        .from("visa_application_answers")
        .update(row)
        .eq("application_id", row.application_id)
        .eq("field_name", row.field_name)
        .or("value_text.is.null,value_text.eq.")
        .select("application_id");
      if (updateResult.error) return { saved: false, error: updateResult.error.message };
      if ((updateResult.data?.length ?? 0) > 0) return { saved: true };

      const insertResult = await admin
        .from("visa_application_answers")
        .upsert(row, {
          onConflict: "application_id,field_name",
          ignoreDuplicates: true,
        })
        .select("application_id");
      if (insertResult.error) return { saved: false, error: insertResult.error.message };
      return { saved: (insertResult.data?.length ?? 0) > 0 };
    })
  );

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) return { savedFields: 0, updatedApplications: 0, error: firstError };

  results.forEach((result, index) => {
    if (result.saved) savedApplicationIds.add(rows[index].application_id);
  });
  return {
    savedFields: results.filter((result) => result.saved).length,
    updatedApplications: savedApplicationIds.size,
  };
}

async function resolveApplicantId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string | null> {
  const direct = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (direct.data?.id) return direct.data.id;

  const byAuth = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return byAuth.data?.id ?? null;
}

export async function POST(request: Request) {
  const session = await getTravelUserSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = parseBody(await request.json().catch(() => null));
  if (!body?.state) {
    return Response.json({ error: "A structured Travel plan is required." }, { status: 400 });
  }

  const validationErrors = validateState(body.state);
  const digest = planDigest(body.state);
  if (body.mode === "commit") {
    if (!body.confirmIntendedTravel) {
      return Response.json(
        { error: "Confirm that this is your intended travel before saving drafts." },
        { status: 409 }
      );
    }
    if (!body.planDigest || body.planDigest !== digest) {
      return Response.json(
        { error: "The Travel plan changed after preview. Preview it again." },
        { status: 409 }
      );
    }
    if (validationErrors.length > 0) {
      return Response.json({ error: validationErrors[0], blockers: validationErrors }, { status: 409 });
    }
  }

  const admin = createAdminClient();
  const applicantId = await resolveApplicantId(admin, session.userId);
  if (!applicantId) {
    return Response.json({ error: "Applicant profile not found." }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, submitted_at, purpose, status, submission_result_status, result_status, submission_result")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  if (applicationError) {
    return Response.json({ error: applicationError.message }, { status: 503 });
  }

  const allApplications = (applicationData ?? []) as ApplicationRow[];
  const activeRoutes = [
    ...NON_SCHENGEN_VISA_DESTINATIONS,
    ...SCHENGEN_VISA_DESTINATIONS,
  ].filter((destination) => destination.recommendable !== false);
  const applications = activeRoutes.flatMap((route) => {
    const matches = allApplications.filter((application) =>
      applicationIdentityMatches(application, route.country, route.visaType)
    );
    const selected =
      matches.find((application) => isOngoingApplicationRecord(application)) ??
      matches[0];
    return selected ? [selected] : [];
  });
  const applicationIds = applications.map((application) => application.id);
  const schemaTypes = [...new Set(applications.map((application) =>
    resolveVisaFormSchemaVisaType(application.visa_type, application.country)
  ))];

  const [schemaResult, answerResult, runnerResult, queueResult] = await Promise.all([
    schemaTypes.length
      ? admin
          .from("visa_form_fields")
          .select("visa_type, field_name, field_type, options")
          .in("visa_type", schemaTypes)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? admin
          .from("visa_application_answers")
          .select("application_id, field_name, value_text")
          .in("application_id", applicationIds)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? admin
          .from("runner_job")
          .select("application_id")
          .in("application_id", applicationIds)
          .in("status", ["queued", "running", "retrying", "scheduled"])
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? admin
          .from("submission_queue")
          .select("application_id")
          .in("application_id", applicationIds)
          .in("status", ["pending", "processing", "retrying", "scheduled"])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const readError = schemaResult.error ?? answerResult.error ?? runnerResult.error ?? queueResult.error;
  if (readError) return Response.json({ error: readError.message }, { status: 503 });

  const fieldsByType = new Map<string, TravelAutofillField[]>();
  for (const row of (schemaResult.data ?? []) as SchemaRow[]) {
    const fields = fieldsByType.get(row.visa_type) ?? [];
    fields.push({ fieldName: row.field_name, fieldType: row.field_type, options: row.options });
    fieldsByType.set(row.visa_type, fields);
  }

  const answersByApplication = new Map<string, Record<string, string>>();
  for (const row of answerResult.data ?? []) {
    const values = answersByApplication.get(row.application_id) ?? {};
    if (typeof row.value_text === "string") values[row.field_name] = row.value_text;
    answersByApplication.set(row.application_id, values);
  }

  const activeApplicationIds = new Set([
    ...(runnerResult.data ?? []).map((row) => row.application_id),
    ...(queueResult.data ?? []).map((row) => row.application_id),
  ]);

  const previews = applications.map((application) => {
    const schemaType = resolveVisaFormSchemaVisaType(
      application.visa_type,
      application.country
    );
    const input: TravelAutofillApplication = {
      id: application.id,
      country: application.country,
      visaType: application.visa_type,
      fields: fieldsByType.get(schemaType) ?? [],
      existingAnswers: answersByApplication.get(application.id) ?? {},
    };
    const preview = previewTravelApplicationAutofill(input, body.state!);
    const locked = Boolean(application.submitted_at) || activeApplicationIds.has(application.id);
    return {
      ...preview,
      locked,
      lockReason: application.submitted_at
        ? "Already submitted"
        : activeApplicationIds.has(application.id)
          ? "An official-submission job is active"
          : null,
      patches: locked ? [] : preview.patches,
    };
  });

  if (body.mode === "commit") {
    const now = new Date().toISOString();
    const rows = previews.flatMap((preview) =>
      preview.patches.map((patch) => ({
        application_id: preview.applicationId,
        field_name: patch.fieldName,
        value_text: patch.value,
        source: "travel_planner",
        source_profile_updated_at: null,
        source_metadata: {
          source: "travel_planner_confirmed",
          planDigest: digest,
          sourceFact: patch.sourceFact,
          confirmedAt: now,
        } as Json,
        updated_at: now,
      }))
    );

    const saveResult = await saveEmptyDraftRows(admin, rows);
    if (saveResult.error) {
      return Response.json({ error: saveResult.error }, { status: 503 });
    }

    return Response.json({
      ok: true,
      planDigest: digest,
      savedFields: saveResult.savedFields,
      updatedApplications: saveResult.updatedApplications,
      officialSubmissionStarted: false,
      paymentActionStarted: false,
      previews,
    });
  }

  return Response.json({
    ok: validationErrors.length === 0,
    planDigest: digest,
    blockers: validationErrors,
    applicationCount: applications.length,
    fillableApplications: previews.filter((preview) => preview.patches.length > 0).length,
    fillableFields: previews.reduce((total, preview) => total + preview.patches.length, 0),
    lockedApplications: previews.filter((preview) => preview.locked).length,
    previews,
  });
}
