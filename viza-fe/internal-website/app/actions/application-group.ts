"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildUniversalProfileAnswerPatch,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import type { FrequentTravelerInput } from "@/app/actions/client-settings";

/**
 * Family / multi-applicant application group (PRODUCT-002).
 *
 * One payer creates N applications under a single Stripe checkout. Each
 * applicant gets its own answer set, doc upload, face-match, and audit
 * trail — only the billing is shared.
 */

export interface CreateGroupInput {
  visaPackageId: string;
  label?: string;
  /** One row per family member; the first entry is the payer themselves. */
  members: Array<{
    surname: string;
    given_names: string;
    is_payer: boolean;
  }>;
}

export interface CreateGroupResult {
  ok: boolean;
  groupId?: string;
  applicationIds?: string[];
  reason?: string;
}

export interface TeamCompanionSummary {
  applicationId: string;
  applicantId: string;
  fullName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  status: string;
  submittedAt: string | null;
  submissionResultStatus: string | null;
}

export interface TeamCompanionListResult {
  ok: boolean;
  groupId?: string | null;
  companions?: TeamCompanionSummary[];
  reason?: string;
}

export interface CreateTeamCompanionInput {
  applicationId: string;
  travelerId?: string;
  traveler?: FrequentTravelerInput;
}

export interface CreateTeamCompanionResult {
  ok: boolean;
  applicationId?: string;
  reason?: string;
}

export interface DeleteTeamCompanionResult {
  ok: boolean;
  reason?: string;
}

export interface MarkTeamCompanionReviewedResult {
  ok: boolean;
  reason?: string;
}

export interface TeamApplicationContextResult {
  ok: boolean;
  application?: {
    id: string;
    status: string | null;
    country: string | null;
    visa_type: string | null;
    confirmation_number: string | null;
    submitted_at: string | null;
    submission_result: unknown | null;
    submission_result_status: string | null;
    arrival_date: string | null;
    departure_date: string | null;
    port_of_entry: string | null;
    purpose: string | null;
    accommodation_name: string | null;
    accommodation_address: string | null;
  };
  profile?: {
    id: string;
    full_name: string | null;
    date_of_birth: string | null;
    place_of_birth: string | null;
    gender: string | null;
    nationality: string | null;
    occupation: string | null;
    address: string | null;
    passport_number: string | null;
    passport_issue_date: string | null;
    passport_expiry_date: string | null;
    passport_issuing_country: string | null;
    passport_issuing_authority: string | null;
    email: string | null;
    phone: string | null;
  };
  reason?: string;
}

const COPY_EXCLUDE_FIELDS = new Set(["photo_path", "photo_status"]);

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTravelerInput(input: FrequentTravelerInput) {
  const fullName = input.fullName?.trim();
  if (!fullName) return { error: "Traveler name is required." };
  return {
    value: {
      full_name: fullName,
      date_of_birth: cleanOptional(input.dateOfBirth),
      nationality: cleanOptional(input.nationality),
      passport_number: cleanOptional(input.passportNumber),
      passport_expiry_date: cleanOptional(input.passportExpiryDate),
      email: cleanOptional(input.email),
      phone: cleanOptional(input.phone),
      updated_at: new Date().toISOString(),
    },
  };
}

function toProfileSnapshot(profile: {
  full_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  passport_expiry_date?: string | null;
  passport_issuing_country?: string | null;
  passport_issuing_authority?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
}): UniversalProfileSnapshot {
  return {
    full_name: profile.full_name ?? null,
    date_of_birth: profile.date_of_birth ?? null,
    nationality: profile.nationality ?? null,
    passport_number: profile.passport_number ?? null,
    passport_expiry_date: profile.passport_expiry_date ?? null,
    passport_issuing_country: profile.passport_issuing_country ?? null,
    passport_issuing_authority: profile.passport_issuing_authority ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    address: profile.address ?? null,
    occupation: profile.occupation ?? null,
  };
}

function shouldCopyAnswer(fieldName: string) {
  if (fieldName.startsWith("__")) return false;
  if (fieldName.startsWith("photo_")) return false;
  if (COPY_EXCLUDE_FIELDS.has(fieldName)) return false;
  return true;
}

async function getAuthorizedApplication(adminClient: ReturnType<typeof createAdminClient>, applicationId: string, userId: string) {
  const { data: app } = await adminClient
    .from("applications")
    .select(
      "id, applicant_id, group_id, country, visa_type, visa_package_id, status, confirmation_number, submitted_at, submission_result, submission_result_status, arrival_date, departure_date, port_of_entry, purpose, accommodation_name, accommodation_address"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { error: "Application not found" } as const;

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", app.applicant_id)
    .maybeSingle();

  if (!profile) return { error: "Applicant profile not found" } as const;

  if (profile.auth_user_id !== userId && profile.dependant_of_user_id !== userId) {
    return { error: "Unauthorized" } as const;
  }

  return { app, profile } as const;
}

async function resolveVisaPackageId(adminClient: ReturnType<typeof createAdminClient>, userId: string, existingId: string | null) {
  if (existingId) return existingId;

  const { data: pkg } = await adminClient
    .from("user_packages")
    .select("visa_package_id")
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (pkg?.visa_package_id as string | null) ?? null;
}

export async function createApplicationGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  if (input.members.length === 0) return { ok: false, reason: "At least one member required" };
  if (input.members.length > 10) return { ok: false, reason: "Max 10 applicants per group" };
  if (!input.members.some((m) => m.is_payer)) {
    return { ok: false, reason: "Exactly one member must be the payer" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };
  const adminClient = createAdminClient();

  const { data: pkg } = await adminClient
    .from("visa_packages")
    .select("id, country, visa_type, price_cents, currency")
    .eq("id", input.visaPackageId)
    .eq("is_active", true)
    .maybeSingle();
  if (!pkg) return { ok: false, reason: "Package not found or inactive" };

  const total = (pkg.price_cents as number | null ?? 0) * input.members.length;

  const { data: group, error: groupErr } = await adminClient
    .from("application_group")
    .insert({
      payer_user_id: user.id,
      visa_package_id: input.visaPackageId,
      label: input.label ?? null,
      total_amount_cents: total,
      currency: (pkg.currency as string | null) ?? "USD",
    })
    .select("id")
    .single();
  if (groupErr || !group) return { ok: false, reason: groupErr?.message ?? "group insert failed" };

  // Each member gets a fresh applicant_profile + applications row.
  const applicationIds: string[] = [];
  for (const m of input.members) {
    let applicantProfileId: string;
    if (m.is_payer) {
      const { data: existingPayerProfile } = await adminClient
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (existingPayerProfile) {
        applicantProfileId = existingPayerProfile.id as string;
      } else {
        const { data: newProfile, error: profErr } = await adminClient
          .from("applicant_profiles")
          .insert({ auth_user_id: user.id, full_name: `${m.given_names} ${m.surname}`.trim() })
          .select("id")
          .single();
        if (profErr || !newProfile) {
          return { ok: false, reason: profErr?.message ?? "payer profile insert failed" };
        }
        applicantProfileId = newProfile.id as string;
      }
    } else {
      const { data: childProfile, error: childErr } = await adminClient
        .from("applicant_profiles")
        .insert({
          /* Dependant profile — no auth_user_id; managed by payer only. */
          full_name: `${m.given_names} ${m.surname}`.trim(),
          dependant_of_user_id: user.id,
        })
        .select("id")
        .single();
      if (childErr || !childProfile) {
        return { ok: false, reason: childErr?.message ?? "dependant profile insert failed" };
      }
      applicantProfileId = childProfile.id as string;
    }
    const { data: app, error: appErr } = await adminClient
      .from("applications")
      .insert({
        applicant_id: applicantProfileId,
        country: pkg.country,
        visa_type: pkg.visa_type,
        status: "draft",
        visa_package_id: pkg.id,
        group_id: group.id,
      })
      .select("id")
      .single();
    if (appErr || !app) return { ok: false, reason: appErr?.message ?? "application insert failed" };
    applicationIds.push(app.id as string);
  }

  return { ok: true, groupId: group.id as string, applicationIds };
}

export async function listMyGroups() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("application_group")
    .select(
      "id, label, total_amount_cents, currency, created_at, applications:applications!group_id(id, applicant_id, status)",
    )
    .eq("payer_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { rows: data ?? [] };
}

export async function listTeamCompanions(applicationId: string): Promise<TeamCompanionListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const resolved = await getAuthorizedApplication(adminClient, applicationId, user.id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };

  const groupId = resolved.app.group_id as string | null;
  if (!groupId) return { ok: true, groupId: null, companions: [] };

  const { data, error } = await adminClient
    .from("applications")
    .select(
      "id, applicant_id, status, submitted_at, submission_result_status, applicant_profiles(full_name, date_of_birth, nationality, passport_number, passport_expiry_date)"
    )
    .eq("group_id", groupId)
    .neq("id", resolved.app.id)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, reason: error.message };

  const companions = (data ?? []).map((row) => {
    const profile = Array.isArray(row.applicant_profiles)
      ? row.applicant_profiles[0]
      : row.applicant_profiles;
    return {
      applicationId: row.id as string,
      applicantId: row.applicant_id as string,
      fullName: (profile?.full_name as string | null) ?? "",
      dateOfBirth: (profile?.date_of_birth as string | null) ?? null,
      nationality: (profile?.nationality as string | null) ?? null,
      passportNumber: (profile?.passport_number as string | null) ?? null,
      passportExpiryDate: (profile?.passport_expiry_date as string | null) ?? null,
      status: (row.status as string | null) ?? "draft",
      submittedAt: (row.submitted_at as string | null) ?? null,
      submissionResultStatus: (row.submission_result_status as string | null) ?? null,
    } satisfies TeamCompanionSummary;
  });

  return { ok: true, groupId, companions };
}

export async function getTeamApplicationContext(applicationId: string): Promise<TeamApplicationContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const resolved = await getAuthorizedApplication(adminClient, applicationId, user.id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };

  const { data: profile, error } = await adminClient
    .from("applicant_profiles")
    .select(
      "id, full_name, date_of_birth, place_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, passport_issuing_authority, email, phone"
    )
    .eq("id", resolved.app.applicant_id)
    .maybeSingle();

  if (error || !profile) return { ok: false, reason: error?.message ?? "Profile not found" };

  return {
    ok: true,
    application: {
      id: resolved.app.id as string,
      status: (resolved.app.status as string | null) ?? null,
      country: (resolved.app.country as string | null) ?? null,
      visa_type: (resolved.app.visa_type as string | null) ?? null,
      confirmation_number: (resolved.app.confirmation_number as string | null) ?? null,
      submitted_at: (resolved.app.submitted_at as string | null) ?? null,
      submission_result: (resolved.app.submission_result as unknown | null) ?? null,
      submission_result_status: (resolved.app.submission_result_status as string | null) ?? null,
      arrival_date: (resolved.app.arrival_date as string | null) ?? null,
      departure_date: (resolved.app.departure_date as string | null) ?? null,
      port_of_entry: (resolved.app.port_of_entry as string | null) ?? null,
      purpose: (resolved.app.purpose as string | null) ?? null,
      accommodation_name: (resolved.app.accommodation_name as string | null) ?? null,
      accommodation_address: (resolved.app.accommodation_address as string | null) ?? null,
    },
    profile: profile as TeamApplicationContextResult["profile"],
  };
}

export async function createTeamCompanion(
  input: CreateTeamCompanionInput
): Promise<CreateTeamCompanionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const resolved = await getAuthorizedApplication(adminClient, input.applicationId, user.id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };

  const visaPackageId = await resolveVisaPackageId(
    adminClient,
    user.id,
    (resolved.app.visa_package_id as string | null) ?? null,
  );
  if (!visaPackageId) return { ok: false, reason: "Visa package not found" };

  let groupId = resolved.app.group_id as string | null;
  if (!groupId) {
    const { data: group, error: groupError } = await adminClient
      .from("application_group")
      .insert({
        payer_user_id: user.id,
        visa_package_id: visaPackageId,
        label: null,
      })
      .select("id")
      .single();

    if (groupError || !group) return { ok: false, reason: groupError?.message ?? "Group creation failed" };

    const { error: updateError } = await adminClient
      .from("applications")
      .update({ group_id: group.id })
      .eq("id", resolved.app.id);

    if (updateError) return { ok: false, reason: updateError.message };

    groupId = group.id as string;
  }

  let companionProfileId: string;
  let companionProfileSnapshot: UniversalProfileSnapshot | null = null;

  if (input.travelerId) {
    const { data: existingTraveler, error: travelerError } = await adminClient
      .from("applicant_profiles")
      .select(
        "id, full_name, date_of_birth, nationality, passport_number, passport_expiry_date, passport_issuing_country, passport_issuing_authority, email, phone, address, occupation"
      )
      .eq("id", input.travelerId)
      .eq("dependant_of_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (travelerError || !existingTraveler) {
      return { ok: false, reason: travelerError?.message ?? "Traveler not found" };
    }

    companionProfileId = existingTraveler.id as string;
    companionProfileSnapshot = toProfileSnapshot(existingTraveler);
  } else if (input.traveler) {
    const normalized = normalizeTravelerInput(input.traveler);
    if ("error" in normalized) return { ok: false, reason: normalized.error };

    const { data: newProfile, error: newProfileError } = await adminClient
      .from("applicant_profiles")
      .insert({
        ...normalized.value,
        dependant_of_user_id: user.id,
        auth_user_id: null,
        language_pref: "zh",
        onboarding_done: true,
      })
      .select(
        "id, full_name, date_of_birth, nationality, passport_number, passport_expiry_date, email, phone"
      )
      .single();

    if (newProfileError || !newProfile) {
      return { ok: false, reason: newProfileError?.message ?? "Traveler creation failed" };
    }

    companionProfileId = newProfile.id as string;
    companionProfileSnapshot = toProfileSnapshot(newProfile);
  } else {
    return { ok: false, reason: "Traveler details required" };
  }

  const { data: newApplication, error: appError } = await adminClient
    .from("applications")
    .insert({
      applicant_id: companionProfileId,
      group_id: groupId,
      status: "draft",
      country: resolved.app.country,
      visa_type: resolved.app.visa_type,
      visa_package_id: visaPackageId,
      arrival_date: resolved.app.arrival_date,
      departure_date: resolved.app.departure_date,
      port_of_entry: resolved.app.port_of_entry,
      purpose: resolved.app.purpose,
      accommodation_name: resolved.app.accommodation_name,
      accommodation_address: resolved.app.accommodation_address,
    })
    .select("id")
    .single();

  if (appError || !newApplication) return { ok: false, reason: appError?.message ?? "Application creation failed" };

  const { data: answerRows } = await adminClient
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", resolved.app.id);

  const sharedAnswers: Record<string, string> = {};
  for (const row of answerRows ?? []) {
    if (!row.value_text) continue;
    if (!shouldCopyAnswer(row.field_name)) continue;
    sharedAnswers[row.field_name] = row.value_text;
  }

  const companionPatch = buildUniversalProfileAnswerPatch(companionProfileSnapshot);
  const merged = { ...sharedAnswers, ...companionPatch };
  const upserts = Object.entries(merged)
    .filter(([, value]) => value.trim() !== "")
    .map(([fieldName, value]) => ({
      application_id: newApplication.id,
      field_name: fieldName,
      value_text: value,
      updated_at: new Date().toISOString(),
    }));

  if (upserts.length > 0) {
    const { error: upsertError } = await adminClient
      .from("visa_application_answers")
      .upsert(upserts, { onConflict: "application_id,field_name" });
    if (upsertError) return { ok: false, reason: upsertError.message };
  }

  return { ok: true, applicationId: newApplication.id as string };
}

export async function deleteTeamCompanion(
  applicationId: string,
  companionApplicationId: string
): Promise<DeleteTeamCompanionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const resolved = await getAuthorizedApplication(adminClient, applicationId, user.id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };

  const groupId = resolved.app.group_id as string | null;
  if (!groupId) return { ok: false, reason: "No team group found" };
  if (companionApplicationId === resolved.app.id) {
    return { ok: false, reason: "Cannot delete the main application" };
  }

  const { error } = await adminClient
    .from("applications")
    .delete()
    .eq("id", companionApplicationId)
    .eq("group_id", groupId);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function markTeamCompanionReviewed(
  applicationId: string
): Promise<MarkTeamCompanionReviewedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const resolved = await getAuthorizedApplication(adminClient, applicationId, user.id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };

  const { error } = await adminClient
    .from("applications")
    .update({
      status: "ready_for_submission",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
