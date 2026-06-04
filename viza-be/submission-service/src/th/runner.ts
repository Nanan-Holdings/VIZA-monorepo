import { makeStandardEvisaRunner } from "../runners/standard-evisa.js";
import { TH_FIELD_MAPPINGS } from "./field-mappings.js";

/**
 * Thailand eVisa/eVOA runner (RUN-TH-001) on the shared core. Routing is
 * runner_escrow_card (VIZA collects); fills then HALTS before payment until
 * escrow integration. Best-effort selectors pending recon.
 */
const runner = makeStandardEvisaRunner({
  cc: "th",
  country: "thailand",
  baseUrlEnv: "TH_PORTAL_URL",
  baseUrlDefault: "https://www.thaievisa.go.th",
  defaultVisaType: "TH_TOURIST_E_VISA",
  mappings: TH_FIELD_MAPPINGS,
});

export const runThRunner = runner.runRunner;
export const runOne = runner.runOne;
