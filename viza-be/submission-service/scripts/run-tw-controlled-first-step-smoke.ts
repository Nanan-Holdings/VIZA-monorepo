import {
  runTwControlledFirstStepSmoke,
  TW_CONTROLLED_SMOKE_DEFAULT_ANSWERS,
  waitForTwControlledSmokeInspection,
} from "../src/tw/controlled-smoke";

async function main(): Promise<void> {
  const result = await runTwControlledFirstStepSmoke({
    headless: false,
    runId: `tw-controlled-smoke-${Date.now()}`,
    answers: {
      continent: process.env.TW_SMOKE_CONTINENT ?? TW_CONTROLLED_SMOKE_DEFAULT_ANSWERS.continent,
      embassy_office: process.env.TW_SMOKE_EMBASSY_OFFICE ?? TW_CONTROLLED_SMOKE_DEFAULT_ANSWERS.embassy_office,
    },
    waitForInspection: waitForTwControlledSmokeInspection,
  });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        url: result.url,
        filledFields: result.fieldAudit.map((entry) => entry.fieldName),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
