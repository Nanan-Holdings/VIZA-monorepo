import { makeStandardEvisaRunner } from "../runners/standard-evisa.js";
import { CA_FIELD_MAPPINGS } from "./field-mappings.js";

/**
 * Canada eTA/TRV runner (RUN-CA-001). Built on the shared standard-e-Visa
 * core. Payment remains staff-review-only until official payment controls are
 * evidenced by recon.
 */
const runner = makeStandardEvisaRunner({
  cc: "ca",
  country: "canada",
  baseUrlEnv: "CA_PORTAL_URL",
  baseUrlDefault: "https://onlineservices-servicesenligne.cic.gc.ca/eta",
  defaultVisaType: "CA_TRV",
  mappings: CA_FIELD_MAPPINGS,
});

export const runCaRunner = runner.runRunner;
export const runOne = runner.runOne;
