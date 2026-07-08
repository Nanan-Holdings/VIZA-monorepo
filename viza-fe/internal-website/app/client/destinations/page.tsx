"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { PopularDestinationsSection } from "@/components/client/home/PopularDestinationsSection";
import { getUserVisaPackages, type UserVisaPackage } from "@/app/actions/user-package";
import { getApplicationPaymentRecords } from "@/app/actions/application-lifecycle";
import {
  buildApplicationProgress,
  getNextApplicationHref,
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
  href: string;
}

export default function DestinationsPage() {
  const t = useTranslations("destinationsPage");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const router = useRouter();

  const [visaPackages, setVisaPackages] = useState<UserVisaPackage[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [applicationProgress, setApplicationProgress] = useState<
    Record<string, DestinationApplicationProgress>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  useEffect(() => {
    const target = readApplicationFormTarget(getRecentApplicationFormHref());
    if (target?.country && target.visaType) {
      setCurrentKey(getVisaDestinationKey(target.country, target.visaType));
    }
  }, []);

  const fetchData = useCallback(async () => {
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
    } catch (loadError) {
      console.error("Failed to load destinations page", loadError);
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
        href: `/client/application?${params.toString()}`,
      });
    }

    return { ongoing: [...ongoingMap.values()], purchased: [...purchasedMap.values()] };
  }, [applications, applicationProgress, payments, visaPackages]);

  const renderDestinationCard = (entry: MyDestinationEntry) => {
    const isCurrent = currentKey === entry.key;
    return (
      <button
        key={entry.key}
        type="button"
        onClick={() => router.push(entry.href)}
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
            {entry.progress ? t("continue") : t("start")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
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
          ) : ongoing.length === 0 && purchased.length === 0 ? (
            <div className="mt-8 rounded-[16px] border border-dashed border-[#dce5f0] bg-white px-5 py-10 text-center">
              <p className="text-[15px] font-medium text-[#526174]">{t("noApplications")}</p>
            </div>
          ) : (
            <>
              {ongoing.length > 0 && (
                <div className="mt-8">
                  <p className="text-[15px] font-semibold text-[#03346E]">{t("ongoingApplications")}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
                    {ongoing.map(renderDestinationCard)}
                  </div>
                </div>
              )}

              {purchased.length > 0 && (
                <div className="mt-8">
                  <p className="text-[15px] font-semibold text-[#03346E]">{t("purchasedApplications")}</p>
                  <p className="mt-1 text-[13px] text-[#8a94a6]">{t("purchasedApplicationsHint")}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
                    {purchased.map(renderDestinationCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <PopularDestinationsSection
          selectedPackages={visaPackages}
          applicationProgress={applicationProgress}
        />
      </main>
    </div>
  );
}
