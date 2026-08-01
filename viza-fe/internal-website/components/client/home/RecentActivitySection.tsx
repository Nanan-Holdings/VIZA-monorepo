"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";

export interface ActivityEvent {
  id: string;
  eventType: "document_upload" | "status_change" | "application_created";
  label: string;
  sublabel: string;
  timestamp: string;
  icon: "upload" | "check" | "clock" | "alert";
  href?: string;
}

type ActivityTranslator = ReturnType<typeof useTranslations<"home.activity">>;

function formatRelative(
  date: Date,
  locale: string,
  t: ActivityTranslator
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t("justNow");
  if (diffMins < 60) return t("minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("daysAgo", { count: diffDays });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

const ACTIVITY_IMAGE: Record<ActivityEvent["icon"], string> = {
  upload: "/images/home-activity/document-uploaded.png",
  check: "/images/home-activity/application-submitted.png",
  alert: "/images/home-activity/action-required.png",
  clock: "/images/home-activity/application-created.png",
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const locale = useLocale();
  const t = useTranslations("home.activity");
  const content = (
    <div className="flex min-h-[96px] w-full items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-[#f4f1ec] sm:size-16">
        <Image
          src={ACTIVITY_IMAGE[event.icon]}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[16px] font-medium leading-[1.3] tracking-[-0.48px] text-[#171717]">
          {event.label}
        </p>
        <p className="mt-1 truncate font-sans text-[14px] font-normal leading-[1.3] tracking-[-0.42px] text-[#737373]">
          {event.sublabel}
        </p>
        <p className="mt-2 text-[12px] text-[#a3a3a3] sm:hidden">
          {formatRelative(new Date(event.timestamp), locale, t)}
        </p>
      </div>
      <p className="hidden shrink-0 font-sans text-[13px] text-[#a3a3a3] sm:block">
        {formatRelative(new Date(event.timestamp), locale, t)}
      </p>
      {event.href ? (
        <ChevronRight
          className="h-5 w-5 shrink-0 text-[#a3a3a3]"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );

  if (event.href) {
    return (
      <Link
        href={event.href}
        className="block w-full bg-white transition-colors hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/25"
      >
        {content}
      </Link>
    );
  }

  return <div className="w-full bg-white">{content}</div>;
}

interface Props {
  events: ActivityEvent[];
}

export function RecentActivitySection({ events }: Props) {
  const t = useTranslations("home");

  if (events.length === 0) {
    return (
      <div className="w-full max-w-[1090px] pb-[80px]">
        <ApplicationFormPanel className="w-full p-6 text-center">
          <p className="font-sans text-[14px] text-[rgba(0,0,0,0.45)]">
            {t("noRecentActivity")}
          </p>
        </ApplicationFormPanel>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1090px] pb-[80px]">
      <ApplicationFormPanel className="w-full divide-y divide-[#efefef] overflow-hidden p-0">
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
      </ApplicationFormPanel>
    </div>
  );
}
