"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PersonalInfoData } from "@/components/application-steps/personal-info-step";
import type { PassportData } from "@/components/application-steps/passport-step";
import type { TravelInfoData } from "@/components/application-steps/travel-info-step";

/**
 * DS-160 Normalization Layer
 *
 * Takes the simplified form data from hardcoded steps and maps it
 * deterministically into the DS-160 answer key namespace used by
 * the CEAC autofill worker (submission-service/src/ds160-form-mappings.ts).
 *
 * The resulting answer set is persisted to visa_application_answers alongside
 * answers collected by the dynamic form, creating a single unified DS-160
 * answer store keyed by field_name.
 *
 * US-018: Map the complete simplified form deterministically into the DS-160 answer schema
 */

/**
 * Flatten a PersonalInfoData object into DS-160 answer key-value pairs.
 * Deterministic: each hardcoded field maps to exactly one DS-160 key.
 */
function flattenPersonalInfo(data: Partial<PersonalInfoData>): Record<string, string> {
  const answers: Record<string, string> = {};

  if (data.surname) answers.surname = data.surname;
  if (data.givenNames) answers.given_names = data.givenNames;
  if (data.fullNameNativeAlphabet) answers.full_name_native_alphabet = data.fullNameNativeAlphabet;
  if (data.sex) answers.sex = data.sex;
  if (data.maritalStatus) answers.marital_status = data.maritalStatus;
  if (data.dateOfBirth) answers.date_of_birth = data.dateOfBirth;
  if (data.cityOfBirth) answers.city_of_birth = data.cityOfBirth;
  if (data.stateOfBirth) answers.state_of_birth = data.stateOfBirth;
  if (data.countryOfBirth) answers.country_of_birth = data.countryOfBirth;
  if (data.nationality) answers.nationality_country = data.nationality;

  return answers;
}

/**
 * Flatten a PassportData object into DS-160 answer key-value pairs.
 */
function flattenPassport(data: Partial<PassportData>): Record<string, string> {
  const answers: Record<string, string> = {};

  if (data.passportDocumentType) answers.passport_document_type = data.passportDocumentType;
  if (data.passportNumber) answers.passport_number = data.passportNumber;
  if (data.passportBookNumber) answers.passport_book_number = data.passportBookNumber;
  if (data.passportIssuingCountry) answers.passport_issuing_country = data.passportIssuingCountry;
  if (data.passportIssuanceCity) answers.passport_issuance_city = data.passportIssuanceCity;
  if (data.passportIssuanceDate) answers.passport_issuance_date = data.passportIssuanceDate;
  if (data.passportExpirationDate) answers.passport_expiration_date = data.passportExpirationDate;

  return answers;
}

/**
 * Flatten a TravelInfoData object into DS-160 answer key-value pairs.
 * Includes deterministic derived transforms for date parts and length of stay.
 */
function flattenTravel(data: Partial<TravelInfoData>): Record<string, string> {
  const answers: Record<string, string> = {};

  if (data.purposeOfTrip) answers.purpose_of_trip = data.purposeOfTrip;
  if (data.arrivalCity) answers.arrival_city = data.arrivalCity;
  if (data.accommodationName) answers.planned_location = data.accommodationName;
  if (data.usAddressStreet1) {
    answers.us_address_street1 = data.usAddressStreet1;
    answers.us_address_street = data.usAddressStreet1; // CEAC autofill alias
  }
  if (data.usAddressCity) answers.us_address_city = data.usAddressCity;
  if (data.usAddressState) answers.us_address_state = data.usAddressState;
  if (data.usAddressZip) answers.us_address_zip = data.usAddressZip;

  // Deterministic date decomposition: ISO date → day/month/year parts
  if (data.arrivalDate) {
    const d = new Date(data.arrivalDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear());
      answers.arrival_date_day = day;
      answers.arrival_date_month = month;
      answers.arrival_date_year = year;
      answers.intended_arrival_date_day = day;
      answers.intended_arrival_date_month = month;
      answers.intended_arrival_date_year = year;
      answers.intended_arrival_date = data.arrivalDate; // CEAC autofill alias (full date)
    }
  }

  if (data.departureDate) {
    const d = new Date(data.departureDate);
    if (!isNaN(d.getTime())) {
      answers.departure_date_day = String(d.getDate()).padStart(2, "0");
      answers.departure_date_month = String(d.getMonth() + 1).padStart(2, "0");
      answers.departure_date_year = String(d.getFullYear());
    }
  }

  // Deterministic length-of-stay derivation from arrival and departure dates
  if (data.arrivalDate && data.departureDate) {
    const arrival = new Date(data.arrivalDate);
    const departure = new Date(data.departureDate);
    if (!isNaN(arrival.getTime()) && !isNaN(departure.getTime())) {
      const diffMs = departure.getTime() - arrival.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      answers.intended_length_of_stay_value = String(diffDays);
      answers.intended_length_of_stay_unit = "D"; // Days
      answers.intended_length_of_stay = String(diffDays); // CEAC autofill alias
    }
  }

  return answers;
}

/**
 * Flatten all hardcoded step data into a single DS-160 answer record.
 * This is the deterministic transform: no hidden assumptions, no AI inference.
 */
function flattenHardcodedSteps(
  personal: Partial<PersonalInfoData>,
  passport: Partial<PassportData>,
  travel: Partial<TravelInfoData>,
): Record<string, string> {
  return {
    ...flattenPersonalInfo(personal),
    ...flattenPassport(passport),
    ...flattenTravel(travel),
  };
}

/**
 * Persist the complete DS-160 answer set derived from the simplified form.
 *
 * Merges hardcoded step data (after deterministic flattening) with dynamic
 * form answers, then upserts the combined set into visa_application_answers.
 *
 * Dynamic answers take precedence over hardcoded-derived answers for the same
 * field_name, since the dynamic form is the more specific source.
 */
export async function persistDS160AnswerSet(
  applicationId: string,
  personal: Partial<PersonalInfoData>,
  passport: Partial<PassportData>,
  travel: Partial<TravelInfoData>,
): Promise<{ error?: string; fieldCount?: number }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();

    // Verify ownership
    const { data: app } = await adminClient
      .from("applications")
      .select("id, applicant_id")
      .eq("id", applicationId)
      .single();
    if (!app) return { error: "Application not found" };

    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id, auth_user_id, dependant_of_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    if (!profile || (profile.auth_user_id !== user.id && profile.dependant_of_user_id !== user.id)) {
      return { error: "Unauthorized" };
    }

    // Flatten hardcoded step data into DS-160 keys
    const hardcodedAnswers = flattenHardcodedSteps(personal, passport, travel);

    // Load existing dynamic answers (these take precedence)
    const { data: existingRows } = await adminClient
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId);

    const existingDynamic: Record<string, string> = {};
    for (const row of existingRows ?? []) {
      if (row.value_text) existingDynamic[row.field_name] = row.value_text;
    }

    // Merge: hardcoded first, then dynamic overwrites
    const merged = { ...hardcodedAnswers, ...existingDynamic };

    // Upsert the complete answer set
    const upserts = Object.entries(merged)
      .filter(([, v]) => v.trim() !== "")
      .map(([fieldName, value]) => ({
        application_id: applicationId,
        field_name: fieldName,
        value_text: value,
        updated_at: new Date().toISOString(),
      }));

    if (upserts.length > 0) {
      const { error: upsertError } = await adminClient
        .from("visa_application_answers")
        .upsert(upserts, { onConflict: "application_id,field_name" });
      if (upsertError) return { error: upsertError.message };
    }

    return { fieldCount: upserts.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to persist DS-160 answers" };
  }
}
