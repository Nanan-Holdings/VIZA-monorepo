import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  buildSchemaQaPreviewAnswers,
  getSchemaQaMissingRequiredFields,
} from "@/app/schema-qa/fixtures";
import { compileApplicationSchemaForUi } from "@/lib/application-schema-ui-contract";
import { normalizeBilingualFormField, normalizeBilingualWizardSteps } from "@/lib/bilingual-schema-contract";
import {
  getRagVisitorIntakeSteps,
  shouldUseRagVisitorIntakeFallback,
} from "@/lib/rag-visitor-intake-form";
import { augmentThailandTouristEVisaSteps } from "@/lib/thailand-tourist-evisa-form-overrides";
import { augmentVietnamEVisaOfficialParitySteps } from "@/lib/vietnam-evisa-form-parity";
import {
  NON_SCHENGEN_VISA_DESTINATIONS,
  SCHENGEN_VISA_DESTINATIONS,
} from "@/lib/visa-destinations";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
  type WizardStep,
} from "@/types/visa-form-fields";

const COUNTRY_ALPHA3: Record<string, string> = {
  argentina: "ARG", australia: "AUS", austria: "AUT", belgium: "BEL",
  bulgaria: "BGR", cambodia: "KHM", canada: "CAN", chile: "CHL", china: "CHN",
  colombia: "COL", croatia: "HRV", cuba: "CUB", czech_republic: "CZE",
  denmark: "DNK", dominican_republic: "DOM", egypt: "EGY", estonia: "EST",
  finland: "FIN", france: "FRA", germany: "DEU", greece: "GRC", hungary: "HUN",
  iceland: "ISL", india: "IND", indonesia: "IDN", ireland: "IRL", israel: "ISR",
  italy: "ITA", japan: "JPN", jordan: "JOR", kenya: "KEN", laos: "LAO",
  latvia: "LVA", liechtenstein: "LIE", lithuania: "LTU", luxembourg: "LUX",
  malaysia: "MYS", maldives: "MDV", malta: "MLT", mexico: "MEX", morocco: "MAR",
  nepal: "NPL", netherlands: "NLD", new_zealand: "NZL", norway: "NOR", oman: "OMN",
  peru: "PER", philippines: "PHL", poland: "POL", portugal: "PRT", qatar: "QAT",
  romania: "ROU", saudi_arabia: "SAU", singapore: "SGP", slovakia: "SVK",
  slovenia: "SVN", south_africa: "ZAF", south_korea: "KOR", spain: "ESP",
  sri_lanka: "LKA", sweden: "SWE", switzerland: "CHE", taiwan: "TWN",
  tanzania: "TZA", thailand: "THA", turkey: "TUR", united_arab_emirates: "ARE",
  united_kingdom: "GBR", united_states: "USA", vietnam: "VNM",
};

function readLocalEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values[trimmed.slice(0, separator)] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function buildSteps(visaType: string, rows: VisaFormFieldDbRow[]): WizardStep[] {
  const stepMap = new Map<number, WizardStep>();
  for (const row of rows) {
    const step = stepMap.get(row.step_number) ?? {
      stepNumber: row.step_number,
      stepName: row.step_name || `Step ${row.step_number}`,
      fields: [],
    };
    step.fields.push(normalizeBilingualFormField(dbRowToFormField(row)));
    stepMap.set(row.step_number, step);
  }
  const base = [...stepMap.values()].sort((left, right) => left.stepNumber - right.stepNumber);
  const vietnamPatched = visaType === "VN_E_VISA"
    ? augmentVietnamEVisaOfficialParitySteps(base)
    : base;
  const patched = visaType === "TH_TOURIST_E_VISA"
    ? augmentThailandTouristEVisaSteps(vietnamPatched)
    : vietnamPatched;
  const localized = visaType === "VN_E_VISA"
    ? normalizeBilingualWizardSteps(patched)
    : patched;
  return compileApplicationSchemaForUi(localized).steps;
}

function fictionalRouteAnswers(
  answers: Record<string, string>,
  countryName: string,
): Record<string, string> {
  const hotelName = `The ${countryName} Meridian Hotel`;
  const hotelAddress = `18 Central Boulevard, ${countryName}`;
  return Object.fromEntries(Object.entries(answers).map(([fieldName, value]) => {
    if (value === "Harbour Crest Meridian Hotel") return [fieldName, hotelName];
    if (/(hotel|accommodation)/i.test(fieldName) && /(address|street)/i.test(fieldName)) {
      return [fieldName, hotelAddress];
    }
    if (value.toLowerCase().includes("test answer")) {
      const field = fieldName.toLowerCase();
      if (/(email|username)/.test(field)) return [fieldName, "liwei.chen@harbourmail.example"];
      if (/(flight|transport_number)/.test(field)) return [fieldName, "SQ 218"];
      if (/(carrier|airline)/.test(field)) return [fieldName, "Singapore Airlines"];
      if (/(port|airport|entry_point|arrival_point)/.test(field)) {
        return [fieldName, `${countryName} International Airport`];
      }
      if (/(passport.*issue|issuing_authority|issuing_place)/.test(field)) {
        return [fieldName, "Immigration & Checkpoints Authority, Singapore"];
      }
      if (/(native.*name|name.*native|chinese.*char)/.test(field)) return [fieldName, "陈立伟"];
      if (/(activity|employment).*from/.test(field)) return [fieldName, "2020-01-01"];
      if (/(activity|employment).*to/.test(field)) return [fieldName, "2026-08-01"];
      if (/(language|mother_tongue)/.test(field)) return [fieldName, "Mandarin Chinese"];
      if (/(po_box|apartment|unit)/.test(field)) return [fieldName, "#12-04"];
      if (/(relationship)/.test(field)) return [fieldName, "Friend"];
      if (/(activity|visit|tourist|place_to_visit)/.test(field)) {
        return [fieldName, "Independent tourism, museums, local cuisine, and city sightseeing"];
      }
      if (/(note|detail|remark|additional|explain|reason)/.test(field)) {
        return [fieldName, "No additional information to declare"];
      }
      return [fieldName, "Not applicable"];
    }
    return [fieldName, value];
  }));
}

async function main() {
  const env = readLocalEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows: VisaFormFieldDbRow[] = [];
  for (let offset = 0; offset < 20_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("visa_form_fields")
      .select("*")
      .order("visa_type")
      .order("step_number")
      .order("display_order")
      .range(offset, offset + 999);
    if (error) throw new Error(`Unable to read visa schemas: ${error.message}`);
    rows.push(...((data ?? []) as VisaFormFieldDbRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const rowsByVisaType = new Map<string, VisaFormFieldDbRow[]>();
  for (const row of rows) {
    const existing = rowsByVisaType.get(row.visa_type) ?? [];
    existing.push(row);
    rowsByVisaType.set(row.visa_type, existing);
  }

  const destinations = [
    ...NON_SCHENGEN_VISA_DESTINATIONS,
    ...SCHENGEN_VISA_DESTINATIONS,
  ].filter((destination) => destination.recommendable !== false);

  const routes = await Promise.all(destinations.map(async (destination) => {
    const schemaVisaType = resolveVisaFormSchemaVisaType(destination.visaType, destination.country);
    const dedicatedRows = rowsByVisaType.get(schemaVisaType) ?? [];
    const source = dedicatedRows.length > 0 ? "dedicated_schema" : "generic_fallback";
    const steps = dedicatedRows.length > 0
      ? buildSteps(schemaVisaType, dedicatedRows)
      : shouldUseRagVisitorIntakeFallback(schemaVisaType)
        ? normalizeBilingualWizardSteps(getRagVisitorIntakeSteps(schemaVisaType))
        : [];
    const answers = buildSchemaQaPreviewAnswers(steps, schemaVisaType, {
      destinationCountryCode: COUNTRY_ALPHA3[destination.country],
    });
    const realisticAnswers = fictionalRouteAnswers(answers, destination.countryName);
    const missing = getSchemaQaMissingRequiredFields(steps, realisticAnswers);
    return {
      routeId: destination.id,
      country: destination.country,
      countryName: destination.countryName,
      catalogueVisaType: destination.visaType,
      schemaVisaType,
      schemaSource: source,
      stepCount: steps.length,
      fieldCount: steps.reduce((total, step) => total + step.fields.length, 0),
      generatedAnswerCount: Object.keys(realisticAnswers).length,
      missingRequiredFields: missing.map((field) => field.fieldName),
      answers: realisticAnswers,
    };
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    synthetic: true,
    submittable: false,
    warning: "Fictional QA data only. Never save to an applicant record or transmit to an official portal.",
    summary: {
      activeRoutes: routes.length,
      dedicatedSchemaRoutes: routes.filter((route) => route.schemaSource === "dedicated_schema").length,
      genericFallbackRoutes: routes.filter((route) => route.schemaSource === "generic_fallback").length,
      routesWithNoSchema: routes.filter((route) => route.stepCount === 0).length,
      routesWithMissingRequiredFields: routes.filter((route) => route.missingRequiredFields.length > 0).length,
      generatedAnswers: routes.reduce((total, route) => total + route.generatedAnswerCount, 0),
    },
    routes,
  };

  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  const outputPath = resolve(
    process.cwd(),
    outputArgument?.slice("--output=".length) || "../../.dev-logs/all-application-synthetic-fixtures.json",
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
