"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ClipboardList, MessageCircle, Plane } from "lucide-react";
import { useTranslations } from "next-intl";

export function QuickActionsCard() {
  const t = useTranslations("home.quickActions");

  const actions = [
    { icon: <MessageCircle className="h-4 w-4 shrink-0" />, label: t("visaAI"), href: "/client/chat?agent=visa" },
    { icon: <Plane className="h-4 w-4 shrink-0" />, label: t("travelAI"), href: "/client/chat?agent=travel" },
    { icon: <ClipboardList className="h-4 w-4 shrink-0" />, label: t("viewStatus"), href: "/client/status" },
  ];

  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[240px]">
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">{t("title")}</p>
        <div className="w-full flex flex-col gap-2">
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex items-center gap-2.5 bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.22)] transition-colors rounded-[8px] px-3 py-2 text-white text-[14px] font-medium"
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
