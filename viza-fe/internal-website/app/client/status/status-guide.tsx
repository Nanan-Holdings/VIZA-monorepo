import {
  CheckCircle,
  Clock,
  FileText,
  Info,
  Queue,
  Warning,
  XCircle,
} from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

type StatusGuideTranslation = (key: string) => string;

const STATUS_GUIDE_ITEMS = [
  { key: "draft", tone: "neutral", icon: FileText },
  { key: "missingInfo", tone: "orange", icon: Warning },
  { key: "review", tone: "blue", icon: Info },
  { key: "queued", tone: "blue", icon: Queue },
  { key: "officialFilling", tone: "blue", icon: Clock },
  { key: "userAction", tone: "orange", icon: Warning },
  { key: "submitted", tone: "green", icon: CheckCircle },
  { key: "recoverableFailed", tone: "red", icon: XCircle },
] as const;

const TONE_CLASS = {
  neutral: {
    icon: "bg-[#f2f5f8] text-[#526173]",
    rail: "bg-[#cbd5e1]",
  },
  blue: {
    icon: "bg-brand-50 text-brand-600",
    rail: "bg-brand-500",
  },
  orange: {
    icon: "bg-amber-50 text-amber-700",
    rail: "bg-amber-500",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-700",
    rail: "bg-emerald-600",
  },
  red: {
    icon: "bg-red-50 text-red-700",
    rail: "bg-red-600",
  },
} as const;

export function StatusGuide({
  t,
  className,
}: {
  t: StatusGuideTranslation;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5", className)} aria-labelledby="status-guide-title">
      <div className="max-w-3xl">
        <h2 id="status-guide-title" className="font-heading text-[22px] font-medium text-[#26364a]">
          {t("statusGuide.title")}
        </h2>
        <p className="mt-1 text-[14px] leading-6 text-[#66758a]">
          {t("statusGuide.description")}
        </p>
      </div>
      <dl className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#e4e9f1] bg-white md:grid-cols-2">
        {STATUS_GUIDE_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const tone = TONE_CLASS[item.tone];

          return (
            <div
              key={item.key}
              className={cn(
                "relative flex gap-3 border-[#edf1f6] px-4 py-4",
                index > 0 && "border-t",
                index === 1 && "md:border-t-0",
                index % 2 === 1 && "md:border-l"
              )}
            >
              <span
                aria-hidden="true"
                className={cn("mt-0.5 h-9 w-9 shrink-0 rounded-md p-2", tone.icon)}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn("mt-1 h-[calc(100%-0.5rem)] w-1 shrink-0 rounded-full", tone.rail)} aria-hidden="true" />
              <span className="min-w-0">
                <dt className="text-[14px] font-semibold text-[#26364a]">
                  {t(`statusGuide.items.${item.key}.title`)}
                </dt>
                <dd className="mt-1 text-[13px] leading-5 text-[#66758a]">
                  {t(`statusGuide.items.${item.key}.description`)}
                </dd>
              </span>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
