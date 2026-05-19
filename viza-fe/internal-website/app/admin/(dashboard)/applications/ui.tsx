import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  FileText,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-gray-200 bg-gray-50 text-gray-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  brand: "border-brand-200 bg-brand-50 text-brand-500",
};

const TONE_ICONS: Record<Tone, LucideIcon> = {
  neutral: CircleDot,
  success: CheckCircle2,
  warning: Clock3,
  danger: XCircle,
  info: FileText,
  brand: CheckCircle2,
};

export function getToneForState(state: string): Tone {
  if (/(complete|paid|ready|approved|delivered|received)/i.test(state)) return "success";
  if (/(pending|missing|collection|generation|progress|submitted|handoff)/i.test(state)) return "warning";
  if (/(failed|rejected|declined|attention|refunded)/i.test(state)) return "danger";
  if (/(external|result|submitted)/i.test(state)) return "info";
  return "neutral";
}

export function StatusPill({
  children,
  tone = "neutral",
  icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  const Icon = icon ?? TONE_ICONS[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function SectionPanel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#efefef] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#efefef] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#232323]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[#6b6b6b]">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function FieldValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.04em] text-[#7a7a7a]">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm font-medium text-[#232323]", mono && "font-mono text-xs")}>
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-lg border px-4 py-3", TONE_CLASSES[tone])}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#d5d5d5] bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-[#232323]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6b6b6b]">{body}</p>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Unable to load application monitoring</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function ResourceLink({
  href,
  label,
}: {
  href: string | null | undefined;
  label: string;
}) {
  if (!href) return <span className="text-[#9ca3af]">Not available</span>;

  if (/^https?:\/\//i.test(href)) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:underline"
      >
        {label}
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return <span className="break-all font-mono text-xs text-[#45556c]">{href}</span>;
}
