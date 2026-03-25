"use client";

import { motion } from "motion/react";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { geist } from "../../../fonts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

function SectionHeading({ title }: { title: string }) {
  return (
    <motion.p
      className={`${geist.className} text-[22px] sm:text-[26px] md:text-[32px] font-medium text-black tracking-tight`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {title}
    </motion.p>
  );
}

export function BillingTab() {
  const t = useTranslations("settings.billing");

  return (
    <div className="flex flex-col gap-6 w-full">
      <SectionHeading title={t("title")} />
      <motion.div
        className="w-full rounded-xl border border-[#efefef] bg-white"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Empty className="py-12 sm:py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>{t("noPaymentMethods")}</EmptyTitle>
            <EmptyDescription>
              {t("noPaymentDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </motion.div>
    </div>
  );
}
