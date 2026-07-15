import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OFFICIAL_API_BASE = "https://ws.etravel.gov.ph";
const OUTPUT_PATH = fileURLToPath(new URL("./official-options.snapshot.json", import.meta.url));

type OfficialOption = {
  id: number;
  code: string;
  name: string;
  [key: string]: unknown;
};

async function load(path: string): Promise<OfficialOption[]> {
  const response = await fetch(`${OFFICIAL_API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Official eTravel option request failed with HTTP ${response.status}: ${path}`);
  const payload = await response.json() as { data?: OfficialOption[] };
  if (!Array.isArray(payload.data)) throw new Error(`Official eTravel option response has no data array: ${path}`);
  return payload.data;
}

async function main(): Promise<void> {
  const endpoints = {
    occupations: "/api/v1/common/occupations?paginate=0&order_by=name&status_by=asc",
    countries: "/api/v1/common/countries?paginate=0&order_by=name&status_by=asc",
    arrivalPurposes: "/api/v1/common/purpose_of_visits?paginate=0&for_arrival=1&order_by=name&status_by=asc",
    airlines: "/api/v1/common/travel_companies?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    arrivalPorts: "/api/v1/common/travel_ports?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    sicknessSymptoms: "/api/v1/common/sickness_symptoms?paginate=0&order_by=name&status_by=asc&is_active=1",
    declarationChecklist: "/api/v1/common/declaration_check_lists?paginate=0",
  } as const;

  const entries = await Promise.all(Object.entries(endpoints).map(async ([key, path]) => [key, await load(path)]));
  const snapshot = {
    source: OFFICIAL_API_BASE,
    officialWebBuildId: "77f106d9c659765d93977987ceb12abaf7d43bd5",
    retrievedOn: new Date().toISOString().slice(0, 10),
    endpoints,
    ...Object.fromEntries(entries),
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote official Philippines eTravel option snapshot to ${OUTPUT_PATH}.`);
}

void main();
