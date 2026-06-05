import { listCountrySubmissionProviders } from "./registry";

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "-";
}

function main(): void {
  const providers = listCountrySubmissionProviders().sort((a, b) =>
    a.countryCode.localeCompare(b.countryCode),
  );

  console.log("# Country Submission Provider Inventory");
  console.log("");
  console.log(
    [
      "Country",
      "Visa types",
      "Route",
      "Implementation",
      "Dry-run",
      "Sandbox",
      "Real submit",
      "Schema",
      "Mapper",
      "Automation",
      "Notes",
    ].join(" | "),
  );
  console.log(
    [
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
      "---",
    ].join(" | "),
  );

  for (const provider of providers) {
    console.log(
      [
        provider.countryCode,
        joinList(provider.supportedVisaTypes),
        provider.routeStatus,
        provider.implementationStatus,
        yesNo(provider.dryRunAvailable),
        yesNo(provider.sandboxAvailable),
        yesNo(provider.realSubmitAvailable),
        joinList(provider.schemaFiles),
        joinList(provider.mapperFiles),
        joinList(provider.automationFiles),
        provider.notes,
      ].join(" | "),
    );
  }
}

main();
