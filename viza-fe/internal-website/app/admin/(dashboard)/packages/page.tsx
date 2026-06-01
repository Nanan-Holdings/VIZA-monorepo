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
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";

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

interface PagedQueryResult<T> {
  data: T[];
  error: unknown;
}

type QueryErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const dynamic = "force-dynamic";

const COVERAGE_PAGE_SIZE = 1000;

interface PackageCoverageCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  supported: string;
  partial: string;
  unsupported: string;
  visible: string;
  missing: string;
  issueTitle: string;
  firstBatchMissing: string;
  activeMatrixTitle: string;
  activeMatrixDescription: ReactNode;
  activePackages: (count: number) => string;
  headings: {
    package: string;
    schema: string;
    documents: string;
    payment: string;
    packet: string;
    externalHandoff: string;
    resultIngest: string;
    statusUi: string;
    governmentFee: string;
  };
  noPackages: string;
  caution: string;
  targets: Record<"ds160" | "schengen", { label: string; description: string }>;
  unknownQueryError: string;
  detail: {
    fieldRowsFound: (count: number) => string;
    noFieldRows: string;
    noSchemaCoverage: string;
    documentRowsFound: (total: number, required: number) => string;
    noDocumentRows: string;
    noDocumentCoverage: string;
    agencyPricePartial: (amount: string) => string;
    noPaymentCoverage: string;
    paymentEnabled: string;
    paymentDisabled: string;
    noPacketCoverage: string;
    packetEnabled: string;
    packetDisabled: string;
    noExternalCoverage: string;
    externalEnabled: string;
    externalDisabled: string;
    noResultCoverage: string;
    resultEnabled: string;
    resultDisabled: string;
    resultWithoutStatusUi: string;
    noStatusUiCoverage: string;
    statusUiEnabled: string;
    statusUiDisabled: string;
    partialCoverage: string;
    noGovernmentFee: string;
    incompleteGovernmentFee: string;
  };
}

const COPY: Record<InterfaceLocale, PackageCoverageCopy> = {
  en: {
    eyebrow: "Package coverage",
    title: "Automation Coverage Matrix",
    subtitle:
      "Active visa packages with schema, document checklist, payment, packet generation, external handoff, result ingest, and status UI readiness. External handoff here means a structured handoff boundary, not official portal automation.",
    supported: "Supported",
    partial: "Partial",
    unsupported: "Unsupported",
    visible: "Visible",
    missing: "Missing",
    issueTitle: "Coverage data is incomplete",
    firstBatchMissing: "No active package row matched this first-batch target.",
    activeMatrixTitle: "Active Package Matrix",
    activeMatrixDescription: (
      <>
        Metadata keys are read from <code>visa_packages.metadata.coverage</code>;
        schema and document counts provide evidence where configured.
      </>
    ),
    activePackages: (count) => `${count} active package${count === 1 ? "" : "s"}`,
    headings: {
      package: "Package",
      schema: "Schema",
      documents: "Document checklist",
      payment: "Payment",
      packet: "Packet generation",
      externalHandoff: "External handoff",
      resultIngest: "Result ingest",
      statusUi: "Status UI",
      governmentFee: "Government fee",
    },
    noPackages: "No active visa packages found.",
    caution:
      "Coverage is intentionally conservative. This page does not claim official portal runners, CAPTCHA handling, or autonomous government submission support. Those promises must come from a separately owned and verified service before customer-facing filtering uses them.",
    targets: {
      ds160: {
        label: "US DS-160",
        description: "United States DS-160 visitor intake and handoff boundary.",
      },
      schengen: {
        label: "France / Schengen",
        description: "France-led visibility for the shared Schengen Type C package.",
      },
    },
    unknownQueryError: "Unknown query error.",
    detail: {
      fieldRowsFound: (count) => `${count} visa_form_fields row${count === 1 ? "" : "s"} found.`,
      noFieldRows: "No visa_form_fields rows found for this visa type.",
      noSchemaCoverage: "No active schema coverage is configured.",
      documentRowsFound: (total, required) =>
        `${total} document requirement${total === 1 ? "" : "s"} (${required} required).`,
      noDocumentRows: "No document_requirements rows found for this package.",
      noDocumentCoverage: "No document checklist coverage is configured.",
      agencyPricePartial: (amount) =>
        `Agency price configured at ${amount}; payment coverage metadata is not explicit.`,
      noPaymentCoverage: "No payment coverage metadata or package price is configured.",
      paymentEnabled: "Payment coverage is enabled in package metadata.",
      paymentDisabled: "Payment coverage is not enabled for this package.",
      noPacketCoverage: "No packet generation coverage metadata is configured.",
      packetEnabled: "Packet generation coverage is enabled in package metadata.",
      packetDisabled: "Packet generation coverage is not enabled for this package.",
      noExternalCoverage: "No external handoff coverage metadata is configured.",
      externalEnabled:
        "Structured external handoff coverage is enabled; this is not a portal automation claim.",
      externalDisabled: "External handoff coverage is not enabled for this package.",
      noResultCoverage: "No result ingest coverage metadata is configured.",
      resultEnabled: "Result ingest or delivery coverage is enabled in package metadata.",
      resultDisabled: "Result ingest coverage is not enabled for this package.",
      resultWithoutStatusUi:
        "Result coverage exists, but package-specific status UI metadata is not set.",
      noStatusUiCoverage: "No status UI coverage metadata is configured.",
      statusUiEnabled: "Package-specific status UI coverage is enabled in metadata.",
      statusUiDisabled: "Status UI coverage is not enabled for this package.",
      partialCoverage: "Partial coverage is configured in package metadata.",
      noGovernmentFee: "No government fee metadata configured.",
      incompleteGovernmentFee:
        "Government fee metadata is present without display fields.",
    },
  },
  zh: {
    eyebrow: "套餐覆盖范围",
    title: "自动化覆盖矩阵",
    subtitle:
      "查看当前启用的签证套餐是否具备表单 schema、材料清单、支付、材料包生成、外部交接、结果接收和状态展示能力。这里的外部交接只表示结构化交接边界，不代表官方门户自动提交。",
    supported: "已支持",
    partial: "部分支持",
    unsupported: "未支持",
    visible: "可见",
    missing: "缺失",
    issueTitle: "覆盖数据不完整",
    firstBatchMissing: "没有启用的套餐匹配这个首批目标。",
    activeMatrixTitle: "启用套餐矩阵",
    activeMatrixDescription: (
      <>
        覆盖能力读取自 <code>visa_packages.metadata.coverage</code>；
        schema 和材料数量会作为已配置能力的佐证。
      </>
    ),
    activePackages: (count) => `${count} 个启用套餐`,
    headings: {
      package: "套餐",
      schema: "表单 Schema",
      documents: "材料清单",
      payment: "支付",
      packet: "材料包生成",
      externalHandoff: "外部交接",
      resultIngest: "结果接收",
      statusUi: "状态展示",
      governmentFee: "官方费用",
    },
    noPackages: "暂无启用的签证套餐。",
    caution:
      "覆盖状态会刻意保守展示。本页不声明官方门户 runner、CAPTCHA 处理或政府网站自动提交能力。任何面向客户的承诺都必须来自单独负责且已验证的服务。",
    targets: {
      ds160: {
        label: "美国 DS-160",
        description: "美国 DS-160 访客签证信息采集与交接边界。",
      },
      schengen: {
        label: "法国 / 申根",
        description: "以法国为代表展示共享申根 Type C 套餐的覆盖情况。",
      },
    },
    unknownQueryError: "未知查询错误。",
    detail: {
      fieldRowsFound: (count) => `已找到 ${count} 条 visa_form_fields 记录。`,
      noFieldRows: "这个签证类型没有 visa_form_fields 记录。",
      noSchemaCoverage: "尚未配置启用的 schema 覆盖能力。",
      documentRowsFound: (total, required) => `已找到 ${total} 条材料要求，其中 ${required} 条必需。`,
      noDocumentRows: "这个套餐没有 document_requirements 记录。",
      noDocumentCoverage: "尚未配置材料清单覆盖能力。",
      agencyPricePartial: (amount) => `已配置 VIZA 服务费 ${amount}，但支付覆盖 metadata 未显式声明。`,
      noPaymentCoverage: "没有支付覆盖 metadata，也没有配置套餐价格。",
      paymentEnabled: "支付覆盖已在套餐 metadata 中启用。",
      paymentDisabled: "这个套餐未启用支付覆盖。",
      noPacketCoverage: "尚未配置材料包生成覆盖 metadata。",
      packetEnabled: "材料包生成覆盖已在套餐 metadata 中启用。",
      packetDisabled: "这个套餐未启用材料包生成覆盖。",
      noExternalCoverage: "尚未配置外部交接覆盖 metadata。",
      externalEnabled: "结构化外部交接覆盖已启用；这不是官方门户自动化声明。",
      externalDisabled: "这个套餐未启用外部交接覆盖。",
      noResultCoverage: "尚未配置结果接收覆盖 metadata。",
      resultEnabled: "结果接收或交付覆盖已在套餐 metadata 中启用。",
      resultDisabled: "这个套餐未启用结果接收覆盖。",
      resultWithoutStatusUi: "已有结果覆盖，但未设置这个套餐的状态展示 metadata。",
      noStatusUiCoverage: "尚未配置状态展示覆盖 metadata。",
      statusUiEnabled: "这个套餐的状态展示覆盖已在 metadata 中启用。",
      statusUiDisabled: "这个套餐未启用状态展示覆盖。",
      partialCoverage: "套餐 metadata 中配置了部分覆盖能力。",
      noGovernmentFee: "尚未配置官方费用 metadata。",
      incompleteGovernmentFee: "已有官方费用 metadata，但缺少可展示字段。",
    },
  },
};

const FIRST_BATCH_TARGETS = [
  {
    key: "ds160",
    matches: (pkg: VisaPackageRow) =>
      normalizeKey(pkg.country) === "united_states" ||
      normalizeKey(pkg.visa_type).includes("b1_b2") ||
      normalizeKey(pkg.visa_type).includes("ds160"),
  },
  {
    key: "schengen",
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
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];

  const adminClient = createAdminClient();

  const packagesResult = await fetchActivePackages(adminClient);
  const packages = packagesResult.data;
  const [fieldsResult, documentsResult] = await Promise.all([
    fetchVisaFormFields(adminClient, packages.map((pkg) => pkg.visa_type)),
    fetchDocumentRequirements(adminClient),
  ]);

  const issues = collectIssues([
    ["visa_packages", packagesResult.error],
    ["visa_form_fields", fieldsResult.error],
    [
      "document_requirements",
      isSchemaMissingError(documentsResult.error) ? null : documentsResult.error,
    ],
  ], copy);

  const formFields = fieldsResult.data;
  const requirements = documentsResult.data;
  const formFieldCounts = buildFieldCounts(formFields);
  const documentStats = buildDocumentStats(requirements, packages);
  const rows = packages.map((pkg) =>
    buildCoverageRow(
      pkg,
      formFieldCounts.get(pkg.visa_type) ?? 0,
      documentStats.get(pkg.id) ?? { total: 0, required: 0 },
      copy,
      locale,
    )
  );
  const summary = buildSummary(rows);

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-500">
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {copy.eyebrow}
          </div>
          <h1 className="text-2xl font-semibold text-[#232323]">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
            {copy.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <SummaryTile
            label={copy.supported}
            value={summary.supported}
            tone="supported"
          />
          <SummaryTile label={copy.partial} value={summary.partial} tone="partial" />
          <SummaryTile
            label={copy.unsupported}
            value={summary.unsupported}
            tone="unsupported"
          />
        </div>
      </header>

      {issues.length > 0 ? <IssueBanner issues={issues} copy={copy} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {FIRST_BATCH_TARGETS.map((target) => {
          const matchingRows = rows.filter((row) => target.matches(row.package));
          const targetCopy = copy.targets[target.key];
          return (
            <div
              key={target.key}
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
                      {targetCopy.label}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
                    {targetCopy.description}
                  </p>
                </div>
                <StateBadge
                  state={matchingRows.length > 0 ? "supported" : "unsupported"}
                  label={matchingRows.length > 0 ? copy.visible : copy.missing}
                  copy={copy}
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
                        <StateBadge state={row.overall} copy={copy} />
                      </div>
                      <p className="mt-1 text-xs text-[#6b6b6b]">
                        {formatIdentifier(row.package.country)} ·{" "}
                        {row.package.visa_type}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-[#d7d7d7] bg-[#fafafa] px-3 py-2 text-sm text-[#6b6b6b]">
                    {copy.firstBatchMissing}
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
              {copy.activeMatrixTitle}
            </h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              {copy.activeMatrixDescription}
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-md border-[#d7d7d7] text-[#4b5563]"
          >
            {copy.activePackages(rows.length)}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafafa]">
                <TableHeading>{copy.headings.package}</TableHeading>
                <TableHeading>{copy.headings.schema}</TableHeading>
                <TableHeading>{copy.headings.documents}</TableHeading>
                <TableHeading>{copy.headings.payment}</TableHeading>
                <TableHeading>{copy.headings.packet}</TableHeading>
                <TableHeading>{copy.headings.externalHandoff}</TableHeading>
                <TableHeading>{copy.headings.resultIngest}</TableHeading>
                <TableHeading>{copy.headings.statusUi}</TableHeading>
                <TableHeading>{copy.headings.governmentFee}</TableHeading>
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
                    <CapabilityCell status={row.schema} copy={copy} />
                    <CapabilityCell status={row.documents} copy={copy} />
                    <CapabilityCell status={row.payment} copy={copy} />
                    <CapabilityCell status={row.packet} copy={copy} />
                    <CapabilityCell status={row.externalHandoff} copy={copy} />
                    <CapabilityCell status={row.resultIngest} copy={copy} />
                    <CapabilityCell status={row.statusUi} copy={copy} />
                    <td className="min-w-[190px] px-4 py-4 text-xs leading-5 text-[#4b5563]">
                      {row.governmentFee}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#9ca3af]">
                    {copy.noPackages}
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
            {copy.caution}
          </p>
        </div>
      </section>
    </div>
  );
}

async function fetchActivePackages(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<PagedQueryResult<VisaPackageRow>> {
  return fetchPagedRows<VisaPackageRow>((from, to) =>
    adminClient
      .from("visa_packages")
      .select(
        "id, country, visa_type, name, description, price_cents, currency, metadata, updated_at, created_at"
      )
      .eq("is_active", true)
      .order("country", { ascending: true })
      .order("visa_type", { ascending: true })
      .range(from, to)
  );
}

async function fetchVisaFormFields(
  adminClient: ReturnType<typeof createAdminClient>,
  visaTypes: string[]
): Promise<PagedQueryResult<VisaFormFieldRow>> {
  const uniqueVisaTypes = uniqueNonEmpty(visaTypes);
  if (uniqueVisaTypes.length === 0) return { data: [], error: null };

  return fetchPagedRows<VisaFormFieldRow>((from, to) =>
    adminClient
      .from("visa_form_fields")
      .select("visa_type, field_name")
      .in("visa_type", uniqueVisaTypes)
      .order("visa_type", { ascending: true })
      .range(from, to)
  );
}

async function fetchDocumentRequirements(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<PagedQueryResult<DocumentRequirementRow>> {
  return fetchPagedRows<DocumentRequirementRow>((from, to) =>
    adminClient
      .from("document_requirements")
      .select("visa_package_id, country, visa_type, required")
      .order("visa_package_id", { ascending: true, nullsFirst: true })
      .order("country", { ascending: true })
      .order("visa_type", { ascending: true })
      .range(from, to)
  );
}

async function fetchPagedRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<unknown>
): Promise<PagedQueryResult<T>> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + COVERAGE_PAGE_SIZE - 1;
    const result = (await queryPage(from, to)) as {
      data: T[] | null;
      error: unknown;
    };

    if (result.error) {
      return { data: rows, error: result.error };
    }

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < COVERAGE_PAGE_SIZE) {
      return { data: rows, error: null };
    }

    from += COVERAGE_PAGE_SIZE;
  }
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function TableHeading({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
      {children}
    </th>
  );
}

function CapabilityCell({
  status,
  copy,
}: {
  status: CapabilityStatus;
  copy: PackageCoverageCopy;
}) {
  return (
    <td className="min-w-[150px] px-4 py-4">
      <div className="space-y-2">
        <StateBadge state={status.state} copy={copy} />
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

function IssueBanner({
  issues,
  copy,
}: {
  issues: QueryIssue[];
  copy: PackageCoverageCopy;
}) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{copy.issueTitle}</h2>
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

function StateBadge({
  state,
  label,
  copy,
}: {
  state: CoverageState;
  label?: string;
  copy: PackageCoverageCopy;
}) {
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
      {label ?? stateLabel(state, copy)}
    </span>
  );
}

function stateLabel(state: CoverageState, copy: PackageCoverageCopy) {
  if (state === "supported") return copy.supported;
  if (state === "partial") return copy.partial;
  return copy.unsupported;
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
  docStats: DocumentStats,
  copy: PackageCoverageCopy,
  locale: InterfaceLocale,
): CoverageRow {
  const metadata = asRecord(pkg.metadata);
  const coverage = asRecord(metadata?.coverage);
  const schema = resolveCapability({
    value: firstDefined(coverage, ["schema"]),
    fallback: fieldCount > 0 ? "supported" : "unsupported",
    fallbackDetail:
      fieldCount > 0
        ? copy.detail.fieldRowsFound(fieldCount)
        : copy.detail.noFieldRows,
    supportedDetail: copy.detail.fieldRowsFound(fieldCount),
    unsupportedDetail: copy.detail.noSchemaCoverage,
    partialDetail: copy.detail.partialCoverage,
  });

  const documents = resolveCapability({
    value: firstDefined(coverage, ["document_checklist", "documents"]),
    fallback: docStats.total > 0 ? "supported" : "unsupported",
    fallbackDetail:
      docStats.total > 0
        ? copy.detail.documentRowsFound(docStats.total, docStats.required)
        : copy.detail.noDocumentRows,
    supportedDetail: copy.detail.documentRowsFound(docStats.total, docStats.required),
    unsupportedDetail: copy.detail.noDocumentCoverage,
    partialDetail: copy.detail.partialCoverage,
  });

  const payment = resolveCapability({
    value: firstDefined(coverage, ["payment"]),
    fallback: pkg.price_cents !== null ? "partial" : "unsupported",
    fallbackDetail:
      pkg.price_cents !== null
        ? copy.detail.agencyPricePartial(formatMoney(pkg.price_cents, pkg.currency ?? "USD", locale))
        : copy.detail.noPaymentCoverage,
    supportedDetail: copy.detail.paymentEnabled,
    unsupportedDetail: copy.detail.paymentDisabled,
    partialDetail: copy.detail.partialCoverage,
  });

  const packet = resolveCapability({
    value: firstDefined(coverage, ["packet_generation", "packet"]),
    fallback: "unsupported",
    fallbackDetail: copy.detail.noPacketCoverage,
    supportedDetail: copy.detail.packetEnabled,
    unsupportedDetail: copy.detail.packetDisabled,
    partialDetail: copy.detail.partialCoverage,
  });

  const externalHandoff = resolveCapability({
    value: firstDefined(coverage, ["external_submission_handoff", "external_submission"]),
    fallback: "unsupported",
    fallbackDetail: copy.detail.noExternalCoverage,
    supportedDetail: copy.detail.externalEnabled,
    unsupportedDetail: copy.detail.externalDisabled,
    partialDetail: copy.detail.partialCoverage,
  });

  const resultIngest = resolveCapability({
    value: firstDefined(coverage, ["result_ingest", "result_delivery"]),
    fallback: "unsupported",
    fallbackDetail: copy.detail.noResultCoverage,
    supportedDetail: copy.detail.resultEnabled,
    unsupportedDetail: copy.detail.resultDisabled,
    partialDetail: copy.detail.partialCoverage,
  });

  const statusUiFallback = resultIngest.state === "supported" ? "partial" : "unsupported";
  const statusUi = resolveCapability({
    value: firstDefined(coverage, ["status_ui", "status_display"]),
    fallback: statusUiFallback,
    fallbackDetail:
      statusUiFallback === "partial"
        ? copy.detail.resultWithoutStatusUi
        : copy.detail.noStatusUiCoverage,
    supportedDetail: copy.detail.statusUiEnabled,
    unsupportedDetail: copy.detail.statusUiDisabled,
    partialDetail: copy.detail.partialCoverage,
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
    targetLabel: findTargetLabel(pkg, copy),
    schema,
    documents,
    payment,
    packet,
    externalHandoff,
    resultIngest,
    statusUi,
    governmentFee: formatGovernmentFee(metadata, pkg, copy, locale),
    overall: getOverallState(capabilityStates),
  };
}

function resolveCapability({
  value,
  fallback,
  fallbackDetail,
  supportedDetail,
  unsupportedDetail,
  partialDetail,
}: {
  value: unknown;
  fallback: CoverageState;
  fallbackDetail: string;
  supportedDetail: string;
  unsupportedDetail: string;
  partialDetail: string;
}): CapabilityStatus {
  const parsed = parseCoverageValue(value);
  const state = parsed.state ?? fallback;
  const detail =
    parsed.detail ??
    (parsed.state
      ? detailForState(state, supportedDetail, unsupportedDetail, partialDetail)
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
  unsupportedDetail: string,
  partialDetail: string,
): string {
  if (state === "supported") return supportedDetail;
  if (state === "partial") return partialDetail;
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
  pkg: VisaPackageRow,
  copy: PackageCoverageCopy,
  locale: InterfaceLocale,
) {
  const governmentFee = asRecord(metadata?.government_fee);
  if (!governmentFee) return copy.detail.noGovernmentFee;

  const mode = firstString(governmentFee, ["mode", "status"]);
  const label = firstString(governmentFee, ["label", "note", "notes"]);
  const currency = firstString(governmentFee, ["currency"]) ?? pkg.currency ?? "USD";
  const amountCents = firstNumber(governmentFee, ["amount_cents", "amountCents"]);
  const formattedAmount =
    amountCents === undefined ? null : formatMoney(amountCents, currency, locale);

  return [formattedAmount, mode ? toTitleCase(mode) : null, label]
    .filter(Boolean)
    .join(" · ") || copy.detail.incompleteGovernmentFee;
}

function formatMoney(amountCents: number, currency: string, locale: InterfaceLocale) {
  try {
    return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
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

function collectIssues(
  entries: Array<[string, unknown]>,
  copy: PackageCoverageCopy,
): QueryIssue[] {
  return entries
    .filter((entry): entry is [string, unknown] => Boolean(entry[1]))
    .map(([source, error]) => ({ source, message: getErrorMessage(error, copy) }));
}

function isSchemaMissingError(error: unknown): boolean {
  const record = asRecord(error) as QueryErrorLike | null;
  if (!record) return false;

  const code = record.code ?? "";
  const message = `${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();

  return (
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    (message.includes("could not find the") && message.includes("column"))
  );
}

function getErrorMessage(error: unknown, copy: PackageCoverageCopy) {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  const message = record
    ? firstString(record, ["message", "details", "hint"])
    : null;
  return message ?? copy.unknownQueryError;
}

function findTargetLabel(pkg: VisaPackageRow, copy: PackageCoverageCopy) {
  const target = FIRST_BATCH_TARGETS.find((item) => item.matches(pkg));
  if (!target) return null;
  return copy.targets[target.key].label;
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
