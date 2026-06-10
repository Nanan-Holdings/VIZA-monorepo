import { makeStandardEvisaRunner } from "../runners/standard-evisa.js";
import { TR_FIELD_MAPPINGS } from "./field-mappings.js";

/**
 * Türkiye e-Visa runner (RUN-TR-001) on the shared core. Türkiye routing is
 * runner_escrow_card (VIZA collects); fills then HALTS before payment until
 * escrow integration. Best-effort selectors pending recon.
 */
const runner = makeStandardEvisaRunner({
  cc: "tr",
  country: "turkey",
  baseUrlEnv: "TR_PORTAL_URL",
  baseUrlDefault: "https://www.evisa.gov.tr",
  defaultVisaType: "TR_E_VISA",
  mappings: TR_FIELD_MAPPINGS,
});

export const runTrRunner = runner.runRunner;
export const runOne = runner.runOne;
