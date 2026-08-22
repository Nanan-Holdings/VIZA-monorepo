import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeBilingualFormField, normalizeBilingualWizardSteps } from "@/lib/bilingual-schema-contract";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type VisaFormFieldRow,
  type WizardStep,
} from "@/types/visa-form-fields";
import {
  isDedicatedQaApplicantEmail,
  isLocalSupabaseUrl,
} from "@/lib/applications/qa-safety";

const DRY_RUN_PURPOSE = "VIZA_PLACEHOLDER_DRY_RUN";
const PASSPORT_PATH = "/Users/edward/Images/Personal/Passport.jpg";

type ApplicationRow = {
  id: string;
  country: string;
  visa_type: string;
  purpose: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  created_at: string;
};

function readLocalEnv() {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values[trimmed.slice(0, separator)] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function readArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
}

function buildSteps(visaType: string, rows: VisaFormFieldDbRow[]) {
  const stepMap = new Map<number, WizardStep>();
  for (const row of rows) {
    const step = stepMap.get(row.step_number) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(normalizeBilingualFormField(dbRowToFormField(row)));
    stepMap.set(row.step_number, step);
  }
  const base = [...stepMap.values()].sort((a, b) => a.stepNumber - b.stepNumber);
  const vietnamPatched = visaType === "VN_E_VISA" ? augmentVietnamEVisaOfficialParitySteps(base) : base;
  const patched = visaType === "TH_TOURIST_E_VISA"
    ? augmentThailandTouristEVisaSteps(vietnamPatched)
    : vietnamPatched;
  return visaType === "VN_E_VISA" ? normalizeBilingualWizardSteps(patched) : patched;
}

function missingRequiredFields(steps: WizardStep[], answers: Record<string, string>) {
  const allFields = steps.flatMap((step) => step.fields);
  return allFields.filter((field) => {
    if (!field.required || !evaluateShowIf(field, answers, allFields)) return false;
    if (isRequiredUnlessSatisfied(field, answers)) return false;
    const value = answers[field.fieldName]?.trim() ?? "";
    return value === "" || value === "[]" || value === "{}";
  });
}

function optionValue(option: NonNullable<VisaFormFieldRow["options"]>[number]) {
  return typeof option === "string" ? option : option.value;
}

function chooseOption(field: VisaFormFieldRow) {
  const options = field.options?.map(optionValue) ?? [];
  const name = field.fieldName.toLowerCase();
  if (options.includes("yes") && /(declaration|consent|accepted_terms|privacy_agreement)/.test(name)) {
    return "yes";
  }
  if (options.includes("no") && options.includes("yes")) return "no";
  for (const preference of [
    "tourist", "tourism", "ordinary", "regular", "single", "student", "self", "hotel",
    "commercial", "air", "short_term", "english", "C-3-9", "official_search", "SGN",
  ]) {
    if (options.includes(preference)) return preference;
  }
  return options[0] ?? "";
}

function chooseFixtureValue(
  field: VisaFormFieldRow,
  application: ApplicationRow,
  answers: Record<string, string>,
  profile: Record<string, string | null>,
) {
  const name = field.fieldName.toLowerCase();
  const options = field.options?.map(optionValue) ?? [];
  if (application.visa_type.startsWith("PH_ETRAVEL_")) {
    const philippines: Record<string, string> = {
      nationality: "CN",
      country_of_birth: "CN",
      country_of_residence: "SG",
      passport_issuing_authority: "CN",
      occupation: "OCC007",
      destination_country: "SG",
      origin_country: "SG",
      port_of_entry: "TP001",
      destination_address: "VIZA QA DESTINATION ADDRESS, SINGAPORE",
    };
    if (philippines[name]) return philippines[name];
  }
  if (application.visa_type === "SG_ARRIVAL_CARD") {
    const singapore: Record<string, string> = {
      place_of_birth_country: "CHINA",
      place_of_residence: "CHINA, TIANJIN / TIENTSIN, TIANJIN / TIENTSIN",
      accommodation_name: "CARLTON HOTEL",
    };
    if (singapore[name]) return singapore[name];
  }
  if (application.visa_type === "VN_PREARRIVAL_DECLARATION" && name === "visa_number") {
    return "123456789";
  }
  if (application.visa_type === "MY_MDAC_ARRIVAL_CARD" && name === "city") return "1401";
  const exact: Record<string, string> = {
    au_immi_username: answers.email_address || profile.email || "viza-qa@example.invalid",
    au_immi_password: "VIZA_QA_LOCAL_ONLY_NOT_A_REAL_PASSWORD",
    air_transport_type: "commercial",
    departure_airport: "TP001",
    flight_number: "other",
    border_gate_airport: "SGN",
    province_city_of_hotel: "Ho Chi Minh City",
    ward_commune_of_hotel: "Ben Nghe Ward",
    hotel_accommodation_address: "other",
    custom_hotel_accommodation_address: application.accommodation_address || "VIZA QA HOTEL ADDRESS",
    phone_country_code: "+65",
    stream: "tourist",
    current_location_legal_status: "student",
    purpose_of_stay_initial: "tourism",
    residency_status: "temporary_resident",
    relationship_status: "never_married",
    marital_status: "single",
    intended_entries: "single",
    first_port_of_arrival: "sydney",
    funding_source: "self",
    funds_currency: "AUD",
    current_employment_status: "student",
    applying_consulate: "china_embassy",
    period_of_stay: "short_term",
    status_of_stay: "C-3-9",
    passport_type: application.visa_type === "KR_C39_SHORT_TERM_VISIT" ? "regular" : "ordinary",
    purpose_of_visit: application.visa_type === "KR_C39_SHORT_TERM_VISIT" ? "tourism_transit" : "tourism",
    expected_korea_visit_count: "single",
    korea_address_mode: "undecided",
    continent: "A",
    embassy_office: "50",
    permit_type: "1",
    permit_count: "1",
    eligibility_category: "1",
    birth_place_is_mainland: "mainland",
    tw_contact_city: "1",
    immigration_status_in_residence_country: "temporaryVisa",
    home_ownership: "rent",
    spoken_language_preference: "english",
    planned_spend_currency: "GBP",
    employment_status: "student",
    who_is_paying: "self",
    monthly_outgoings_currency: "GBP",
    tb_test_required_acknowledged: "no",
    purpose_of_entry: "tourist",
    visa_type_requested: "single",
    accommodation_type: "hotel",
    expense_bearer: "self",
    travel_document_type: "ordinary",
    number_of_entries_requested: "single",
    cost_covered_by: "self",
  };
  if (exact[name]) return exact[name];
  if (field.fieldType === "checkbox") return "true";
  if (options.length > 0) return chooseOption(field);
  if (field.fieldType === "file") return PASSPORT_PATH;
  if (field.fieldType === "country") {
    if (/(nationality|issuing|birth)/.test(name)) return "CHN";
    if (/(first_entry|destination)/.test(name)) return application.country.toUpperCase();
    return "SGP";
  }
  if (field.fieldType === "date") {
    if (/(arrival|entry|departure_from_origin)/.test(name)) return application.arrival_date || "2026-10-10";
    if (/(departure|leave)/.test(name)) return application.departure_date || "2026-10-20";
    if (/(application|declaration|signature)/.test(name)) return "2026-08-02";
    if (/(father|mother)/.test(name)) return "1900-01-01";
    return "2026-08-02";
  }
  if (/(email|username)/.test(name)) return answers.email_address || profile.email || "viza-qa@example.invalid";
  if (/(mobile|phone|telephone)/.test(name)) return profile.phone || "+6590000000";
  if (name.includes("father")) return "UNKNOWN";
  if (name.includes("mother") && name.includes("given")) return "XIAOJIE";
  if (name.includes("mother") && name.includes("surname")) return "XIN";
  if (name.includes("mother") && name.includes("name")) return "XIAOJIE XIN";
  if (/(full_name|name_english|signature_full_name)/.test(name)) return "ZEHUA ZHANG";
  if (name === "name_chinese") return "VIZA QA PLACEHOLDER";
  if (/(address_line_1|home_address|residential_address|overseas_address)/.test(name)) {
    return profile.address || "VIZA QA RESIDENTIAL ADDRESS";
  }
  if (/(accommodation_name|destination_hotel_name)/.test(name)) {
    return application.accommodation_name || "VIZA QA HOTEL";
  }
  if (/(accommodation_address|destination_hotel_address)/.test(name)) {
    return application.accommodation_address || "VIZA QA HOTEL ADDRESS";
  }
  if (/(amount|cost|funds|money|outgoings)/.test(name)) return "1000";
  if (/(duration|length|period|years|how_long|count)/.test(name)) return "1";
  if (name.includes("city") || name.includes("suburb")) return "SINGAPORE";
  if (name.includes("state")) return "SG";
  if (name.includes("zip") || name.includes("postal")) return "119077";
  if (name.includes("town_of_birth")) return "TIANJIN";
  if (name.includes("passport_no")) return profile.passport_number || "VIZA-QA-PASSPORT";
  return "VIZA QA PLACEHOLDER";
}

async function main() {
  const applicantId = readArgument("applicant-id");
  const createdAfter = readArgument("created-after");
  if (!applicantId || !createdAfter) {
    throw new Error(
      "Usage: npm run qa:fill-schema-drafts -- --applicant-id=<id> --created-after=<ISO timestamp>",
    );
  }
  const env = readLocalEnv();
  if (!isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error(
      "Refusing to fill persistent QA drafts outside local Supabase. Use an isolated local database instead of a hosted customer database.",
    );
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("email,phone,address,passport_number")
    .eq("id", applicantId)
    .single();
  if (profileError || !profile) throw new Error(profileError?.message ?? "Applicant profile not found");
  if (!isDedicatedQaApplicantEmail(profile.email)) {
    throw new Error(
      "Refusing to fill QA drafts for a normal applicant. Use a dedicated @viza.test account in local Supabase.",
    );
  }

  const { data: rows, error: applicationError } = await supabase
    .from("applications")
    .select("id,country,visa_type,purpose,arrival_date,departure_date,accommodation_name,accommodation_address,created_at")
    .eq("applicant_id", applicantId)
    .eq("purpose", DRY_RUN_PURPOSE)
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false });
  if (applicationError) throw new Error(applicationError.message);
  const latestByVisaType = new Map<string, ApplicationRow>();
  for (const row of (rows ?? []) as ApplicationRow[]) {
    if (!latestByVisaType.has(row.visa_type)) latestByVisaType.set(row.visa_type, row);
  }
  const applications = [...latestByVisaType.values()];
  if (applications.length === 0) throw new Error("No matching dry-run QA drafts were found");
  if (applications.some((application) => application.purpose !== DRY_RUN_PURPOSE)) {
    throw new Error("Refusing to fill an application that is not a VIZA dry-run QA draft");
  }

  const formRows: VisaFormFieldDbRow[] = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("*")
      .in("visa_type", applications.map((application) => application.visa_type))
      .order("visa_type")
      .order("step_number")
      .order("display_order")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    formRows.push(...((data ?? []) as VisaFormFieldDbRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const results: Array<{ visaType: string; inserted: number; remaining: number }> = [];
  for (const application of applications) {
    const steps = buildSteps(application.visa_type, formRows.filter((row) => row.visa_type === application.visa_type));
    const { data: existingRows, error: answerError } = await supabase
      .from("visa_application_answers")
      .select("field_name,value_text")
      .eq("application_id", application.id);
    if (answerError) throw new Error(answerError.message);
    const answers = Object.fromEntries((existingRows ?? []).map((row) => [row.field_name, row.value_text ?? ""]));
    if (application.visa_type === "DS160") {
      answers.father_dob_unknown = "true";
      answers.mother_dob_unknown = "true";
      answers.intended_length_of_stay_unit ||= "DAY(S)";
      const { error } = await supabase.from("visa_application_answers").upsert(
        [
          { application_id: application.id, field_name: "father_dob_unknown", value_text: answers.father_dob_unknown },
          { application_id: application.id, field_name: "mother_dob_unknown", value_text: answers.mother_dob_unknown },
          {
            application_id: application.id,
            field_name: "intended_length_of_stay_unit",
            value_text: answers.intended_length_of_stay_unit,
          },
        ],
        { onConflict: "application_id,field_name" },
      );
      if (error) throw new Error(`${application.visa_type}: ${error.message}`);
    }

    let inserted = 0;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const missing = missingRequiredFields(steps, answers);
      if (missing.length === 0) break;
      const updates = missing.map((field) => ({
        application_id: application.id,
        field_name: field.fieldName,
        value_text: chooseFixtureValue(field, application, answers, profile),
        updated_at: new Date().toISOString(),
      }));
      for (const update of updates) answers[update.field_name] = update.value_text;
      const { error } = await supabase
        .from("visa_application_answers")
        .upsert(updates, { onConflict: "application_id,field_name" });
      if (error) throw new Error(`${application.visa_type}: ${error.message}`);
      inserted += updates.length;
    }
    results.push({ visaType: application.visa_type, inserted, remaining: missingRequiredFields(steps, answers).length });
  }
  process.stdout.write(`${JSON.stringify(results.sort((a, b) => a.visaType.localeCompare(b.visaType)), null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
