import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const applicationId = argValue("--application-id") ?? process.env.TW_PREFLIGHT_APPLICATION_ID;
  if (!applicationId) {
    throw new Error("usage: tsx scripts/run-tw-formal-preflight.ts --application-id <uuid>");
  }

  const [{ supabase }, { normalizeTwAnswers, runTwFormalRunnerPreflight }] = await Promise.all([
    import("../src/supabase.js"),
    import("../src/tw/index.js"),
  ]);

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) throw new Error(`application lookup failed: ${appErr?.message ?? "not found"}`);

  const { data: profile, error: profileErr } = await supabase
    .from("applicant_profiles")
    .select("*")
    .eq("id", (app as { applicant_id: string }).applicant_id)
    .single();
  if (profileErr || !profile) throw new Error(`profile lookup failed: ${profileErr?.message ?? "not found"}`);

  const { data: rows, error: answersErr } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (answersErr) throw new Error(`answers lookup failed: ${answersErr.message}`);

  const answerMap: Record<string, string> = {};
  for (const row of (rows ?? []) as { field_name: string; value_text: string | null }[]) {
    if (row.value_text != null) answerMap[row.field_name] = row.value_text;
  }
  const answers = normalizeTwAnswers({ answers: answerMap, profile });

  const result = await runTwFormalRunnerPreflight({
    answers: {
      continent: answers.continent,
      embassy_office: answers.embassy_office,
    },
  });

  if (result.status === "passed") {
    console.log(JSON.stringify({
      status: result.status,
      phases: result.phases,
      durationMs: result.durationMs,
      urlPath: result.urlPath,
      selectedControlCount: result.selectedControls.length,
      tracePath: result.tracePath,
      screenshotPath: result.screenshotPath,
    }, null, 2));
    return;
  }

  console.error(JSON.stringify({
    status: result.status,
    phase: result.phase,
    durationMs: result.durationMs,
    diagnostic: result.diagnostic,
  }, null, 2));
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: "failed",
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});
