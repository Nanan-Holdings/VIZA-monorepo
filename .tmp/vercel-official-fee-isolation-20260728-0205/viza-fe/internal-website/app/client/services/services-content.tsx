// @ts-nocheck - lab booking system removed during domain migration

"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Clock } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type Filter = "all" | "scheduled" | "history";
type ServiceVariant = "included" | "primary" | "comingSoon";
type ServicesEntry = {
  id: string;
  title: string;
  dateLabel: string;
  image: string;
  status: string;
  scheduledAt: string;
};

type HistoryGroup = {
  monthLabel: string;
  items: ServicesEntry[];
};

interface ServicesContentProps {
  scheduledEntries: ServicesEntry[];
  historyEntries: ServicesEntry[];
  userAuthId: string | null;
}

type MarketplaceCard = {
  title: string;
  description: string;
  tone: "terra" | "stone";
};

type ServiceCard = {
  title: string;
  description: string;
  image: string;
  cta: string;
  variant: ServiceVariant;
  badge?: string;
};

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-full px-4 xl:px-6 py-[10px] text-[14px] xl:text-base font-medium tracking-[-0.32px] border transition-colors ${
        active ? "bg-[#fdf5f1] text-[#a8644d] border-[#c1785d]" : "text-[#989898] border-[#989898]"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
    >
      {label}
    </motion.button>
  );
}

function MarketplaceTile({ card }: { card: MarketplaceCard }) {
  const t = useTranslations("services");
  const toneClass = card.tone === "terra" ? "bg-[rgba(208,144,116,0.9)]" : "bg-[rgba(143,121,111,0.9)]";

  return (
    <motion.div
      className="relative flex flex-col sm:flex-row w-full xl:flex-1 gap-4 xl:gap-6 rounded-xl bg-[rgba(239,239,239,0.5)] p-4 xl:p-5 shadow-sm"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="relative size-[56px] xl:size-[72px] shrink-0 rounded-md">
        <div className="absolute inset-0 rounded-md bg-white" aria-hidden />
        <div className={`absolute inset-0 rounded-md ${toneClass} opacity-80`} aria-hidden />
        <div className="absolute inset-[6px] rounded-md bg-white" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-2 text-left">
        <p className="text-[20px] font-medium leading-tight tracking-[-0.6px] text-[#4f4f4f]">{card.title}</p>
        <p className="text-[16px] leading-snug tracking-[-0.48px] text-[rgba(0,0,0,0.55)]">{card.description}</p>
      </div>
      <div className="flex items-center w-full sm:w-auto">
        <span className="rounded-full bg-[#dcdcdc] px-6 py-3 text-[14px] xl:text-[16px] font-medium leading-none tracking-[-0.24px] text-[#989898] w-full sm:w-auto text-center">
          {t("comingSoon")}
        </span>
      </div>
    </motion.div>
  );
}

function HistoryCard({ item }: { item: ServicesEntry }) {
  return (
    <div className="bg-white border border-[#efefef] flex items-center gap-4 xl:gap-5 rounded-[16px] p-4 xl:p-5 w-full hover:bg-[#fbfbfb] transition-colors">
      <div className="relative rounded-md shrink-0 size-16 xl:size-20 bg-[#f6f6f6] overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[18px] xl:text-[20px] font-medium leading-[1.3] tracking-[-0.6px] text-[#3d3d3d]">
          {item.title}
        </p>
        <p className="text-[14px] xl:text-[16px] leading-[1.2] tracking-[-0.48px] text-[#989898]">
          {item.dateLabel}
        </p>
      </div>
    </div>
  );
}

function ScheduledCard({
  item,
  onReschedule,
  onCancel,
  isCancelling,
}: {
  item: ServicesEntry;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}) {
  const t = useTranslations("services");
  const canReschedule =
    new Date(item.scheduledAt).getTime() - Date.now() > 24 * 60 * 60 * 1000;

  return (
    <div className="bg-white border border-[#efefef] flex flex-col sm:flex-row sm:items-center gap-4 xl:gap-5 rounded-[16px] p-4 xl:p-5 w-full hover:bg-[#fbfbfb] transition-colors">
      <div className="flex items-center gap-4 xl:gap-5 flex-1 min-w-0">
        <div className="relative rounded-md shrink-0 size-16 xl:size-20 bg-[#f6f6f6] overflow-hidden">
          <img
            src={item.image}
            alt={item.title}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-[18px] xl:text-[20px] font-medium leading-[1.3] tracking-[-0.6px] text-[#3d3d3d]">
            {item.title}
          </p>
          <p className="text-[14px] xl:text-[16px] leading-[1.2] tracking-[-0.48px] text-[#989898]">
            {item.dateLabel}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {canReschedule ? (
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={() => onReschedule(item.id)}
              className="rounded-[999px] bg-black text-white px-6 py-2 xl:py-3 text-[14px] xl:text-[16px] font-medium leading-[1.5] tracking-[-0.24px] shrink-0"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {t("reschedule")}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => onCancel(item.id)}
              disabled={isCancelling}
              className="rounded-[999px] border border-red-600 text-red-600 px-6 py-2 xl:py-3 text-[14px] xl:text-[16px] font-medium leading-[1.5] tracking-[-0.24px] shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {isCancelling ? t("cancelling") : t("cancel")}
            </motion.button>
          </div>
        ) : (
          <p className="text-[13px] text-[#989898] tracking-[-0.2px]">
            {t("cannotReschedule")}
          </p>
        )}
      </div>
    </div>
  );
}

function HistorySection({ group }: { group: HistoryGroup }) {
  const [month, year] = group.monthLabel.split(" ");

  return (
    <div className="flex flex-col gap-4 w-full">
      <p className="text-[20px] xl:text-[24px] font-medium leading-[1.2] tracking-[-0.96px] text-[#3d3d3d]">
        <span>{month} </span>
        <span className="text-[#989898]">{year}</span>
      </p>
      {group.items.map((item) => (
        <HistoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ServiceCardBlock({ card }: { card: ServiceCard }) {
  const buttonClass = useMemo(() => {
    if (card.variant === "primary") return "bg-black text-white hover:-translate-y-0.5";
    if (card.variant === "included") return "bg-[#dcdcdc] text-[#6d6d6d]";
    return "bg-[#dcdcdc] text-[#6d6d6d]";
  }, [card.variant]);

  return (
    <motion.article
      className="relative flex w-full xl:max-w-[320px] flex-col gap-4 xl:gap-6 rounded-xl bg-white p-4 xl:p-6 shadow-sm"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      whileHover={{ y: -6, boxShadow: "0 18px 32px rgba(0,0,0,0.08)" }}
    >
      <div className="relative h-48 xl:h-64 w-full overflow-hidden rounded-xl bg-[#efefef]">
        <img
          src={card.image}
          alt={card.title}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        {/* Temporarily hidden: badge bubble */}
        {/* {card.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-[#fdf5f1] px-3 py-1 text-xs font-semibold text-[#a8644d]">
            {card.badge}
          </span>
        )} */}
      </div>
      <div className="flex flex-col gap-4 text-left">
        <h3 className="text-[20px] xl:text-[24px] font-semibold leading-tight tracking-[-0.72px] text-[#3d3d3d]">
          {card.title}
        </h3>
        <p className="text-[16px] leading-relaxed tracking-[-0.24px] text-[rgba(0,0,0,0.65)]">
          {card.description}
        </p>
      </div>
      <motion.button
        type="button"
        className={`w-full rounded-full px-6 py-3 xl:py-4 text-[15px] xl:text-[16px] font-medium tracking-[-0.24px] transition-transform ${buttonClass}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        {card.cta}
      </motion.button>
    </motion.article>
  );
}

export function ServicesContent({ scheduledEntries, historyEntries, userAuthId }: ServicesContentProps) {
  const t = useTranslations("services");
  const [filter, setFilter] = useState<Filter>("scheduled");
  const [rescheduleOrderId, setRescheduleOrderId] = useState<string | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const marketplaceCards: MarketplaceCard[] = [
    { title: t("marketplace.supplement.title"), description: t("marketplace.supplement.description"), tone: "terra" },
    { title: t("marketplace.service_request.title"), description: t("marketplace.service_request.description"), tone: "stone" },
  ];

  const recommendedCards: ServiceCard[] = [
    { title: t("cards.bloodPanel.title"), description: t("cards.bloodPanel.description"), image: "https://placehold.co/640x400/efefef/3d3d3d?text=Blood+Panel", cta: t("cards.bloodPanel.cta"), variant: "included" },
    { title: t("cards.advancedBloodPanel.title"), description: t("cards.advancedBloodPanel.description"), image: "https://placehold.co/640x400/e8e4da/111111?text=Advanced+Blood+Panel", cta: t("cards.advancedBloodPanel.cta"), variant: "primary", badge: t("cards.advancedBloodPanel.badge") },
  ];

  const personalizedCards: ServiceCard[] = [
    { title: t("cards.glp1.title"), description: t("cards.glp1.description"), image: "https://placehold.co/640x400/f7f2e6/3d3d3d?text=GLP-1+Treatment", cta: t("cards.glp1.cta"), variant: "primary" },
  ];

  const upcomingCards: ServiceCard[] = [
    { title: t("cards.allergyTesting.title"), description: t("cards.allergyTesting.description"), image: "https://placehold.co/640x400/f5f5f5/3d3d3d?text=Allergy+Testing", cta: t("cards.allergyTesting.cta"), variant: "comingSoon" },
    { title: t("cards.cancerTest.title"), description: t("cards.cancerTest.description"), image: "https://placehold.co/640x400/e6e1ff/3d3d3d?text=Multi+Cancer+Test", cta: t("cards.cancerTest.cta"), variant: "comingSoon" },
    { title: t("cards.dexaScan.title"), description: t("cards.dexaScan.description"), image: "https://placehold.co/640x400/f3f7ff/3d3d3d?text=DEXA+Scan", cta: t("cards.dexaScan.cta"), variant: "comingSoon" },
    { title: t("cards.gutMicrobiome.title"), description: t("cards.gutMicrobiome.description"), image: "https://placehold.co/640x400/eef7f0/3d3d3d?text=Microbiome+Testing", cta: t("cards.gutMicrobiome.cta"), variant: "comingSoon" },
    { title: t("cards.toxicology.title"), description: t("cards.toxicology.description"), image: "https://placehold.co/640x400/f5efe6/3d3d3d?text=Toxicology+Testing", cta: t("cards.toxicology.cta"), variant: "comingSoon" },
  ];

  const historyGroups = useMemo<HistoryGroup[]>(() => {
    const grouped = new Map<string, ServicesEntry[]>();

    historyEntries.forEach((entry) => {
      const date = new Date(entry.scheduledAt);
      const monthLabel = Number.isNaN(date.getTime())
        ? "Unknown Date"
        : new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Manila",
          }).format(date);

      const existing = grouped.get(monthLabel) ?? [];
      grouped.set(monthLabel, [...existing, entry]);
    });

    return Array.from(grouped.entries()).map(([monthLabel, items]) => ({
      monthLabel,
      items,
    }));
  }, [historyEntries]);

  const isHistory = filter === "history";
  const hasScheduled = scheduledEntries.length > 0;
  const hasHistory = historyGroups.length > 0;
  const showEmpty = (filter === "scheduled" && !hasScheduled) || (isHistory && !hasHistory);

  return (
    <div className="w-full bg-[#fcfcfc] text-left text-[#3d3d3d]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 xl:gap-12 pb-16">
        <motion.section
          className="flex flex-col gap-6 pt-2 xl:pt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="hidden xl:block text-[44px] font-semibold tracking-[-1.2px]">{t("title")}</h1>
          <div className="flex flex-wrap gap-3">
            {/* Temporarily hidden: All tab */}
            {/* <FilterButton label="All" active={filter === "all"} onClick={() => setFilter("all")} /> */}
            <FilterButton label={t("scheduled")} active={filter === "scheduled"} onClick={() => setFilter("scheduled")} />
            <FilterButton label={t("yourHistory")} active={filter === "history"} onClick={() => setFilter("history")} />
          </div>
        </motion.section>

        {showEmpty ? (
          <motion.section
            className="w-full"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="rounded-xl border border-[#efefef] bg-white">
              <Empty className="py-16 sm:py-20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {filter === "scheduled" ? <Calendar /> : <Clock />}
                  </EmptyMedia>
                  <EmptyTitle>
                    {filter === "scheduled"
                      ? t("noScheduledServices")
                      : t("noServiceHistory")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {filter === "scheduled"
                      ? t("noScheduledDescription")
                      : t("noHistoryDescription")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          </motion.section>
        ) : isHistory ? (
          <motion.section
            className="flex flex-col gap-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {historyGroups.map((group) => (
              <HistorySection key={group.monthLabel} group={group} />
            ))}
          </motion.section>
        ) : filter === "scheduled" ? (
          <motion.section
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {scheduledEntries.map((item) => (
              <ScheduledCard
                key={item.id}
                item={item}
                onReschedule={(id) => {
                  setRescheduleOrderId(id);
                  setIsModalOpen(true);
                }}
                onCancel={(id) => {
                  setCancelError(null);
                  setConfirmCancelOrderId(id);
                }}
                isCancelling={cancellingOrderId === item.id}
              />
            ))}
          </motion.section>
        ) : (
          <div className="flex flex-col gap-10 xl:gap-16">
            <motion.section
              className="flex flex-col xl:flex-row items-stretch gap-4 xl:gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {marketplaceCards.map((card) => (
                <MarketplaceTile key={card.title} card={card} />
              ))}
            </motion.section>

            <motion.section
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div>
                <p className="text-[24px] xl:text-[32px] font-semibold leading-tight tracking-[-0.72px] xl:tracking-[-1.0px]">{t("recommended.heading")}</p>
                <p className="text-[15px] xl:text-[18px] font-medium leading-tight tracking-[-0.4px] text-[#989898]">
                  {t("recommended.subheading")}
                </p>
              </div>
              <div className="flex flex-col xl:flex-row xl:flex-wrap gap-4 xl:gap-5">
                {recommendedCards.map((card) => (
                  <ServiceCardBlock key={card.title} card={card} />
                ))}
              </div>
            </motion.section>

            <motion.section
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div>
                <p className="text-[24px] xl:text-[32px] font-semibold leading-tight tracking-[-0.72px] xl:tracking-[-1.0px]">{t("personalized.heading")}</p>
                <p className="text-[15px] xl:text-[18px] font-medium leading-tight tracking-[-0.4px] text-[#989898]">
                  {t("personalized.subheading")}
                </p>
              </div>
              <div className="flex flex-col xl:flex-row xl:flex-wrap gap-4 xl:gap-5">
                {personalizedCards.map((card) => (
                  <ServiceCardBlock key={card.title} card={card} />
                ))}
              </div>
            </motion.section>

            <motion.section
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div>
                <p className="text-[24px] xl:text-[32px] font-semibold leading-tight tracking-[-0.72px] xl:tracking-[-1.0px]">{t("upcoming.heading")}</p>
                <p className="text-[15px] xl:text-[18px] font-medium leading-tight tracking-[-0.4px] text-[#989898]">
                  {t("upcoming.subheading")}
                </p>
              </div>
              <div className="flex flex-col xl:flex-row xl:flex-wrap gap-4 xl:gap-5">
                {upcomingCards.map((card) => (
                  <ServiceCardBlock key={card.title} card={card} />
                ))}
              </div>
            </motion.section>
          </div>
        )}
      </div>

      <AlertDialog
        open={confirmCancelOrderId !== null}
        onOpenChange={(open) => {
          if (!open && !cancellingOrderId) {
            setConfirmCancelOrderId(null);
            setCancelError(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[420px] rounded-xl border border-[#efefef] bg-white p-6 sm:p-6">
          <div className="flex flex-col gap-5">
            <AlertDialogTitle className="text-[24px] font-semibold leading-tight tracking-[-0.72px] text-[#3d3d3d]">
              {t("cancelDialog.title")}
            </AlertDialogTitle>

            {cancelError ? (
              <p className="text-[14px] leading-[1.4] tracking-[-0.24px] text-red-600">{cancelError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!cancellingOrderId) {
                    setConfirmCancelOrderId(null);
                    setCancelError(null);
                  }
                }}
                disabled={Boolean(cancellingOrderId)}
                className="rounded-[999px] border border-[#989898] px-6 py-2 text-[14px] xl:text-[16px] font-medium leading-[1.5] tracking-[-0.24px] text-[#3d3d3d] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t("cancelDialog.keep")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirmCancelOrderId) return;

                  try {
                    setCancellingOrderId(confirmCancelOrderId);
                    setCancelError(null);

                    const result = await cancelBooking(confirmCancelOrderId);

                    if (!result.success) {
                      setCancelError(result.error ?? "Failed to cancel booking. Please try again.");
                      return;
                    }

                    setConfirmCancelOrderId(null);
                    router.refresh();
                  } finally {
                    setCancellingOrderId(null);
                  }
                }}
                disabled={Boolean(cancellingOrderId)}
                className="rounded-[999px] border border-red-600 px-6 py-2 text-[14px] xl:text-[16px] font-medium leading-[1.5] tracking-[-0.24px] text-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cancellingOrderId ? t("cancelling") : t("cancel")}
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <BloodPanelBookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setRescheduleOrderId(null);
        }}
        userId={userAuthId ?? ""}
        initialStep={2}
        onSuccess={async (newBookingId) => {
          if (rescheduleOrderId) {
            await cancelBooking(rescheduleOrderId);
          }
          setIsModalOpen(false);
          setRescheduleOrderId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
