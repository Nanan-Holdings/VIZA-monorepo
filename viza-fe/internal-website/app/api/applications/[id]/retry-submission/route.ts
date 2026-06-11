import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isDs160VisaType,
  isFranceVisasVisaType,
  isSgArrivalCardApplication,
  isVietnamEVisaApplication,
  queueProviderForApplication,
  queueStatusForApplication,
  RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES,
  type SubmissionMode,
} from "@/lib/submission-queue";

type ApplicationForRetry = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  purpose: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
};

type ProfileForRetry = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type RetrySubmissionRequest = {
  mode: SubmissionMode | null;
  country: string | null;
  visaType: string | null;
};

type RetryQueueInsertResult = {
  error: string | null;
  jobId: string | null;
};

type VietnamRequirement = {
  key: string;
  labelZh: string;
  labelEn: string;
  condition?: { key: string; equals: string };
};

type VietnamMissingField = {
  field: string;
  labelZh: string;
  labelEn: string;
};

const VIETNAM_REQUIRED_FIELDS: VietnamRequirement[] = [
  { key: "surname", labelZh: "姓氏 / Surname", labelEn: "Surname" },
  { key: "given_name", labelZh: "名字 / Given names", labelEn: "Given names" },
  { key: "date_of_birth", labelZh: "出生日期", labelEn: "Date of birth" },
  { key: "sex", labelZh: "性别", labelEn: "Sex" },
  { key: "nationality", labelZh: "国籍", labelEn: "Nationality" },
  { key: "email_address", labelZh: "电子邮箱地址", labelEn: "Email address" },
  { key: "re_enter_email_address", labelZh: "确认电子邮箱地址", labelEn: "Re-enter email address" },
  { key: "religion", labelZh: "宗教信仰", labelEn: "Religion" },
  { key: "place_of_birth", labelZh: "出生地点", labelEn: "Place of birth" },
  { key: "has_multiple_nationalities", labelZh: "是否拥有其他国籍", labelEn: "Other nationalities declaration" },
  { key: "other_nationality", labelZh: "其他国籍", labelEn: "Other nationality", condition: { key: "has_multiple_nationalities", equals: "yes" } },
  { key: "has_violated_vietnam_laws", labelZh: "是否曾违反越南法律", labelEn: "Vietnam law violation declaration" },
  { key: "violation_of_vietnam_laws_details", labelZh: "违反越南法律详情", labelEn: "Vietnam law violation details", condition: { key: "has_violated_vietnam_laws", equals: "yes" } },
  { key: "visa_type_requested", labelZh: "申请签证类型", labelEn: "Type of visa requested" },
  { key: "visa_valid_from", labelZh: "签证生效日期", labelEn: "E-visa valid from" },
  { key: "visa_valid_to", labelZh: "签证有效期至", labelEn: "E-visa valid to" },
  { key: "passport_number", labelZh: "护照号码", labelEn: "Passport number" },
  { key: "passport_type", labelZh: "护照类型", labelEn: "Passport type" },
  { key: "passport_issue_date", labelZh: "护照签发日期", labelEn: "Passport issue date" },
  { key: "passport_expiry_date", labelZh: "护照到期日期", labelEn: "Passport expiry date" },
  { key: "permanent_residential_address", labelZh: "永久居住地址", labelEn: "Permanent residential address" },
  { key: "contact_address", labelZh: "联系地址", labelEn: "Contact address" },
  { key: "telephone_number", labelZh: "联系电话", labelEn: "Telephone number" },
  { key: "emergency_contact_full_name", labelZh: "紧急联系人姓名", labelEn: "Emergency contact full name" },
  { key: "emergency_contact_current_address", labelZh: "紧急联系人地址", labelEn: "Emergency contact address" },
  { key: "emergency_contact_telephone", labelZh: "紧急联系人电话", labelEn: "Emergency contact telephone" },
  { key: "emergency_contact_relationship", labelZh: "紧急联系人关系", labelEn: "Emergency contact relationship" },
  { key: "purpose_of_entry", labelZh: "旅行目的 / 入境目的", labelEn: "Purpose of entry" },
  { key: "intended_date_of_entry", labelZh: "计划入境日期", labelEn: "Intended date of entry" },
  { key: "intended_length_of_stay", labelZh: "预计停留时间", labelEn: "Intended length of stay" },
  { key: "accommodation_name", labelZh: "住宿名称", labelEn: "Accommodation name" },
  { key: "residential_address_in_vietnam", labelZh: "越南境内住宿地址", labelEn: "Residential address in Viet Nam" },
  { key: "intended_province_city", labelZh: "越南拟停留省/市", labelEn: "Province/city" },
  { key: "intended_ward_commune", labelZh: "越南拟停留坊/社", labelEn: "Ward/commune" },
  { key: "intended_border_gate_of_entry", labelZh: "预计入境口岸", labelEn: "Intended border gate of entry" },
  { key: "intended_border_gate_of_exit", labelZh: "预计出境口岸", labelEn: "Intended border gate of exit" },
  { key: "declaration_temporary_residence", labelZh: "临时居住申报承诺", labelEn: "Temporary residence declaration" },
  { key: "visited_vietnam_in_last_year", labelZh: "过去一年是否到访越南", labelEn: "Previous Viet Nam visit declaration" },
  { key: "visited_vietnam_purpose_detail", labelZh: "上次到访越南详情", labelEn: "Previous Viet Nam visit details", condition: { key: "visited_vietnam_in_last_year", equals: "yes" } },
  { key: "has_relatives_in_vietnam", labelZh: "是否有亲属在越南", labelEn: "Relatives in Viet Nam declaration" },
  { key: "relative_full_name_in_vn", labelZh: "在越亲属姓名", labelEn: "Relative full name", condition: { key: "has_relatives_in_vietnam", equals: "yes" } },
  { key: "relative_date_of_birth", labelZh: "在越亲属出生日期", labelEn: "Relative date of birth", condition: { key: "has_relatives_in_vietnam", equals: "yes" } },
  { key: "relative_nationality", labelZh: "在越亲属国籍", labelEn: "Relative nationality", condition: { key: "has_relatives_in_vietnam", equals: "yes" } },
  { key: "relative_relationship", labelZh: "与在越亲属关系", labelEn: "Relative relationship", condition: { key: "has_relatives_in_vietnam", equals: "yes" } },
  { key: "relative_address_in_vn", labelZh: "在越亲属地址", labelEn: "Relative address", condition: { key: "has_relatives_in_vietnam", equals: "yes" } },
  { key: "final_declaration", labelZh: "最终声明确认", labelEn: "Final declaration" },
];

async function readRetrySubmissionRequest(request: Request): Promise<RetrySubmissionRequest> {
  try {
    const body = (await request.json()) as {
      mode?: unknown;
      country?: unknown;
      visaType?: unknown;
    };
    return {
      mode: body.mode === "live_assisted" || body.mode === "dry_run" ? body.mode : null,
      country: typeof body.country === "string" && body.country.trim() ? body.country : null,
      visaType: typeof body.visaType === "string" && body.visaType.trim() ? body.visaType : null,
    };
  } catch {
    return {
      mode: null,
      country: null,
      visaType: null,
    };
  }
}

function envEnabled(...keys: string[]): boolean {
  return keys.some((key) => process.env[key] === "true" || process.env[key] === "1");
}

function envModeLive(...keys: string[]): boolean {
  return keys.some((key) => process.env[key] === "live_assisted");
}

function isFranceCountry(country: string | null): boolean {
  const normalized = (country ?? "").trim().toLowerCase();
  return normalized === "france" || normalized === "fr" || normalized === "法国";
}

function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function requestedValueMatchesApplication(
  requested: string | null,
  actual: string | null,
): boolean {
  if (!requested) return true;
  return normalizeComparable(requested) === normalizeComparable(actual);
}

function isFranceLiveRetryApplication(country: string | null, visaType: string | null): boolean {
  return isFranceCountry(country) && isFranceVisasVisaType(visaType);
}

function liveRetryEnabledForApplication(country: string | null, visaType: string | null): boolean {
  if (isVietnamEVisaApplication(country, visaType)) {
    return (
      envEnabled("VN_LIVE_SUBMISSION_ENABLED", "NEXT_PUBLIC_VN_LIVE_SUBMISSION_ENABLED") &&
      envModeLive("VN_SUBMISSION_MODE", "NEXT_PUBLIC_VN_SUBMISSION_MODE")
    );
  }
  if (isFranceLiveRetryApplication(country, visaType)) {
    return (
      envEnabled("FRANCE_LIVE_SUBMISSION_ENABLED", "NEXT_PUBLIC_FRANCE_LIVE_SUBMISSION_ENABLED") &&
      envModeLive("FRANCE_SUBMISSION_MODE", "NEXT_PUBLIC_FRANCE_SUBMISSION_MODE")
    );
  }
  if (isDs160VisaType(visaType)) {
    return (
      envEnabled(
        "DS160_LIVE_SUBMISSION_ENABLED",
        "DS160_LIVE_ASSISTED_ENABLED",
        "NEXT_PUBLIC_DS160_LIVE_ASSISTED_ENABLED",
      ) &&
      envModeLive("DS160_SUBMISSION_MODE", "NEXT_PUBLIC_DS160_SUBMISSION_MODE")
    );
  }
  if (isSgArrivalCardApplication(country, visaType)) {
    return process.env.SGAC_LIVE_SUBMISSION_ENABLED !== "false" &&
      process.env.NEXT_PUBLIC_SGAC_LIVE_SUBMISSION_ENABLED !== "false";
  }
  return false;
}

function isMissingSubmissionModeColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("column submission_queue.mode does not exist") ||
    message.includes("column submission_queue.provider does not exist") ||
    message.includes("could not find the 'mode' column") ||
    message.includes("could not find the 'provider' column")
  );
}

function isMissingVietnamLiveSchemaError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("submission_queue.current_stage") ||
    message.includes("submission_queue.heartbeat_at") ||
    message.includes("submission_queue.vn_result_payload") ||
    message.includes("submission_queue.official_portal_url") ||
    message.includes("submission_queue.official_trace_url") ||
    message.includes("submission_queue.error_code") ||
    message.includes("submission_queue.error_message") ||
    message.includes("vietnam_live_manual_actions")
  );
}

function isMissingFranceLiveSchemaError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("submission_queue.manual_action_status") ||
    message.includes("submission_queue.review_diff_status") ||
    message.includes("submission_queue.official_application_reference_encrypted") ||
    message.includes("submission_manual_actions") ||
    message.includes("fv_accounts")
  );
}

async function getVietnamLiveSchemaBlocker(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { error: queueError } = await admin
    .from("submission_queue")
    .select(
      "id,current_stage,heartbeat_at,vn_result_payload,official_portal_url,official_trace_url,error_code,error_message",
    )
    .limit(1);

  if (queueError) {
    if (isMissingVietnamLiveSchemaError(queueError)) {
      return "Vietnam live assisted is not ready: database migration 0096_vietnam_live_assisted_controls.sql has not been applied to submission_queue.";
    }
    return queueError.message;
  }

  const { error: manualActionError } = await admin
    .from("vietnam_live_manual_actions")
    .select("id")
    .limit(1);

  if (manualActionError) {
    if (isMissingVietnamLiveSchemaError(manualActionError)) {
      return "Vietnam live assisted is not ready: vietnam_live_manual_actions is missing. Apply migration 0096_vietnam_live_assisted_controls.sql before starting live assisted.";
    }
    return manualActionError.message;
  }

  return null;
}

async function getFranceLiveSchemaBlocker(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { error: queueError } = await admin
    .from("submission_queue")
    .select(
      "id,mode,provider,manual_action_status,review_diff_status,official_application_reference_encrypted",
    )
    .limit(1);

  if (queueError) {
    if (isMissingFranceLiveSchemaError(queueError)) {
      return "France live assisted is not ready: submission_queue live columns are missing. Apply the targeted France live schema before starting live assisted.";
    }
    return queueError.message;
  }

  const { error: accountError } = await admin
    .from("fv_accounts")
    .select("id")
    .limit(1);

  if (accountError) {
    if (isMissingFranceLiveSchemaError(accountError)) {
      return "France live assisted is not ready: fv_accounts is missing. Apply the targeted France live schema before starting live assisted.";
    }
    return accountError.message;
  }

  const { error: manualActionError } = await admin
    .from("submission_manual_actions")
    .select("id")
    .limit(1);

  if (manualActionError) {
    if (isMissingFranceLiveSchemaError(manualActionError)) {
      return "France live assisted is not ready: submission_manual_actions is missing. Apply the targeted manual action bridge schema before starting live assisted.";
    }
    return manualActionError.message;
  }

  return null;
}

function firstText(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function answerValueToText(row: { value_text?: unknown; value_json?: unknown }): string | null {
  if (typeof row.value_text === "string" && row.value_text.trim()) return row.value_text.trim();
  const value = row.value_json;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function setAnswerIfMissing(
  answers: Record<string, string>,
  key: string,
  values: Array<string | null | undefined>,
): void {
  if (answers[key]?.trim()) return;
  const value = firstText(values);
  if (value) answers[key] = value;
}

function splitProfileName(fullName: string | null | undefined): {
  givenNames: string | null;
  surname: string | null;
} {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { givenNames: null, surname: null };
  if (parts.length === 1) return { givenNames: null, surname: parts[0] ?? null };
  return {
    givenNames: parts.slice(0, -1).join(" "),
    surname: parts.at(-1) ?? null,
  };
}

function dayDiffInclusive(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  return String(Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1));
}

function normalizeRequirementValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function applyVietnamRetryAliases(
  answers: Record<string, string>,
  profile: ProfileForRetry,
  application: ApplicationForRetry,
): Record<string, string> {
  const profileName = splitProfileName(profile.full_name);
  const arrivalDate = firstText([
    answers.intended_date_of_entry,
    application.arrival_date,
    answers.intended_arrival_date,
    answers.arrival_date,
    answers.planned_arrival_date,
    answers.trip_start_date,
  ]);
  const departureDate = firstText([
    answers.visa_valid_to,
    application.departure_date,
    answers.intended_departure_date,
    answers.departure_date,
    answers.planned_departure_date,
    answers.trip_end_date,
  ]);
  const purpose = firstText([
    answers.purpose_of_entry,
    application.purpose,
    answers.purpose_of_journey,
    answers.main_purpose_of_journey,
    answers.purpose_of_stay,
    answers.purpose_of_visit,
    answers.visit_purpose,
    answers.main_purpose_of_visit,
    answers.purpose_of_trip,
  ]);
  const accommodationName = firstText([
    answers.accommodation_name,
    application.accommodation_name,
    answers.hotel_name,
    answers.hotel_or_accommodation_name,
    answers.host_name,
    answers.business_company_name,
    answers.residential_address_in_vietnam,
  ]);
  const accommodationAddress = firstText([
    answers.residential_address_in_vietnam,
    application.accommodation_address,
    answers.accommodation_address_line_1,
    answers.accommodation_address,
    answers.hotel_address,
    answers.host_address,
  ]);
  const email = firstText([answers.email_address, profile.email, answers.email, answers.contact_email]);
  const phone = firstText([answers.telephone_number, profile.phone, answers.phone, answers.phone_number, answers.mobile_phone]);
  const address = firstText([
    answers.permanent_residential_address,
    profile.address,
    answers.home_address_line_1,
    answers.residential_address_line_1,
    answers.contact_address,
  ]);

  setAnswerIfMissing(answers, "surname", [answers.family_name, answers.last_name, profileName.surname]);
  setAnswerIfMissing(answers, "given_name", [answers.given_names, answers.givenNames, answers.first_name, profileName.givenNames]);
  setAnswerIfMissing(answers, "date_of_birth", [profile.date_of_birth, answers.dob, answers.birth_date]);
  setAnswerIfMissing(answers, "sex", [answers.gender, profile.gender]);
  setAnswerIfMissing(answers, "nationality", [answers.nationality_country, answers.current_nationality, profile.nationality]);
  setAnswerIfMissing(answers, "email_address", [email]);
  setAnswerIfMissing(answers, "re_enter_email_address", [answers.email_address, email]);
  setAnswerIfMissing(answers, "place_of_birth", [profile.place_of_birth, answers.city_of_birth, answers.birth_city]);
  setAnswerIfMissing(answers, "purpose_of_entry", [purpose]);
  setAnswerIfMissing(answers, "visa_valid_from", [answers.intended_date_of_entry, arrivalDate]);
  setAnswerIfMissing(answers, "visa_valid_to", [departureDate]);
  setAnswerIfMissing(answers, "passport_number", [profile.passport_number, answers.travel_document_number]);
  setAnswerIfMissing(answers, "passport_type", [answers.passport_document_type, answers.travel_document_type]);
  setAnswerIfMissing(answers, "passport_issue_date", [profile.passport_issue_date, answers.passport_issuance_date, answers.date_of_issue]);
  setAnswerIfMissing(answers, "passport_expiry_date", [profile.passport_expiry_date, answers.passport_expiration_date, answers.valid_until]);
  setAnswerIfMissing(answers, "permanent_residential_address", [address]);
  setAnswerIfMissing(answers, "contact_address", [answers.mailing_address, address]);
  setAnswerIfMissing(answers, "telephone_number", [phone]);
  setAnswerIfMissing(answers, "intended_date_of_entry", [arrivalDate]);
  setAnswerIfMissing(answers, "intended_length_of_stay", [
    answers.intended_length_of_stay_value,
    dayDiffInclusive(arrivalDate, departureDate),
  ]);
  setAnswerIfMissing(answers, "residential_address_in_vietnam", [accommodationAddress]);
  setAnswerIfMissing(answers, "accommodation_name", [accommodationName]);

  return answers;
}

async function validateVietnamRetryAnswers(input: {
  admin: ReturnType<typeof createAdminClient>;
  applicationId: string;
  profile: ProfileForRetry;
  application: ApplicationForRetry;
}): Promise<VietnamMissingField[] | { error: string }> {
  const { data, error } = await input.admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", input.applicationId);

  if (error) return { error: error.message };

  const answers: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ field_name?: unknown; value_text?: unknown; value_json?: unknown }>) {
    if (typeof row.field_name !== "string") continue;
    const value = answerValueToText(row);
    if (value) answers[row.field_name] = value;
  }

  applyVietnamRetryAliases(answers, input.profile, input.application);

  return VIETNAM_REQUIRED_FIELDS
    .filter((field) => {
      if (!field.condition) return true;
      return normalizeRequirementValue(answers[field.condition.key]) === normalizeRequirementValue(field.condition.equals);
    })
    .filter((field) => !answers[field.key]?.trim())
    .map((field) => ({
      field: field.key,
      labelZh: field.labelZh,
      labelEn: field.labelEn,
    }));
}

function vietnamValidationMessage(mode: SubmissionMode, missing: VietnamMissingField[]): string {
  const prefix = mode === "live_assisted" ? "Live-assisted validation failed" : "Dry-run validation failed";
  const labels = missing.slice(0, 12).map((field) => field.labelZh).join(", ");
  const suffix = missing.length > 12 ? `, +${missing.length - 12} more` : "";
  return `${prefix}: missing ${labels}${suffix}. 请先返回表单补全这些越南 e-Visa 必填信息。`;
}

async function insertRetryQueueRow(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    applicationId: string;
    queueStatus: string;
    mode: SubmissionMode;
    provider: string | null;
    now: string;
  },
): Promise<RetryQueueInsertResult> {
  const { data, error } = await admin.from("submission_queue").insert({
    application_id: input.applicationId,
    status: input.queueStatus,
    mode: input.mode,
    provider: input.provider,
    attempts: 0,
    last_error: null,
    created_at: input.now,
    updated_at: input.now,
  }).select("id").single();
  if (!error) {
    const row = data as { id?: string | null } | null;
    return { error: null, jobId: row?.id ?? null };
  }

  const canUseLegacyPayload =
    isMissingSubmissionModeColumnError(error) &&
    (input.mode === "dry_run" ||
      input.queueStatus === "ds160_live_assisted_pending" ||
      input.queueStatus === "vn_live_assisted_pending");
  if (!canUseLegacyPayload) return { error: error.message, jobId: null };

  const { data: legacyData, error: legacyError } = await admin.from("submission_queue").insert({
    application_id: input.applicationId,
    status: input.queueStatus,
    attempts: 0,
    last_error: null,
    created_at: input.now,
    updated_at: input.now,
  }).select("id").single();
  if (legacyError) return { error: legacyError.message, jobId: null };
  const legacyRow = legacyData as { id?: string | null } | null;
  return { error: null, jobId: legacyRow?.id ?? null };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select(
      "id, auth_user_id, full_name, date_of_birth, place_of_birth, gender, nationality, passport_number, passport_issue_date, passport_expiry_date, email, phone, address",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, arrival_date, departure_date, purpose, accommodation_name, accommodation_address")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const ownedApplication = application as ApplicationForRetry | null;
  if (!ownedApplication) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const ownedProfile = profile as ProfileForRetry;
  if (ownedApplication.applicant_id !== ownedProfile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const requestedSubmission = await readRetrySubmissionRequest(request);
  const mode = requestedSubmission.mode;
  if (!mode) {
    return NextResponse.json(
      { error: "Submission retry mode is required. Choose dry_run or live_assisted." },
      { status: 400 },
    );
  }

  if (!requestedValueMatchesApplication(requestedSubmission.country, ownedApplication.country)) {
    return NextResponse.json(
      { error: "Requested country does not match the application country." },
      { status: 400 },
    );
  }
  if (!requestedValueMatchesApplication(requestedSubmission.visaType, ownedApplication.visa_type)) {
    return NextResponse.json(
      { error: "Requested visa type does not match the application visa type." },
      { status: 400 },
    );
  }

  const queueStatus = queueStatusForApplication(
    ownedApplication.country,
    ownedApplication.visa_type,
    mode,
  );
  const provider = queueProviderForApplication(
    ownedApplication.country,
    ownedApplication.visa_type,
    mode,
  );

  if (mode === "live_assisted") {
    const supportsLiveAssisted =
      isDs160VisaType(ownedApplication.visa_type) ||
      isFranceLiveRetryApplication(ownedApplication.country, ownedApplication.visa_type) ||
      isVietnamEVisaApplication(ownedApplication.country, ownedApplication.visa_type) ||
      isSgArrivalCardApplication(ownedApplication.country, ownedApplication.visa_type);
    if (!provider || !supportsLiveAssisted) {
      return NextResponse.json(
        { error: "Live assisted retry is not supported for this visa type." },
        { status: 400 },
      );
    }
    if (!liveRetryEnabledForApplication(ownedApplication.country, ownedApplication.visa_type)) {
      return NextResponse.json(
        { error: "Live assisted retry is disabled by environment configuration." },
        { status: 403 },
      );
    }
    if (isVietnamEVisaApplication(ownedApplication.country, ownedApplication.visa_type)) {
      const schemaBlocker = await getVietnamLiveSchemaBlocker(admin);
      if (schemaBlocker) {
        return NextResponse.json(
          {
            error: schemaBlocker,
            code: "vietnam_live_schema_not_ready",
          },
          { status: 503 },
        );
      }

      const missing = await validateVietnamRetryAnswers({
        admin,
        applicationId,
        profile: ownedProfile,
        application: ownedApplication,
      });
      if (!Array.isArray(missing)) {
        return NextResponse.json({ error: missing.error }, { status: 500 });
      }
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: vietnamValidationMessage(mode, missing),
            code: "vietnam_validation_failed",
            missingFields: missing,
          },
          { status: 422 },
        );
      }
    }
    if (isFranceLiveRetryApplication(ownedApplication.country, ownedApplication.visa_type)) {
      const schemaBlocker = await getFranceLiveSchemaBlocker(admin);
      if (schemaBlocker) {
        return NextResponse.json(
          {
            error: schemaBlocker,
            code: "france_live_schema_not_ready",
          },
          { status: 503 },
        );
      }

      const { data: existingOfficialRows, error: existingOfficialError } = await admin
        .from("submission_queue")
        .select("id, status, official_application_reference_encrypted")
        .eq("application_id", applicationId)
        .eq("mode", "live_assisted")
        .limit(20);

      if (existingOfficialError) {
        return NextResponse.json({ error: existingOfficialError.message }, { status: 500 });
      }
      const hasOfficialReference = (existingOfficialRows ?? []).some((row) => {
        const bag = row as {
          official_application_reference_encrypted?: string | null;
        };
        return Boolean(bag.official_application_reference_encrypted);
      });
      if (hasOfficialReference) {
        return NextResponse.json(
          {
            error:
              "A France-Visas live job already captured an official reference. Verify the existing official draft before retrying.",
          },
          { status: 409 },
        );
      }
    }
  }

  const { error: supersedeError } = await admin
    .from("submission_queue")
    .update({
      status: "retry_superseded",
      updated_at: now,
    })
    .eq("application_id", applicationId)
    .in("status", RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES);

  if (supersedeError) {
    return NextResponse.json({ error: supersedeError.message }, { status: 500 });
  }

  const queueResult = await insertRetryQueueRow(admin, {
    applicationId,
    queueStatus,
    mode,
    provider,
    now,
  });
  if (queueResult.error) {
    return NextResponse.json({ error: queueResult.error }, { status: 500 });
  }

  const { error: appUpdateError } = await admin
    .from("applications")
    .update({
      status: "submitted",
      submission_result_status: "waiting",
      submission_result: null,
      confirmation_number: null,
      submission_result_updated_at: now,
      updated_at: now,
    })
    .eq("id", applicationId);

  if (appUpdateError) {
    return NextResponse.json({ error: appUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    applicationId,
    jobId: queueResult.jobId,
    queueStatus,
    mode,
    provider,
  });
}
