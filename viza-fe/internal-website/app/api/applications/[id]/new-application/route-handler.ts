import { NextResponse } from "next/server";
import { isUsDs160 } from "@/lib/application-tab-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DS160_LEGACY_ANSWER_ALIASES: Record<string, string> = {
  who_is_paying: "trip_payer_type",
  has_other_names: "other_names_used",
  has_specific_travel_plans: "has_specific_plans",
  has_other_phone: "has_other_phones",
  has_other_email: "has_other_emails",
  passport_lost_or_stolen: "lost_passport",
  has_other_education: "has_attended_education",
  has_countries_visited: "has_traveled_last_five_years",
  has_organization: "has_belonged_to_organization",
  has_served_insurgent: "has_served_paramilitary",
};

type SavedAnswer = {
  field_name: string;
  value_text: string | null;
  value_json: unknown;
};

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message ?? "");
}

async function loadExistingDraft(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  source: { id: string; country: string | null; visa_type: string | null },
): Promise<{
  readonly draft: { readonly id: string; readonly visa_package_id: string | null } | null;
  readonly answers: SavedAnswer[];
  readonly error: { readonly code?: string; readonly message?: string } | null;
}> {
  const { data: draft, error: draftError } = await admin
    .from("applications")
    .select("id, visa_package_id")
    .eq("applicant_id", profileId)
    .eq("country", source.country)
    .eq("visa_type", source.visa_type)
    .eq("status", "draft")
    .or("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN")
    .neq("id", source.id)
    .limit(1)
    .maybeSingle();
  if (draftError || !draft) {
    return { draft: draft ?? null, answers: [], error: draftError };
  }

  const { data: answers, error: answerError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", draft.id)
    .limit(1);
  return {
    draft,
    answers: (answers ?? []) as SavedAnswer[],
    error: answerError,
  };
}

async function ensureDraftVisaPackage(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  draft: { readonly id: string; readonly visa_package_id: string | null },
  sourcePackageId: string | null | undefined,
): Promise<string | null> {
  if (draft.visa_package_id || !sourcePackageId) return null;

  const { error } = await admin
    .from("applications")
    .update({
      visa_package_id: sourcePackageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .eq("applicant_id", profileId)
    .is("visa_package_id", null);
  return error?.message ?? null;
}

export function normalizeCopiedDs160Answers(sourceAnswers: SavedAnswer[]): SavedAnswer[] {
  const copied = new Map(sourceAnswers.map((answer) => [answer.field_name, answer]));
  for (const [legacyName, canonicalName] of Object.entries(DS160_LEGACY_ANSWER_ALIASES)) {
    if (copied.has(canonicalName)) continue;
    const legacyAnswer = copied.get(legacyName);
    if (!legacyAnswer) continue;
    copied.set(canonicalName, {
      ...legacyAnswer,
      field_name: canonicalName,
    });
  }
  return [...copied.values()];
}

export async function createNewUsApplication(userId: string, sourceApplicationId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) return { error: "Applicant profile not found", status: 404 } as const;

  const { data: source } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, visa_package_id, status, submission_result_status, submission_result")
    .eq("id", sourceApplicationId)
    .maybeSingle();
  if (!source) return { error: "Application not found", status: 404 } as const;
  if (source.applicant_id !== profile.id) return { error: "Forbidden", status: 403 } as const;
  if (!isUsDs160(source.country, source.visa_type)) {
    return { error: "This action is only available for U.S. DS-160 applications", status: 400 } as const;
  }
  const result: unknown = source.submission_result;
  const confirmedResult = typeof result === "object" && result !== null && !Array.isArray(result)
    ? result as Record<string, unknown>
    : null;
  // Older worker results can be authoritative while the generic application
  // status still says processing. Match the same official submitted result
  // shown by the result card; never treat a draft/handoff reference as success.
  const hasSubmittedResult = source.submission_result_status === "submitted"
    && confirmedResult?.country === "US"
    && confirmedResult.status === "submitted"
    && typeof confirmedResult.applicationId === "string"
    && /^AA[A-Z0-9]{8}$/.test(confirmedResult.applicationId);
  if (source.status !== "submitted" && !hasSubmittedResult) {
    return { error: "Only a submitted application can be used to start a new application", status: 409 } as const;
  }

  const { data: sourceAnswers, error: sourceAnswersError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", source.id);
  if (sourceAnswersError) {
    return { error: sourceAnswersError.message, status: 500 } as const;
  }
  if (!sourceAnswers || sourceAnswers.length === 0) {
    return {
      error: "The submitted application has no saved answers to reuse",
      status: 409,
    } as const;
  }

  const existing = await loadExistingDraft(admin, profile.id, source);
  if (existing.error) return { error: "Could not load the existing application", status: 500 } as const;
  if (existing.draft) {
    const packageError = await ensureDraftVisaPackage(
      admin,
      profile.id,
      existing.draft,
      source.visa_package_id,
    );
    if (packageError) return { error: packageError, status: 500 } as const;
  }
  if (existing.draft && existing.answers.length > 0) {
    // Reopen an existing draft without overwriting any saved answer.
    return {
      applicationId: existing.draft.id,
      country: source.country || "united_states",
      visaType: source.visa_type || "B1_B2",
      status: 200,
    } as const;
  }

  let created: { readonly id: string } | null = existing.draft;
  let createdNew = false;
  if (!created) {
    const { data: inserted, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: source.country || "united_states",
      visa_type: source.visa_type || "B1_B2",
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
    if (isUniqueViolation(createError)) {
      // The unique ongoing-application index closes the race between the
      // lookup above and this insert. Re-read the owner-scoped row so a
      // concurrent request reuses it instead of surfacing a false 500.
      const concurrent = await loadExistingDraft(admin, profile.id, source);
      if (concurrent.error || !concurrent.draft) {
        return { error: "Could not create a new application", status: 500 } as const;
      }
      const packageError = await ensureDraftVisaPackage(
        admin,
        profile.id,
        concurrent.draft,
        source.visa_package_id,
      );
      if (packageError) return { error: packageError, status: 500 } as const;
      if (concurrent.answers.length > 0) {
        return {
          applicationId: concurrent.draft.id,
          country: source.country || "united_states",
          visaType: source.visa_type || "B1_B2",
          status: 200,
        } as const;
      }
      created = concurrent.draft;
    } else if (createError || !inserted) {
      return { error: createError?.message || "Could not create a new application", status: 500 } as const;
    } else {
      created = inserted;
      createdNew = true;
    }
  }

  if (!created) return { error: "Could not create a new application", status: 500 } as const;

  const { error: copyError } = await admin.from("visa_application_answers").insert(
    normalizeCopiedDs160Answers(sourceAnswers).map((answer) => ({
      application_id: created.id,
      field_name: answer.field_name,
      value_text: answer.value_text,
      value_json: answer.value_json,
    })),
  );
  if (copyError) {
    if (isUniqueViolation(copyError)) {
      // Another request may have copied the same source into this reused
      // draft between the empty check and the insert. Treat that as a
      // successful reuse only after confirming the target now has answers.
      const afterCopy = await loadExistingDraft(admin, profile.id, source);
      const packageError = afterCopy.draft
        ? await ensureDraftVisaPackage(admin, profile.id, afterCopy.draft, source.visa_package_id)
        : null;
      if (!afterCopy.error && !packageError && afterCopy.draft?.id === created.id && afterCopy.answers.length > 0) {
        return {
          applicationId: created.id,
          country: source.country || "united_states",
          visaType: source.visa_type || "B1_B2",
          status: 200,
        } as const;
      }
    }
    if (createdNew) await admin.from("applications").delete().eq("id", created.id);
    return { error: copyError.message, status: 500 } as const;
  }

  return {
    applicationId: created.id,
    country: source.country || "united_states",
    visaType: source.visa_type || "B1_B2",
    // Keep the existing client contract: a successful source-copy response
    // is treated as creation of the next application flow, even when an
    // owner-scoped empty draft was reused. A draft that already had answers
    // returned above with 200 and is never overwritten.
    status: 201,
  } as const;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await createNewUsApplication(auth.user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const params = new URLSearchParams({
    applicationId: result.applicationId,
    country: result.country,
    visaType: result.visaType,
  });
  return NextResponse.json(
    {
      applicationId: result.applicationId,
      href: `/client/application/long-form?${params.toString()}`,
    },
    { status: result.status },
  );
}
