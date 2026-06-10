import { makeStandardEvisaRunner } from "../runners/standard-evisa.js";
import { AE_FIELD_MAPPINGS } from "./field-mappings.js";

/**
 * UAE e-Visa runner (RUN-AE-001) on the shared core. Routing is
 * runner_escrow_card (VIZA collects); fills then HALTS before payment until
 * escrow integration. Best-effort selectors pending recon.
 */
const runner = makeStandardEvisaRunner({
  cc: "ae",
  country: "united_arab_emirates",
  baseUrlEnv: "AE_PORTAL_URL",
  baseUrlDefault: "https://smartservices.icp.gov.ae",
  defaultVisaType: "AE_TOURIST_VISA",
  mappings: AE_FIELD_MAPPINGS,
});

export const runAeRunner = runner.runRunner;
export const runOne = runner.runOne;
