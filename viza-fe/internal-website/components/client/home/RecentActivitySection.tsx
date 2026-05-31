"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export interface ActivityEvent {
  id: string;
  eventType: "document_upload" | "status_change" | "application_created";
  label: string;
  sublabel: string;
  timestamp: string;
  icon: "upload" | "check" | "clock" | "alert";
  href?: string;
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActivityIcon({ type }: { type: ActivityEvent["icon"] }) {
  const cls = "h-5 w-5";
  switch (type) {
    case "upload": return <Upload className={`${cls} text-brand-400`} />;
    case "check": return <CheckCircle2 className={`${cls} text-green-500`} />;
    case "alert": return <AlertCircle className={`${cls} text-red-500`} />;
    default: return <Clock className={`${cls} text-gray-400`} />;
  }
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const content = (
    <div className="flex items-center w-full p-[16px] xl:p-[20px] gap-[16px] xl:gap-[20px]">
      <div className="flex items-center justify-center shrink-0 size-[56px] rounded-[8px] bg-[#f6f6f6]">
        <ActivityIcon type={event.icon} />
      </div>
      <div className="flex flex-col gap-[4px] min-w-0 flex-1">
        <p className="font-sans font-medium leading-[1.3] text-[#3d3d3d] text-[16px] tracking-[-0.48px] truncate">
          {event.label}
        </p>
        <p className="font-sans font-normal leading-[1.3] text-[14px] text-[rgba(0,0,0,0.45)] tracking-[-0.42px] truncate">
          {event.sublabel}
        </p>
      </div>
      <p className="font-sans text-[13px] text-[rgba(0,0,0,0.35)] shrink-0 hidden xl:block">
        {formatRelative(new Date(event.timestamp))}
      </p>
    </div>
  );
  const className =
    "block w-full rounded-[16px] border border-[#efefef] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

  if (event.href) {
    return (
      <Link href={event.href} className={`${className} hover:border-brand-200 hover:bg-brand-50/40`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

interface Props {
  events: ActivityEvent[];
}

export function RecentActivitySection({ events }: Props) {
  const t = useTranslations("home");

  if (events.length === 0) {
    return (
      <div className="w-full max-w-[1090px] pb-[80px]">
        <div className="w-full rounded-[16px] border border-[#efefef] bg-white p-[24px] text-center">
          <p className="font-sans text-[14px] text-[rgba(0,0,0,0.45)]">
            {t("noRecentActivity")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1090px] flex flex-col gap-[12px] pb-[80px]">
      {events.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.4 }}
        >
          <ActivityRow event={event} />
        </motion.div>
      ))}
    </div>
  );
}
