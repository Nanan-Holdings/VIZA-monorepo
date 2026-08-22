import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildUniversalProfileAnswerPatch,
  type UniversalProfileSnapshot,
} from "@/lib/universal-profile-prefill";
import type { UniversalProfileAnswerRecord } from "@/lib/universal-profile-fields";
import {
  isDedicatedQaApplicantEmail,
  isLocalSupabaseUrl,
} from "@/lib/applications/qa-safety";

type QaTarget = {
  country: string;
  visaType: string;
};

type ReusableAnswerRow = {
  canonical_key: string;
  value_text: string;
  value_zh: string | null;
  value_en: string | null;
  label_zh: string | null;
  label_en: string | null;
  field_type: UniversalProfileAnswerRecord["fieldType"] | null;
  category: UniversalProfileAnswerRecord["category"] | null;
  source_application_id: string | null;
  source_visa_type: string | null;
  source_field_name: string | null;
  updated_at: string | null;
};

const QA_TARGETS: QaTarget[] = [
  { country: "united_states", visaType: "DS160" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR" },
  { country: "australia", visaType: "AU_VISITOR_600" },
  { country: "france", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { country: "japan", visaType: "JP_TOURIST" },
  { country: "vietnam", visaType: "VN_E_VISA" },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA" },
  { country: "egypt", visaType: "EG_E_VISA" },
  { country: "south_korea", visaType: "KR_C39_SHORT_TERM_VISIT" },
  { country: "taiwan", visaType: "TW_ENTRY_PERMIT" },
  { country: "singapore", visaType: "SG_ARRIVAL_CARD" },
  { country: "malaysia", visaType: "MY_MDAC_ARRIVAL_CARD" },
  { country: "thailand", visaType: "TH_TDAC_ARRIVAL_CARD" },
  { country: "philippines", visaType: "PH_ETRAVEL_ARRIVAL_CARD" },
  { country: "philippines", visaType: "PH_ETRAVEL_DEPARTURE_CARD" },
  { country: "vietnam", visaType: "VN_PREARRIVAL_DECLARATION" },
];

function readLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const values: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

function toReusableAnswer(row: ReusableAnswerRow): UniversalProfileAnswerRecord {
  return {
    canonicalKey: row.canonical_key,
    value: row.value_text,
    valueZh: row.value_zh,
    valueEn: row.value_en,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    fieldType: row.field_type,
    category: row.category,
    sourceApplicationId: row.source_application_id,
    sourceVisaType: row.source_visa_type,
    sourceFieldName: row.source_field_name,
    updatedAt: row.updated_at,
  };
}

async function main() {
  const applicantId = readArgument("applicant-id");
  if (!applicantId) {
    throw new Error("Usage: npm run qa:create-schema-drafts -- --applicant-id=<applicant-profile-id>");
  }

  const env = readLocalEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in .env.local");
  }
  if (!isLocalSupabaseUrl(supabaseUrl)) {
    throw new Error(
      "Refusing to create persistent QA drafts outside local Supabase. Use an isolated local database instead of a hosted customer database.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("*")
    .eq("id", applicantId)
    .single();
  if (profileError || !profile?.auth_user_id) {
    throw new Error(profileError?.message ?? "Applicant profile or auth user was not found");
  }
  if (!isDedicatedQaApplicantEmail(profile.email)) {
    throw new Error(
      "Refusing to create QA drafts for a normal applicant. Use a dedicated @viza.test account in local Supabase.",
    );
  }

  const { data: reusableRows, error: reusableError } = await supabase
    .from("universal_profile_answers")
    .select("canonical_key,value_text,value_zh,value_en,label_zh,label_en,field_type,category,source_application_id,source_visa_type,source_field_name,updated_at")
    .eq("auth_user_id", profile.auth_user_id)
    .order("updated_at", { ascending: false });
  if (reusableError) throw new Error(reusableError.message);

  const liveVisaTypes = new Set<string>();
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("visa_type")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) liveVisaTypes.add(row.visa_type);
    if ((data?.length ?? 0) < 1_000) break;
  }

  const expectedVisaTypes = new Set(QA_TARGETS.map((target) => target.visaType));
  const uncovered = [...liveVisaTypes].filter(
    (visaType) => !visaType.startsWith("ID_") && !expectedVisaTypes.has(visaType),
  );
  const missing = [...expectedVisaTypes].filter((visaType) => !liveVisaTypes.has(visaType));
  if (uncovered.length > 0 || missing.length > 0) {
    throw new Error(
      `QA target inventory is stale (uncovered=${uncovered.join(",") || "none"}; missing=${missing.join(",") || "none"})`,
    );
  }

  const reusableAnswers = ((reusableRows ?? []) as ReusableAnswerRow[]).map(toReusableAnswer);
  const profileSnapshot: UniversalProfileSnapshot & Record<string, unknown> = {
    ...profile,
    reusable_answers: reusableAnswers,
  };
  const answerPatch = buildUniversalProfileAnswerPatch(profileSnapshot);
  const answerEntries = Object.entries(answerPatch).filter(([, value]) => value.trim() !== "");
  if (answerEntries.length === 0) throw new Error("Universal Profile did not produce any reusable answers");

  const runId = `schema-qa-${new Date().toISOString()}`;
  const now = new Date().toISOString();
  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .insert(
      QA_TARGETS.map((target) => ({
        applicant_id: applicantId,
        country: target.country,
        visa_type: target.visaType,
        status: "draft",
        purpose: "VIZA_PLACEHOLDER_DRY_RUN",
      })),
    )
    .select("id,country,visa_type");
  if (applicationsError || !applications) {
    throw new Error(applicationsError?.message ?? "Could not create QA drafts");
  }

  const answerRows = applications.flatMap((application) =>
    answerEntries.map(([fieldName, value]) => ({
      application_id: application.id,
      field_name: fieldName,
      value_text: value,
      updated_at: now,
      source: "universal_profile",
      source_profile_updated_at: profile.updated_at ?? null,
      source_metadata: {
        source: "universal_profile",
        profileId: profile.id,
        seededAt: now,
        qaRunId: runId,
      },
    })),
  );

  try {
    for (let offset = 0; offset < answerRows.length; offset += 500) {
      const batch = answerRows.slice(offset, offset + 500);
      const { error } = await supabase
        .from("visa_application_answers")
        .upsert(batch, { onConflict: "application_id,field_name" });
      if (!error) continue;

      const isLegacyAnswerSchema =
        error.message.toLowerCase().includes("schema cache") &&
        ["source", "source_profile_updated_at", "source_metadata"].some((column) =>
          error.message.toLowerCase().includes(column),
        );
      if (!isLegacyAnswerSchema) throw new Error(error.message);

      const fallbackBatch = batch.map((row) => ({
        application_id: row.application_id,
        field_name: row.field_name,
        value_text: row.value_text,
        updated_at: row.updated_at,
      }));
      const { error: fallbackError } = await supabase
        .from("visa_application_answers")
        .upsert(fallbackBatch, { onConflict: "application_id,field_name" });
      if (fallbackError) throw new Error(fallbackError.message);
    }

    const { error: snapshotError } = await supabase
      .from("application_profile_snapshots")
      .insert(
        applications.map((application) => ({
          application_id: application.id,
          applicant_id: applicantId,
          profile_id: profile.id,
          source: "universal_profile",
          profile_updated_at: profile.updated_at ?? null,
          snapshot_json: profileSnapshot,
          answer_keys: answerEntries.map(([fieldName]) => fieldName),
          created_at: now,
        })),
      );
    if (
      snapshotError &&
      !(
        snapshotError.message.toLowerCase().includes("schema cache") &&
        snapshotError.message.toLowerCase().includes("application_profile_snapshots")
      )
    ) {
      throw new Error(snapshotError.message);
    }
  } catch (error) {
    const createdIds = applications.map((application) => application.id);
    const { error: cleanupError } = await supabase.from("applications").delete().in("id", createdIds);
    if (cleanupError) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; cleanup failed: ${cleanupError.message}`,
      );
    }
    throw error;
  }

  const result = applications
    .map((application) => ({
      country: application.country,
      visaType: application.visa_type,
      applicationId: application.id,
      seededAnswerCount: answerEntries.length,
    }))
    .sort((a, b) => a.visaType.localeCompare(b.visaType));

  process.stdout.write(`${JSON.stringify({ runId, applications: result }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
