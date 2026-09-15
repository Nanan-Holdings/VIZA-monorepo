import { runUSAppointmentPlaceholderFlow } from "../src/us-appointment/testing/placeholder-flow";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--headed")) {
  console.error("Usage: npm run us-appointment:placeholder-flow -- [--headed]. Local simulation only; no account or target URL options.");
  process.exitCode = 1;
} else {
  runUSAppointmentPlaceholderFlow({ headed: args.includes("--headed") }).then(({ outputDirectory }) => {
    console.log(`SIMULATION passed. No official appointment created. Report: ${outputDirectory}/result.json`);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Placeholder simulation failed.");
    process.exitCode = 1;
  });
}
