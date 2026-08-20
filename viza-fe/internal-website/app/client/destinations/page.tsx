"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, FilePlus2, Loader2, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { PopularDestinationsSection } from "@/components/client/home/PopularDestinationsSection";
import { getUserVisaPackages, type UserVisaPackage } from "@/app/actions/user-package";
import { ensureDraftApplication } from "@/app/actions/visa-application-answers";
import { getApplicationPaymentRecords } from "@/app/actions/application-lifecycle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildApplicationProgress,
  getNextApplicationHref,
  isFormComplete,
  type AnswerRow,
  type ApplicationRow,
  type DestinationApplicationProgress,
  type DocumentRow,
  type FormFieldSchemaMap,
  type PaymentRow,
} from "@/lib/client/application-progress";
import {
  getFormVisaType,
  getDestinationFlag,
  getVisaDestinationKey,
  getVisaPackageTitle,
  type PopularVisaDestination,
} from "@/lib/visa-destinations";
import {
  getRecentApplicationFormHref,
  readApplicationFormTarget,
} from "@/lib/client/recent-application-form";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  dbRowToFormField,
  type VisaFormFieldDbRow,
} from "@/types/visa-form-fields";

interface MyDestinationEntry {
  key: string;
  country: string;
  visaType: string;
  progress: DestinationApplicationProgress | null;
  applicationId: string | null;
  formComplete: boolean;
  href: string;
}

export default function DestinationsPage() {
  const t = useTranslations("destinationsPage");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [visaPackages, setVisaPackages] = useState<UserVisaPackage[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [applicationProgress, setApplicationProgress] = useState<
    Record<string, DestinationApplicationProgress>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllOngoing, setShowAllOngoing] = useState(false);
  const [showAllPurchased, setShowAllPurchased] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MyDestinationEntry | null>(null);
  const [choiceAction, setChoiceAction] = useState<"new" | "continue" | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [handledRouteSelection, setHandledRouteSelection] = useState<string | null>(null);

  useEffect(() => {
    const target = readApplicationFormTarget(getRecentApplicationFormHref());
    if (target?.country && target.visaType) {
      setCurrentKey(getVisaDestinationKey(target.country, target.visaType));
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const packages = await getUserVisaPackages();
      setVisaPackages(packages);

      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!profile) return;

      const { data: appRows } = await supabase
        .from("applications")
        .select("id, status, country, visa_type, visa_package_id, submission_result_status, submitted_at, created_at, updated_at")
        .eq("applicant_id", (profile as { id: string }).id)
        .order("created_at", { ascending: false });

      const loadedApplications = (appRows ?? []) as ApplicationRow[];
      setApplications(loadedApplications);
      if (loadedApplications.length === 0) return;

      const applicationIds = loadedApplications.map((app) => app.id);
      const packageIds = loadedApplications
        .map((app) => app.visa_package_id)
        .filter((id): id is string => Boolean(id));
      const visaTypes = [
        ...new Set(loadedApplications.map((app) => getFormVisaType(app.visa_type))),
      ];

      const [{ data: docs }, { data: answers }, { data: fieldRows }, loadedPayments] = await Promise.all([
        supabase
          .from("application_documents")
          .select("id, application_id, document_type, status, created_at, updated_at")
          .in("application_id", applicationIds),
        supabase
          .from("visa_application_answers")
          .select("application_id, field_name, value_text, updated_at")
          .in("application_id", applicationIds),
        supabase
          .from("visa_form_fields")
          .select("*")
          .in("visa_type", visaTypes)
          .order("step_number", { ascending: true })
          .order("display_order", { ascending: true }),
        getApplicationPaymentRecords(applicationIds, packageIds),
      ]);

      setPayments(loadedPayments);
      const fieldSchemas = ((fieldRows ?? []) as VisaFormFieldDbRow[]).reduce<FormFieldSchemaMap>(
        (schemas, row) => {
          const key = row.visa_type.toLowerCase();
          const existing = schemas.get(key) ?? [];
          existing.push(dbRowToFormField(row));
          schemas.set(key, existing);
          return schemas;
        },
        new Map(),
      );

      setApplicationProgress(
        buildApplicationProgress(
          loadedApplications,
          (docs ?? []) as DocumentRow[],
          (answers ?? []) as AnswerRow[],
          fieldSchemas,
          isZh,
        ),
      );
    } catch {
      // A short-lived client/Supabase connection failure should not be promoted
      // to a Next.js development overlay while the applicant is changing pages.
      setLoadError(
        isZh
          ? "暂时无法加载申请记录，请刷新页面后重试。"
          : "We could not load your application records. Refresh the page and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isZh]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Two groups: applications already started ("ongoing") and purchased packages
  // the user hasn't opened an application for yet ("purchased").
  const { ongoing, purchased } = useMemo<{
    ongoing: MyDestinationEntry[];
    purchased: MyDestinationEntry[];
  }>(() => {
    const ongoingMap = new Map<string, MyDestinationEntry>();

    for (const application of applications) {
      const key = getVisaDestinationKey(application.country, application.visa_type);
      const progress = applicationProgress[key] ?? null;
      // One card per destination — keep the application the progress map picked.
      if (ongoingMap.has(key) && progress?.applicationId !== application.id) continue;
      ongoingMap.set(key, {
        key,
        country: application.country,
        visaType: application.visa_type,
        progress,
        applicationId: progress?.applicationId ?? application.id,
        formComplete: isFormComplete(application),
        href: getNextApplicationHref(application, payments),
      });
    }

    const purchasedMap = new Map<string, MyDestinationEntry>();
    for (const pkg of visaPackages) {
      const key = getVisaDestinationKey(pkg.country, pkg.visa_type);
      // Skip packages already represented by a started application.
      if (ongoingMap.has(key) || purchasedMap.has(key)) continue;
      const params = new URLSearchParams({ country: pkg.country, visaType: pkg.visa_type });
      purchasedMap.set(key, {
        key,
        country: pkg.country,
        visaType: pkg.visa_type,
        progress: null,
        applicationId: null,
        formComplete: false,
        href: `/client/application?${params.toString()}`,
      });
    }

    return { ongoing: [...ongoingMap.values()], purchased: [...purchasedMap.values()] };
  }, [applications, applicationProgress, payments, visaPackages]);

  const openApplicationChoice = useCallback((country: string, visaType: string) => {
    const key = getVisaDestinationKey(country, visaType);
    const existingEntry = ongoing.find((entry) => entry.key === key)
      ?? purchased.find((entry) => entry.key === key);
    const params = new URLSearchParams({ country, visaType });

    setChoiceError(null);
    setChoiceAction(null);
    setSelectedEntry(existingEntry ?? {
      key,
      country,
      visaType,
      progress: null,
      applicationId: null,
      formComplete: false,
      href: `/client/application?${params.toString()}`,
    });
  }, [ongoing, purchased]);

  useEffect(() => {
    if (isLoading) return;
    const country = searchParams.get("country")?.trim();
    const visaType = searchParams.get("visaType")?.trim() ?? searchParams.get("visa_type")?.trim();
    if (!country || !visaType) return;

    const signature = `${country.toLowerCase()}::${visaType.toLowerCase()}::${searchParams.get("choose") ?? ""}`;
    if (handledRouteSelection === signature) return;

    setHandledRouteSelection(signature);
    openApplicationChoice(country, visaType);
  }, [handledRouteSelection, isLoading, openApplicationChoice, searchParams]);

  const handleStartNewApplication = async () => {
    if (!selectedEntry) return;
    setChoiceAction("new");
    setChoiceError(null);

    const result = await ensureDraftApplication(selectedEntry.country, selectedEntry.visaType, {
      preferExplicit: true,
      forceCreate: true,
    });
    if (result.error || !result.applicationId) {
      setChoiceError(result.error ?? t("actionError"));
      setChoiceAction(null);
      return;
    }

    const params = new URLSearchParams({
      country: selectedEntry.country,
      visaType: selectedEntry.visaType,
      applicationId: result.applicationId,
    });
    router.push(`/client/application/long-form?${params.toString()}`);
  };

  const handleContinueApplication = () => {
    if (!selectedEntry?.applicationId) return;
    setChoiceAction("continue");
    setChoiceError(null);
    router.push(selectedEntry.href);
  };

  const renderDestinationCard = (entry: MyDestinationEntry) => {
    const isCurrent = currentKey === entry.key;
    return (
      <button
        key={entry.key}
        type="button"
        onClick={() => {
          setSelectedEntry(entry);
          setChoiceAction(null);
          setChoiceError(null);
        }}
        className={[
          "group flex min-h-[130px] flex-col justify-between rounded-[16px] border bg-white p-4 text-left transition cursor-pointer sm:min-h-[150px] sm:p-5",
          isCurrent
            ? "border-[#03346E] shadow-[0_12px_30px_rgba(3,52,110,0.12)]"
            : "border-[#efefef] hover:border-[#c7d5e8] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[26px] leading-none sm:text-[34px]" aria-hidden="true">
              {getDestinationFlag(entry.country)}
            </span>
            <p className="font-heading text-[15px] font-medium leading-snug text-[#222] sm:text-[17px]">
              {getVisaPackageTitle(entry.country, entry.visaType, locale)}
            </p>
          </div>
          {isCurrent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3fa] px-2.5 py-1 text-[12px] font-semibold text-[#03346E]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("current")}
            </span>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <SmoothProgressBar
            displayedProgress={entry.progress?.percent ?? 0}
            label={entry.progress?.label ?? t("notStarted")}
            ariaLabel={t("progressAriaLabel")}
            labelClassName="text-[12px] font-medium text-[#526174]"
            valueClassName="text-[12px] font-medium text-[#526174]"
            size="xs"
          />
          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#03346E]">
            {entry.applicationId ? t("chooseAction") : t("start")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
    );
  };

  const renderApplicationGrid = (
    entries: MyDestinationEntry[],
    showAll: boolean,
    setShowAll: (showAll: boolean) => void,
  ) => {
    const hasMoreThanFirstRow = entries.length > 3;
    const visibleEntries = showAll ? entries : entries.slice(0, 3);

    return (
      <>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
          {visibleEntries.map(renderDestinationCard)}
        </div>
        {hasMoreThanFirstRow && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d7e1ef] bg-white px-4 py-2 text-[14px] font-semibold text-[#03346E] transition hover:border-[#03346E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-expanded={showAll}
          >
            {showAll ? t("showLess") : t("showAll", { count: entries.length })}
            {showAll ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-16 pt-8">
      <main className="mx-auto flex w-full max-w-[1090px] flex-col gap-6">
        <Link
          href="/client/home"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-[14px] font-medium text-[#03346E] transition hover:border-[#03346E]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToHome")}
        </Link>

        <section className="rounded-[18px] border border-[#e7edf5] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <h1 className="font-heading text-[28px] font-medium leading-tight text-[#2f2f2f] sm:text-[40px]">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#667085]">
            {t("subtitle")}
          </p>

          {isLoading ? (
            <div className="mt-8 flex items-center gap-3 text-[#667085]">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <span className="text-[14px]">{t("loading")}</span>
            </div>
          ) : loadError ? (
            <div className="mt-8 rounded-[16px] border border-[#f4c7c3] bg-[#fff8f7] px-5 py-4 text-[14px] text-[#b42318]">
              {loadError}
            </div>
          ) : ongoing.length === 0 && purchased.length === 0 ? (
            <div className="mt-8 rounded-[16px] border border-dashed border-[#dce5f0] bg-white px-5 py-10 text-center">
              <p className="text-[15px] font-medium text-[#526174]">{t("noApplications")}</p>
            </div>
          ) : (
            <>
              {ongoing.length > 0 && (
                <div className="mt-8">
                  <p className="text-[15px] font-semibold text-[#03346E]">{t("ongoingApplications")}</p>
                  {renderApplicationGrid(ongoing, showAllOngoing, setShowAllOngoing)}
                </div>
              )}

              {purchased.length > 0 && (
                <div className="mt-8">
                  <p className="text-[15px] font-semibold text-[#03346E]">{t("purchasedApplications")}</p>
                  <p className="mt-1 text-[13px] text-[#8a94a6]">{t("purchasedApplicationsHint")}</p>
                  {renderApplicationGrid(purchased, showAllPurchased, setShowAllPurchased)}
                </div>
              )}
            </>
          )}
        </section>

        <PopularDestinationsSection
          selectedPackages={visaPackages}
          applicationProgress={applicationProgress}
          onDestinationSelected={(destination: PopularVisaDestination) => {
            openApplicationChoice(destination.country, destination.visaType);
          }}
        />
      </main>

      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open && !choiceAction) {
            setSelectedEntry(null);
            setChoiceError(null);
          }
        }}
      >
        <DialogContent className="max-w-[560px] rounded-[16px] border-[#dfe7f1] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
          {selectedEntry && (
            <div className="p-6 sm:p-7">
              <DialogHeader>
                <DialogTitle className="pr-8 font-heading text-[24px] font-medium leading-tight text-[#26364a]">
                  {t("chooseActionTitle")}
                </DialogTitle>
                <DialogDescription className="pt-2 text-[14px] leading-6 text-[#667085]">
                  {t("chooseActionDescription", {
                    application: getVisaPackageTitle(selectedEntry.country, selectedEntry.visaType, locale),
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartNewApplication()}
                  disabled={choiceAction !== null}
                  className="flex min-h-[84px] items-center gap-4 rounded-[12px] border border-[#03346E] bg-[#03346E] px-5 py-4 text-left text-white transition hover:bg-[#022a59] disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                    {choiceAction === "new" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FilePlus2 className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold">
                      {choiceAction === "new" ? t("startingNew") : t("startNewApplication")}
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-white/70">
                      {t("startNewDescription")}
                    </span>
                  </span>
                </button>

                {selectedEntry.applicationId && (
                  <button
                    type="button"
                    onClick={handleContinueApplication}
                    disabled={choiceAction !== null}
                    className="flex min-h-[84px] items-center gap-4 rounded-[12px] border border-[#d7e1ef] bg-white px-5 py-4 text-left text-[#26364a] transition hover:border-[#03346E] hover:bg-[#f7faff] disabled:cursor-wait disabled:opacity-70"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef3fa] text-[#03346E]">
                      {choiceAction === "continue" ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold text-[#03346E]">
                        {selectedEntry.formComplete ? t("viewExistingApplication") : t("continueApplication")}
                      </span>
                      <span className="mt-1 block text-[13px] leading-5 text-[#667085]">
                        {selectedEntry.formComplete ? t("viewExistingDescription") : t("continueDescription")}
                      </span>
                    </span>
                  </button>
                )}
              </div>

              {choiceError && (
                <p className="mt-4 rounded-[10px] border border-[#f4c7c3] bg-[#fff8f7] px-4 py-3 text-[13px] leading-5 text-[#b42318]">
                  {choiceError}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
