import { makeStandardEvisaRunner } from "../runners/standard-evisa.js";
import { CA_FIELD_MAPPINGS } from "./field-mappings.js";

/**
 * Canada eTA/TRV runner (RUN-CA-001). Built on the shared standard-e-Visa
 * core. Canada routing is `client_in_portal` (applicant pays in-portal), so
 * the runner fills then HALTS before the payment step. Best-effort selectors
 * pending recon (form-recon.ts + DATA-001).
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
