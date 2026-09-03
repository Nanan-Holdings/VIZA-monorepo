import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const inputPath = resolve(
  process.cwd(),
  "../../.dev-logs/all-application-synthetic-fixtures.json",
);
const outputPath = resolve(
  process.cwd(),
  "../../docs/qa-75-route-invented-fixtures.md",
);
const report = JSON.parse(readFileSync(inputPath, "utf8"));

function escapeSummary(value) {
  return value.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const routeIndex = report.routes.map((route) => [
  route.countryName,
  route.catalogueVisaType,
  route.schemaVisaType,
  route.schemaSource === "dedicated_schema" ? "Dedicated" : "Fallback",
  route.missingRequiredFields.length === 0 ? "Complete" : route.missingRequiredFields.join(", "),
].map((value) => `| ${value} `).join("") + "|").join("\n");

const routeDetails = report.routes.map((route) => {
  const title = escapeSummary(`${route.countryName} — ${route.catalogueVisaType}`);
  return `<details>\n<summary>${title}</summary>\n\n` +
    `- Route ID: \`${route.routeId}\`\n` +
    `- Canonical schema: \`${route.schemaVisaType}\` (${route.schemaSource})\n` +
    `- Generated answers: ${route.generatedAnswerCount}\n` +
    `- Missing browser-only fields: ${route.missingRequiredFields.length ? route.missingRequiredFields.map((field) => `\`${field}\``).join(", ") : "none"}\n\n` +
    "```json\n" +
    `${JSON.stringify(route.answers, null, 2)}\n` +
    "```\n\n</details>";
}).join("\n\n");

const markdown = `# 75-route invented VIZA QA fixtures

> **QA-only fictional data. Not a booking, passport record, travel plan, visa application, or government submission.**
>
> Do not copy these values into a persistent applicant account, upload them to a government portal, or use them to make a real travel decision. File-upload fields are deliberately not fabricated.

Generated: ${report.generatedAt}

## Scope

- Active routes: ${report.summary.activeRoutes}
- Dedicated-schema routes: ${report.summary.dedicatedSchemaRoutes}
- Generic fallback routes: ${report.summary.genericFallbackRoutes}
- Generated field answers: ${report.summary.generatedAnswers}
- Missing schemas: ${report.summary.routesWithNoSchema}
- Routes with browser-only document gaps: ${report.summary.routesWithMissingRequiredFields}

The shared fictional traveler baseline is **Li Wei Chen**, passport **XG4826913**, nationality **CHN**, fictional email **liwei.chen@harbourmail.example**, and address **17 Harbour Crest Avenue, #12-04, Singapore 018956**. Dates are scenario assumptions, not reservations.

## Route index

| Country | Catalogue product | Canonical schema | Source | Required-field result |
| --- | --- | --- | --- | --- |
${routeIndex}

## Per-route answer payloads

Each payload is the complete deterministic answer map generated for that route. Values may be reused only in a non-persistent local form-preview/test harness.

${routeDetails}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown, "utf8");
console.log(JSON.stringify({ outputPath, routes: report.routes.length }, null, 2));
