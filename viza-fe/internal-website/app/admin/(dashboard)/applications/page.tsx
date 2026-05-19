import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/rbac";
import {
  CONSENT_LABELS,
  DOCUMENT_LABELS,
  EXTERNAL_LABELS,
  LIFECYCLE_LABELS,
  PACKET_LABELS,
  PAYMENT_LABELS,
  RESULT_LABELS,
  type AdminApplicationModel,
  type ConsentState,
  type DocumentState,
  type ExternalState,
  type LifecycleState,
  type PacketState,
  type PaymentState,
  type ResultState,
  fetchAdminApplicationQueue,
  formatDateTime,
  formatMoney,
  shortenId,
} from "./data";
import { EmptyState, ErrorPanel, MetricTile, StatusPill, getToneForState } from "./ui";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParams>;
}

interface ActiveFilters {
  lifecycle: LifecycleState | "all";
  payment: PaymentState | "all";
  consent: ConsentState | "all";
  documents: DocumentState | "all";
  packet: PacketState | "all";
  external: ExternalState | "all";
  result: ResultState | "all";
}

const LIFECYCLE_OPTIONS = Object.keys(LIFECYCLE_LABELS) as LifecycleState[];
const PAYMENT_OPTIONS = Object.keys(PAYMENT_LABELS) as PaymentState[];
const CONSENT_OPTIONS = Object.keys(CONSENT_LABELS) as ConsentState[];
const DOCUMENT_OPTIONS = Object.keys(DOCUMENT_LABELS) as DocumentState[];
const PACKET_OPTIONS = Object.keys(PACKET_LABELS) as PacketState[];
const EXTERNAL_OPTIONS = Object.keys(EXTERNAL_LABELS) as ExternalState[];
const RESULT_OPTIONS = Object.keys(RESULT_LABELS) as ResultState[];

function firstParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getFilterValue<T extends string>(
  searchParams: SearchParams,
  key: string,
  allowed: readonly T[],
): T | "all" {
  const value = firstParam(searchParams, key);
  return value && allowed.includes(value as T) ? (value as T) : "all";
}

function parseFilters(searchParams: SearchParams): ActiveFilters {
  return {
    lifecycle: getFilterValue(searchParams, "lifecycle", LIFECYCLE_OPTIONS),
    payment: getFilterValue(searchParams, "payment", PAYMENT_OPTIONS),
    consent: getFilterValue(searchParams, "consent", CONSENT_OPTIONS),
    documents: getFilterValue(searchParams, "documents", DOCUMENT_OPTIONS),
    packet: getFilterValue(searchParams, "packet", PACKET_OPTIONS),
    external: getFilterValue(searchParams, "external", EXTERNAL_OPTIONS),
    result: getFilterValue(searchParams, "result", RESULT_OPTIONS),
  };
}

function matchesFilters(row: AdminApplicationModel, filters: ActiveFilters): boolean {
  return (
    (filters.lifecycle === "all" || row.lifecycleState === filters.lifecycle) &&
    (filters.payment === "all" || row.payment.state === filters.payment) &&
    (filters.consent === "all" || row.consent.state === filters.consent) &&
    (filters.documents === "all" || row.documents.state === filters.documents) &&
    (filters.packet === "all" || row.packet.state === filters.packet) &&
    (filters.external === "all" || row.external.state === filters.external) &&
    (filters.result === "all" || row.result.state === filters.result)
  );
}

function countRows(rows: AdminApplicationModel[], predicate: (row: AdminApplicationModel) => boolean): number {
  return rows.filter(predicate).length;
}

function FilterSelect<T extends string>({
  label,
  name,
  value,
  options,
  labels,
}: {
  label: string;
  name: keyof ActiveFilters;
  value: T | "all";
  options: readonly T[];
  labels: Record<T, string>;
}) {
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-[#6b6b6b]">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-medium text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function QueueFilters({ filters }: { filters: ActiveFilters }) {
  return (
    <form className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#232323]">
        <Filter className="h-4 w-4 text-brand-500" />
        Queue filters
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Lifecycle"
          name="lifecycle"
          value={filters.lifecycle}
          options={LIFECYCLE_OPTIONS}
          labels={LIFECYCLE_LABELS}
        />
        <FilterSelect
          label="Payment"
          name="payment"
          value={filters.payment}
          options={PAYMENT_OPTIONS}
          labels={PAYMENT_LABELS}
        />
        <FilterSelect
          label="Consent"
          name="consent"
          value={filters.consent}
          options={CONSENT_OPTIONS}
          labels={CONSENT_LABELS}
        />
        <FilterSelect
          label="Missing documents"
          name="documents"
          value={filters.documents}
          options={DOCUMENT_OPTIONS}
          labels={DOCUMENT_LABELS}
        />
        <FilterSelect
          label="Packet"
          name="packet"
          value={filters.packet}
          options={PACKET_OPTIONS}
          labels={PACKET_LABELS}
        />
        <FilterSelect
          label="External status"
          name="external"
          value={filters.external}
          options={EXTERNAL_OPTIONS}
          labels={EXTERNAL_LABELS}
        />
        <FilterSelect
          label="Result"
          name="result"
          value={filters.result}
          options={RESULT_OPTIONS}
          labels={RESULT_LABELS}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-10 bg-brand-500 text-white hover:bg-brand-600">
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10 border-[#d7d7d7]">
            <Link href="/admin/applications">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function QueueRow({ row }: { row: AdminApplicationModel }) {
  const lifecycleTone = getToneForState(row.lifecycleState);
  const missing = row.missingItems.slice(0, 2);

  return (
    <tr className="border-b transition-colors hover:bg-[#fafafa]">
      <td className="px-4 py-4 align-top">
        <div className="min-w-[220px]">
          <Link href={`/admin/applications/${row.id}`} className="font-semibold text-brand-500 hover:underline">
            {row.profile?.full_name || "Unnamed applicant"}
          </Link>
          <p className="mt-1 text-xs text-[#6b6b6b]">{row.profile?.email || "No email"}</p>
          <p className="mt-1 font-mono text-xs text-[#9ca3af]">{shortenId(row.id)}</p>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="min-w-[180px]">
          <p className="text-sm font-medium text-[#232323]">{row.countryLabel}</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">{row.visaPackage?.name || row.visaTypeLabel}</p>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <StatusPill tone={lifecycleTone}>{LIFECYCLE_LABELS[row.lifecycleState]}</StatusPill>
        {row.lifecycleState === "ready_for_external_handoff" && (
          <p className="mt-2 max-w-[210px] text-xs leading-5 text-[#6b6b6b]">
            Automated handoff state; no staff approval is required.
          </p>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-2">
          <StatusPill tone={getToneForState(row.payment.state)}>{PAYMENT_LABELS[row.payment.state]}</StatusPill>
          <span className="text-xs text-[#6b6b6b]">
            {row.payment.latest
              ? formatMoney(row.payment.latest.amount_cents, row.payment.latest.currency)
              : "No agency fee record"}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-2">
          <StatusPill tone={getToneForState(row.consent.state)}>{CONSENT_LABELS[row.consent.state]}</StatusPill>
          <StatusPill tone={getToneForState(row.documents.state)}>{DOCUMENT_LABELS[row.documents.state]}</StatusPill>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-2">
          <StatusPill tone={getToneForState(row.packet.state)}>{PACKET_LABELS[row.packet.state]}</StatusPill>
          <StatusPill tone={getToneForState(row.external.state)}>{EXTERNAL_LABELS[row.external.state]}</StatusPill>
          <StatusPill tone={getToneForState(row.result.state)}>{RESULT_LABELS[row.result.state]}</StatusPill>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        {missing.length > 0 ? (
          <ul className="max-w-[250px] space-y-1 text-xs leading-5 text-[#6b6b6b]">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {row.missingItems.length > missing.length && <li>{row.missingItems.length - missing.length} more</li>}
          </ul>
        ) : (
          <span className="text-xs font-medium text-emerald-700">No blocking support items</span>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <div className="min-w-[170px] text-xs text-[#6b6b6b]">
          <p>{formatDateTime(row.updatedAt ?? row.createdAt)}</p>
          <p className="mt-1 truncate">{row.latestEvent?.message || row.latestEvent?.event_type || "No events yet"}</p>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <Button asChild variant="outline" size="sm" className="border-[#d7d7d7]">
          <Link href={`/admin/applications/${row.id}`}>
            Open
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseFilters(resolvedSearchParams);
  const { rows, error } = await fetchAdminApplicationQueue();
  const filteredRows = rows.filter((row) => matchesFilters(row, filters));

  const metrics = [
    { label: "Total", value: rows.length, tone: "neutral" as const },
    {
      label: "Needs support",
      value: countRows(rows, (row) => row.lifecycleState === "attention" || row.missingItems.length > 0),
      tone: "warning" as const,
    },
    {
      label: "Ready for external",
      value: countRows(rows, (row) => row.lifecycleState === "ready_for_external_handoff"),
      tone: "brand" as const,
    },
    {
      label: "Completed",
      value: countRows(rows, (row) => row.lifecycleState === "completed"),
      tone: "success" as const,
    },
  ];

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#232323]">Application Monitoring</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
            Staff visibility for customer support, packet readiness, external handoff state, and result delivery.
          </p>
        </div>
        <p className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-500">
          Monitor and support only
        </p>
      </div>

      {error ? (
        <ErrorPanel message={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
            ))}
          </div>

          <QueueFilters filters={filters} />

          <div className="rounded-lg border border-[#efefef] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#232323]">Monitoring queue</h2>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  Showing {filteredRows.length} of {rows.length} application records
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No applications found"
                  body="Applications will appear here once applicants start a visa workflow."
                />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No matching applications"
                  body="Adjust the filters to see more monitoring records."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#fafafa]">
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Applicant</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Package</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Lifecycle</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Payment</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Consent / Docs</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Packet / External / Result</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Missing items</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Last update</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6b6b6b]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <QueueRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
