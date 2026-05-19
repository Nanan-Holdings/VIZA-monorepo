import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Landmark,
  PackageCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

type CoverageState = "supported" | "partial" | "unsupported";

interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  metadata: unknown;
  updated_at: string | null;
  created_at: string | null;
}

interface VisaFormFieldRow {
  visa_type: string | null;
  field_name: string | null;
}

interface DocumentRequirementRow {
  visa_package_id: string | null;
  country: string | null;
  visa_type: string | null;
  required: boolean | null;
}

interface DocumentStats {
  total: number;
  required: number;
}

interface CapabilityStatus {
  state: CoverageState;
  detail: string;
}

interface CoverageRow {
  package: VisaPackageRow;
  targetLabel: string | null;
  schema: CapabilityStatus;
  documents: CapabilityStatus;
  payment: CapabilityStatus;
  packet: CapabilityStatus;
  externalHandoff: CapabilityStatus;
  resultIngest: CapabilityStatus;
  statusUi: CapabilityStatus;
  governmentFee: string;
  overall: CoverageState;
}

interface QueryIssue {
  source: string;
  message: string;
}

const FIRST_BATCH_TARGETS = [
  {
    label: "US DS-160",
    description: "United States DS-160 visitor intake and handoff boundary.",
    matches: (pkg: VisaPackageRow) =>
      normalizeKey(pkg.country) === "united_states" ||
      normalizeKey(pkg.visa_type).includes("b1_b2") ||
      normalizeKey(pkg.visa_type).includes("ds160"),
  },
  {
    label: "France / Schengen",
    description: "France-led visibility for the shared Schengen Type C package.",
    matches: (pkg: VisaPackageRow) =>
      normalizeKey(pkg.country) === "france" ||
      normalizeKey(pkg.country) === "european_union" ||
      normalizeKey(pkg.visa_type).includes("schengen"),
  },
] as const;

const CAPABILITY_COLUMNS = [
  "schema",
  "documents",
  "payment",
  "packet",
  "externalHandoff",
  "resultIngest",
  "statusUi",
] as const;

export default async function AdminPackagesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient();

  const [packagesResult, fieldsResult, documentsResult] = await Promise.all([
    adminClient
      .from("visa_packages")
      .select(
        "id, country, visa_type, name, description, price_cents, currency, metadata, updated_at, created_at"
      )
      .eq("is_active", true)
      .order("country", { ascending: true })
      .order("visa_type", { ascending: true }),
    adminClient.from("visa_form_fields").select("visa_type, field_name"),
    adminClient
      .from("document_requirements")
      .select("visa_package_id, country, visa_type, required"),
  ]);

  const issues = collectIssues([
    ["visa_packages", packagesResult.error],
    ["visa_form_fields", fieldsResult.error],
    ["document_requirements", documentsResult.error],
  ]);

  const packages = (packagesResult.data ?? []) as VisaPackageRow[];
  const formFields = (fieldsResult.data ?? []) as VisaFormFieldRow[];
  const requirements = (documentsResult.data ?? []) as DocumentRequirementRow[];
  const formFieldCounts = buildFieldCounts(formFields);
  const documentStats = buildDocumentStats(requirements, packages);
  const rows = packages.map((pkg) =>
    buildCoverageRow(
      pkg,
      formFieldCounts.get(pkg.visa_type) ?? 0,
      documentStats.get(pkg.id) ?? { total: 0, required: 0 }
    )
  );
  const summary = buildSummary(rows);

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-500">
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            Package coverage
          </div>
          <h1 className="text-2xl font-semibold text-[#232323]">
            Automation Coverage Matrix
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
            Active visa packages with schema, document checklist, payment,
            packet generation, external handoff, result ingest, and status UI
            readiness. External handoff here means a structured handoff boundary,
            not official portal automation.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <SummaryTile
            label="Supported"
            value={summary.supported}
            tone="supported"
          />
          <SummaryTile label="Partial" value={summary.partial} tone="partial" />
          <SummaryTile
            label="Unsupported"
            value={summary.unsupported}
            tone="unsupported"
          />
        </div>
      </header>

      {issues.length > 0 ? <IssueBanner issues={issues} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {FIRST_BATCH_TARGETS.map((target) => {
          const matchingRows = rows.filter((row) => target.matches(row.package));
          return (
            <div
              key={target.label}
              className="rounded-lg border border-[#efefef] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark
                      className="h-4 w-4 text-brand-500"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-[#232323]">
                      {target.label}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
                    {target.description}
                  </p>
                </div>
                <StateBadge
                  state={matchingRows.length > 0 ? "supported" : "unsupported"}
                  label={matchingRows.length > 0 ? "Visible" : "Missing"}
                />
              </div>
              <div className="mt-4 space-y-2">
                {matchingRows.length > 0 ? (
                  matchingRows.map((row) => (
                    <div
                      key={row.package.id}
                      className="rounded-md border border-[#efefef] bg-[#fafafa] px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#232323]">
                          {row.package.name}
                        </span>
                        <StateBadge state={row.overall} />
                      </div>
                      <p className="mt-1 text-xs text-[#6b6b6b]">
                        {formatIdentifier(row.package.country)} ·{" "}
                        {row.package.visa_type}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-[#d7d7d7] bg-[#fafafa] px-3 py-2 text-sm text-[#6b6b6b]">
                    No active package row matched this first-batch target.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#efefef] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#efefef] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#232323]">
              Active Package Matrix
            </h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Metadata keys are read from <code>visa_packages.metadata.coverage</code>;
              schema and document counts provide evidence where configured.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-md border-[#d7d7d7] text-[#4b5563]"
          >
            {rows.length} active package{rows.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafafa]">
                <TableHeading>Package</TableHeading>
                <TableHeading>Schema</TableHeading>
                <TableHeading>Document checklist</TableHeading>
                <TableHeading>Payment</TableHeading>
                <TableHeading>Packet generation</TableHeading>
                <TableHeading>External handoff</TableHeading>
                <TableHeading>Result ingest</TableHeading>
                <TableHeading>Status UI</TableHeading>
                <TableHeading>Government fee</TableHeading>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.package.id}
                    className="border-b align-top transition-colors hover:bg-[#fafafa]"
                  >
                    <td className="min-w-[260px] px-4 py-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#232323]">
                            {row.package.name}
                          </span>
                          {row.targetLabel ? (
                            <Badge className="rounded-md border-brand-200 bg-brand-50 text-brand-500 hover:bg-brand-50">
                              {row.targetLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-[#6b6b6b]">
                          {formatIdentifier(row.package.country)} ·{" "}
                          {row.package.visa_type}
                        </p>
                        {row.package.description ? (
                          <p className="line-clamp-3 text-xs leading-5 text-[#6b6b6b]">
                            {row.package.description}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <CapabilityCell status={row.schema} />
                    <CapabilityCell status={row.documents} />
                    <CapabilityCell status={row.payment} />
                    <CapabilityCell status={row.packet} />
                    <CapabilityCell status={row.externalHandoff} />
                    <CapabilityCell status={row.resultIngest} />
                    <CapabilityCell status={row.statusUi} />
                    <td className="min-w-[190px] px-4 py-4 text-xs leading-5 text-[#4b5563]">
                      {row.governmentFee}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#9ca3af]">
                    No active visa packages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
        <div className="flex gap-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            Coverage is intentionally conservative. This page does not claim
            official portal runners, CAPTCHA handling, or autonomous government
            submission support. Those promises must come from a separately owned
            and verified service before customer-facing filtering uses them.
          </p>
        </div>
      </section>
    </div>
  );
}

function TableHeading({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
      {children}
    </th>
  );
}

function CapabilityCell({ status }: { status: CapabilityStatus }) {
  return (
    <td className="min-w-[150px] px-4 py-4">
      <div className="space-y-2">
        <StateBadge state={status.state} />
        <p className="text-xs leading-5 text-[#6b6b6b]">{status.detail}</p>
      </div>
    </td>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: CoverageState;
}) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <StatusIcon state={tone} className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#232323]">{value}</p>
    </div>
  );
}

function IssueBanner({ issues }: { issues: QueryIssue[] }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Coverage data is incomplete</h2>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li key={issue.source}>
                <span className="font-medium">{issue.source}:</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StateBadge({ state, label }: { state: CoverageState; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        state === "supported" && "border-green-200 bg-green-50 text-green-700",
        state === "partial" && "border-amber-200 bg-amber-50 text-amber-800",
        state === "unsupported" && "border-[#d7d7d7] bg-[#f5f5f5] text-[#6b6b6b]"
      )}
    >
      <StatusIcon state={state} className="h-3.5 w-3.5" />
      {label ?? toTitleCase(state)}
    </span>
  );
}

function StatusIcon({
  state,
  className,
}: {
  state: CoverageState;
  className?: string;
}) {
  if (state === "supported") {
    return <CheckCircle2 className={className} aria-hidden="true" />;
  }
  if (state === "partial") {
    return <CircleDashed className={className} aria-hidden="true" />;
  }
  return <AlertTriangle className={className} aria-hidden="true" />;
}

function buildCoverageRow(
  pkg: VisaPackageRow,
  fieldCount: number,
  docStats: DocumentStats
): CoverageRow {
  const metadata = asRecord(pkg.metadata);
  const coverage = asRecord(metadata?.coverage);
  const schema = resolveCapability({
    value: firstDefined(coverage, ["schema"]),
    fallback: fieldCount > 0 ? "supported" : "unsupported",
    fallbackDetail:
      fieldCount > 0
        ? `${fieldCount} visa_form_fields row${fieldCount === 1 ? "" : "s"} found.`
        : "No visa_form_fields rows found for this visa type.",
    supportedDetail: `${fieldCount} visa_form_fields row${fieldCount === 1 ? "" : "s"} found.`,
    unsupportedDetail: "No active schema coverage is configured.",
  });

  const documents = resolveCapability({
    value: firstDefined(coverage, ["document_checklist", "documents"]),
    fallback: docStats.total > 0 ? "supported" : "unsupported",
    fallbackDetail:
      docStats.total > 0
        ? `${docStats.total} document requirement${docStats.total === 1 ? "" : "s"} (${docStats.required} required).`
        : "No document_requirements rows found for this package.",
    supportedDetail: `${docStats.total} document requirement${docStats.total === 1 ? "" : "s"} (${docStats.required} required).`,
    unsupportedDetail: "No document checklist coverage is configured.",
  });

  const payment = resolveCapability({
    value: firstDefined(coverage, ["payment"]),
    fallback: pkg.price_cents !== null ? "partial" : "unsupported",
    fallbackDetail:
      pkg.price_cents !== null
        ? `Agency price configured at ${formatMoney(pkg.price_cents, pkg.currency ?? "USD")}; payment coverage metadata is not explicit.`
        : "No payment coverage metadata or package price is configured.",
    supportedDetail: "Payment coverage is enabled in package metadata.",
    unsupportedDetail: "Payment coverage is not enabled for this package.",
  });

  const packet = resolveCapability({
    value: firstDefined(coverage, ["packet_generation", "packet"]),
    fallback: "unsupported",
    fallbackDetail: "No packet generation coverage metadata is configured.",
    supportedDetail: "Packet generation coverage is enabled in package metadata.",
    unsupportedDetail: "Packet generation coverage is not enabled for this package.",
  });

  const externalHandoff = resolveCapability({
    value: firstDefined(coverage, ["external_submission_handoff", "external_submission"]),
    fallback: "unsupported",
    fallbackDetail: "No external handoff coverage metadata is configured.",
    supportedDetail: "Structured external handoff coverage is enabled; this is not a portal automation claim.",
    unsupportedDetail: "External handoff coverage is not enabled for this package.",
  });

  const resultIngest = resolveCapability({
    value: firstDefined(coverage, ["result_ingest", "result_delivery"]),
    fallback: "unsupported",
    fallbackDetail: "No result ingest coverage metadata is configured.",
    supportedDetail: "Result ingest or delivery coverage is enabled in package metadata.",
    unsupportedDetail: "Result ingest coverage is not enabled for this package.",
  });

  const statusUiFallback = resultIngest.state === "supported" ? "partial" : "unsupported";
  const statusUi = resolveCapability({
    value: firstDefined(coverage, ["status_ui", "status_display"]),
    fallback: statusUiFallback,
    fallbackDetail:
      statusUiFallback === "partial"
        ? "Result coverage exists, but package-specific status UI metadata is not set."
        : "No status UI coverage metadata is configured.",
    supportedDetail: "Package-specific status UI coverage is enabled in metadata.",
    unsupportedDetail: "Status UI coverage is not enabled for this package.",
  });

  const capabilityStates = [
    schema,
    documents,
    payment,
    packet,
    externalHandoff,
    resultIngest,
    statusUi,
  ].map((status) => status.state);

  return {
    package: pkg,
    targetLabel: findTargetLabel(pkg),
    schema,
    documents,
    payment,
    packet,
    externalHandoff,
    resultIngest,
    statusUi,
    governmentFee: formatGovernmentFee(metadata, pkg),
    overall: getOverallState(capabilityStates),
  };
}

function resolveCapability({
  value,
  fallback,
  fallbackDetail,
  supportedDetail,
  unsupportedDetail,
}: {
  value: unknown;
  fallback: CoverageState;
  fallbackDetail: string;
  supportedDetail: string;
  unsupportedDetail: string;
}): CapabilityStatus {
  const parsed = parseCoverageValue(value);
  const state = parsed.state ?? fallback;
  const detail =
    parsed.detail ??
    (parsed.state
      ? detailForState(state, supportedDetail, unsupportedDetail)
      : fallbackDetail);

  return { state, detail };
}

function parseCoverageValue(value: unknown): {
  state: CoverageState | null;
  detail: string | null;
} {
  if (typeof value === "boolean") {
    return { state: value ? "supported" : "unsupported", detail: null };
  }

  if (typeof value === "string") {
    return { state: stateFromString(value), detail: null };
  }

  const record = asRecord(value);
  if (!record) {
    return { state: null, detail: null };
  }

  const explicitState = firstString(record, [
    "state",
    "status",
    "coverage",
    "mode",
  ]);
  const stateFromExplicit = explicitState ? stateFromString(explicitState) : null;
  const supportedFlag = firstBoolean(record, ["supported", "enabled", "ready"]);
  const state =
    stateFromExplicit ??
    (supportedFlag === undefined
      ? null
      : supportedFlag
        ? "supported"
        : "unsupported");
  const note = firstString(record, ["note", "notes", "label", "reason", "source"]);

  return { state, detail: note ?? null };
}

function stateFromString(value: string): CoverageState {
  const normalized = normalizeKey(value);

  if (
    [
      "supported",
      "complete",
      "ready",
      "enabled",
      "true",
      "yes",
      "available",
    ].includes(normalized)
  ) {
    return "supported";
  }

  if (
    [
      "partial",
      "manual",
      "manual_handoff",
      "handoff",
      "handoff_only",
      "display_only",
      "pending",
      "in_progress",
    ].includes(normalized)
  ) {
    return "partial";
  }

  return "unsupported";
}

function detailForState(
  state: CoverageState,
  supportedDetail: string,
  unsupportedDetail: string
): string {
  if (state === "supported") return supportedDetail;
  if (state === "partial") return "Partial coverage is configured in package metadata.";
  return unsupportedDetail;
}

function buildFieldCounts(fields: VisaFormFieldRow[]) {
  const counts = new Map<string, number>();

  for (const field of fields) {
    if (!field.visa_type || !field.field_name) continue;
    counts.set(field.visa_type, (counts.get(field.visa_type) ?? 0) + 1);
  }

  return counts;
}

function buildDocumentStats(
  requirements: DocumentRequirementRow[],
  packages: VisaPackageRow[]
) {
  const stats = new Map<string, DocumentStats>();

  for (const pkg of packages) {
    const matchingRequirements = requirements.filter((requirement) =>
      matchesRequirement(pkg, requirement)
    );

    stats.set(pkg.id, {
      total: matchingRequirements.length,
      required: matchingRequirements.filter((requirement) => requirement.required !== false).length,
    });
  }

  return stats;
}

function matchesRequirement(
  pkg: VisaPackageRow,
  requirement: DocumentRequirementRow
) {
  if (requirement.visa_package_id && requirement.visa_package_id === pkg.id) {
    return true;
  }

  const visaTypeMatches = requirement.visa_type === pkg.visa_type;
  const countryMatches =
    !requirement.country ||
    normalizeKey(requirement.country) === normalizeKey(pkg.country);

  return visaTypeMatches && countryMatches;
}

function buildSummary(rows: CoverageRow[]) {
  return rows.reduce(
    (acc, row) => {
      for (const key of CAPABILITY_COLUMNS) {
        acc[row[key].state] += 1;
      }
      return acc;
    },
    { supported: 0, partial: 0, unsupported: 0 } satisfies Record<
      CoverageState,
      number
    >
  );
}

function getOverallState(states: CoverageState[]): CoverageState {
  if (states.every((state) => state === "supported")) return "supported";
  if (states.some((state) => state === "supported" || state === "partial")) {
    return "partial";
  }
  return "unsupported";
}

function formatGovernmentFee(
  metadata: Record<string, unknown> | null,
  pkg: VisaPackageRow
) {
  const governmentFee = asRecord(metadata?.government_fee);
  if (!governmentFee) return "No government fee metadata configured.";

  const mode = firstString(governmentFee, ["mode", "status"]);
  const label = firstString(governmentFee, ["label", "note", "notes"]);
  const currency = firstString(governmentFee, ["currency"]) ?? pkg.currency ?? "USD";
  const amountCents = firstNumber(governmentFee, ["amount_cents", "amountCents"]);
  const formattedAmount =
    amountCents === undefined ? null : formatMoney(amountCents, currency);

  return [formattedAmount, mode ? toTitleCase(mode) : null, label]
    .filter(Boolean)
    .join(" · ") || "Government fee metadata is present without display fields.";
}

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function firstDefined(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function firstBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function collectIssues(entries: Array<[string, unknown]>): QueryIssue[] {
  return entries
    .filter((entry): entry is [string, unknown] => Boolean(entry[1]))
    .map(([source, error]) => ({ source, message: getErrorMessage(error) }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  const message = record
    ? firstString(record, ["message", "details", "hint"])
    : null;
  return message ?? "Unknown query error.";
}

function findTargetLabel(pkg: VisaPackageRow) {
  return FIRST_BATCH_TARGETS.find((target) => target.matches(pkg))?.label ?? null;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function formatIdentifier(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(toTitleCase)
    .join(" ");
}

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
