import * as fs from "node:fs";
import * as path from "node:path";

/**
 * OBSV-004: launch readiness across all 16 countries.
 *
 *   npx tsx scripts/launch/verify-country-readiness.ts
 *
 * Read-only filesystem checks (no network/DB). Per country verifies:
 *   1. runner bound in submission-service dispatch.ts
 *   2. pricing entry in internal-website lib/pricing.ts
 *   3. marketing page metadata in marketing-website lib/countries.ts
 *   4. portal wizard config in the wizard registry
 * Prints a pass/fail table and exits non-zero if any country is incomplete.
 */
const REPO = path.resolve(__dirname, "../..");

function read(rel: string): string {
  const p = path.join(REPO, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

const DISPATCH = read("viza-be/submission-service/src/queue/dispatch.ts");
const PRICING = read("viza-fe/internal-website/lib/pricing.ts");
const MARKETING = read("viza-fe/marketing-website/lib/countries.ts");
const REGISTRY = read("viza-fe/internal-website/components/client/wizards/shell/registry.ts");

interface Country {
  portal: string;
  visaType: string;
}
const COUNTRIES: Country[] = [
  { portal: "indonesia", visaType: "ID_C1_TOURIST" },
  { portal: "egypt", visaType: "EG_E_VISA" },
  { portal: "australia", visaType: "AU_VISITOR_600" },
  { portal: "saudi_arabia", visaType: "SA_E_VISA" },
  { portal: "united_kingdom", visaType: "UK_STANDARD_VISITOR" },
  { portal: "vietnam", visaType: "VN_E_VISA" },
  { portal: "malaysia", visaType: "MY_TOURIST_E_VISA" },
  { portal: "japan", visaType: "JP_TOURIST" },
  { portal: "united_states", visaType: "DS160" },
  { portal: "canada", visaType: "CA_TRV" },
  { portal: "turkey", visaType: "TR_E_VISA" },
  { portal: "thailand", visaType: "TH_TOURIST_E_VISA" },
  { portal: "united_arab_emirates", visaType: "AE_TOURIST_VISA" },
  { portal: "france", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { portal: "italy", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { portal: "india", visaType: "IN_E_VISA" },
];

function check(c: Country): { runner: boolean; pricing: boolean; marketing: boolean; wizard: boolean } {
  return {
    runner: DISPATCH.includes(`${c.portal}:`) && DISPATCH.includes(`${c.portal}: { runner:`),
    pricing: PRICING.includes(`country: "${c.portal}"`),
    marketing: MARKETING.includes(`portalCountry: "${c.portal}"`),
    wizard: REGISTRY.includes(`visaType: "${c.visaType}"`),
  };
}

function main(): void {
  let allOk = true;
  console.log("country               | runner | pricing | marketing | wizard");
  console.log("----------------------|--------|---------|-----------|-------");
  for (const c of COUNTRIES) {
    const r = check(c);
    const ok = r.runner && r.pricing && r.marketing && r.wizard;
    allOk = allOk && ok;
    const y = (b: boolean) => (b ? "  ✓   " : "  ✗   ");
    console.log(
      `${c.portal.padEnd(21)} | ${y(r.runner)} | ${y(r.pricing)}  | ${y(r.marketing)}    | ${y(r.wizard)}`,
    );
  }
  console.log(allOk ? "\n✓ All 16 launch countries ready." : "\n✗ Some countries incomplete (see ✗ above).");
  if (!allOk) process.exit(1);
}

main();
