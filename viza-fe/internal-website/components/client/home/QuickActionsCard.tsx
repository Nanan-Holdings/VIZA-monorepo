"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ClipboardList, MessageCircle, Plane } from "lucide-react";
import { useTranslations } from "next-intl";

export function QuickActionsCard() {
  const t = useTranslations("home.quickActions");

  const actions = [
    {
      icon: <MessageCircle className="h-4 w-4 shrink-0" />,
      label: t("visaAI"),
      href: "/client/chat?agent=visa",
    },
    {
      icon: <Plane className="h-4 w-4 shrink-0" />,
      label: t("travelAI"),
      href: "/client/chat?agent=travel",
    },
    {
      icon: <ClipboardList className="h-4 w-4 shrink-0" />,
      label: t("viewStatus"),
      href: "/client/status",
    },
  ];

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div className="relative flex h-[240px] w-full flex-col justify-between rounded-[12px] border border-white/20 bg-white/12 p-6 backdrop-blur-md">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/60">
          {t("title")}
        </p>
        <div className="w-full flex flex-col gap-2">
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex min-h-11 items-center gap-2.5 rounded-[8px] bg-white/10 px-3 py-2 text-[14px] font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
