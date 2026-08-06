import "dotenv/config";
import { supabase } from "../src/supabase";
import { buildCountrySubmissionApplication } from "../src/country-submissions/from-records";
import {
  getCountrySubmissionProvider,
  runDryRunSubmission,
} from "../src/country-submissions/registry";
import type { ApplicantProfile, Application } from "../src/types";

function readArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
}

async function main() {
  const applicantId = readArgument("applicant-id");
  const createdAfter = readArgument("created-after");
  if (!applicantId || !createdAfter) {
    throw new Error(
      "Usage: npm run qa:active-schema-dry-runs -- --applicant-id=<id> --created-after=<ISO timestamp>",
    );
  }

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id,applicant_id,country,visa_type,status,arrival_date,departure_date,port_of_entry,purpose,accommodation_name,accommodation_address,confirmation_number,submitted_at,visa_package_id,ds160_application_id,ds160_retrieval_url,ds160_dat_storage_path,created_at")
    .eq("applicant_id", applicantId)
    .eq("purpose", "VIZA_PLACEHOLDER_DRY_RUN")
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false });
  if (applicationsError) throw new Error(applicationsError.message);

  const latestByVisaType = new Map<string, Application>();
  for (const row of applicationRows ?? []) {
    if (!latestByVisaType.has(row.visa_type)) latestByVisaType.set(row.visa_type, row as Application);
  }
  const applications = [...latestByVisaType.values()];
  if (applications.length === 0) throw new Error("No matching dry-run QA applications were found");

  const { data: profileRow, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("id,auth_user_id,full_name,date_of_birth,place_of_birth,gender,nationality,occupation,address,passport_number,passport_issue_date,passport_expiry_date,passport_issuing_country,passport_issuing_authority,email,phone,wechat")
    .eq("id", applicantId)
    .single();
  if (profileError || !profileRow) throw new Error(profileError?.message ?? "Applicant profile was not found");
  const profile: ApplicantProfile = {
    ...profileRow,
    issuing_country: profileRow.passport_issuing_country,
    issuing_authority: profileRow.passport_issuing_authority,
  };

  const applicationIds = applications.map((application) => application.id);
  const answerRows: Array<{ application_id: string; field_name: string; value_text: string | null; value_json: unknown }> = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_application_answers")
      .select("application_id,field_name,value_text,value_json")
      .in("application_id", applicationIds)
      .order("application_id")
      .order("field_name")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    answerRows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const results = await Promise.all(
    applications.map(async (application) => {
      const answers = Object.fromEntries(
        answerRows
          .filter((row) => row.application_id === application.id)
          .map((row) => [
            row.field_name,
            row.value_json == null ? row.value_text ?? "" : String(row.value_json),
          ]),
      );
      const submissionApplication = buildCountrySubmissionApplication(profile, application, answers);
      const provider = getCountrySubmissionProvider(application.country, application.visa_type);
      const validation = provider?.validate(submissionApplication) ?? null;
      const result = await runDryRunSubmission(submissionApplication, {
        dryRun: true,
        idempotencyKey: `active-schema-qa:${application.id}`,
      });
      return {
        country: application.country,
        visaType: application.visa_type,
        applicationId: application.id,
        provider: provider?.displayName ?? null,
        implementationStatus: provider?.implementationStatus ?? "not_started",
        validationOk: validation?.ok ?? false,
        missingProviderFields: validation?.missingRequiredFields ?? ["provider"],
        dryRunStatus: result.status,
        dryRunMode: result.mode,
      };
    }),
  );

  process.stdout.write(`${JSON.stringify(results.sort((a, b) => a.visaType.localeCompare(b.visaType)), null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
