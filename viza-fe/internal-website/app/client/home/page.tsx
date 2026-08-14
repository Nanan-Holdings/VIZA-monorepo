"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleNotch as Loader2, WarningCircle as CircleAlert } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { ApplicationTimelineSection } from "@/components/client/home/ApplicationTimelineSection";

// ─── 完美还原与保留的核心卡片组件 ───
import { QuickActionsCard } from "@/components/client/home/QuickActionsCard";
import { UniversalInfoCard } from "@/components/client/home/UniversalInfoCard";
import { ActiveVisaCard } from "@/components/client/home/ActiveVisaCard";
import { getClientHomeDashboardData } from "@/app/actions/client-home-dashboard";
import { getClientApplicationStatuses } from "@/app/actions/client-application-status";
import type { StatusApplication } from "@/app/client/status/status-data";
import {
  getDestinationDisplayNameForLocale,
  getFormVisaType,
  getVisaPackageTitle,
} from "@/lib/visa-destinations";
import {
  getCountryHeroTheme,
  heroGradientCss,
} from "@/lib/client/country-hero-theme";
import {
  getRecentApplicationFormHref,
  readApplicationFormTarget,
} from "@/lib/client/recent-application-form";
import {
  isOngoingApplicationState,
  readActiveApplicationSelection,
  setActiveApplicationSelection,
} from "@/lib/client/active-application-selection";
import {
  getNextApplicationHref,
  type ApplicationRow,
  type DocumentRow,
  type PaymentRow,
} from "@/lib/client/application-progress";
import { isIgnorableDashboardLoadError } from "./home-load-errors";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingState() {
  const t = useTranslations("home");
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      <p className="text-lg text-muted-foreground">{t("loadingDashboard")}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Empty className="max-w-lg">
        <EmptyHeader className="max-w-lg">
          <EmptyMedia variant="icon">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>{message}</EmptyTitle>
          <EmptyDescription>
            加载仪表板时出现问题，请刷新页面后重试。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

function TimelineLoadingState() {
  const t = useTranslations("home");

  return (
    <div
      aria-label={t("loadingDashboard")}
      className="mx-auto w-full max-w-[1090px] space-y-5 pb-[80px]"
      role="status"
    >
      <Skeleton className="h-9 w-40 rounded-lg" />
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interfaces & Helper Logic
// ---------------------------------------------------------------------------

interface ApplicantProfileSummary {
  full_name: string | null;
  surname?: string | null;
  given_names?: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  birth_country?: string | null;
  birth_province_or_state?: string | null;
  birth_city?: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
}

interface UniversalInfoProgress {
  completedCount: number;
  totalCount: number;
}

interface ActiveVisaSummary {
  href: string;
  status: string;
  visaName: string;
}

const UNIVERSAL_PROFILE_FIELDS: Array<keyof ApplicantProfileSummary> = [
  "surname",
  "given_names",
  "date_of_birth",
  "birth_country",
  "birth_province_or_state",
  "birth_city",
  "gender",
  "nationality",
  "occupation",
  "address",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "email",
  "phone",
  "wechat",
];

const PASSPORT_DOCUMENT_TYPES = new Set([
  "passport_copy",
  "passport_bio_page",
  "passport_scan",
  "passport",
]);

function parseLegacyBirthplace(value?: string | null) {
  const parts = (value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      country: parts[0] ?? "",
      provinceOrState: parts[1] ?? "",
      city: parts.slice(2).join(" | "),
    };
  }

  return { country: "", provinceOrState: "", city: "" };
}

function parseLegacyName(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (/^[\u3400-\u9fff]{2,}$/.test(trimmed.replace(/\s+/g, ""))) {
    const compact = trimmed.replace(/\s+/g, "");
    return {
      surname: compact.slice(0, 1),
      givenNames: compact.slice(1),
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      surname: parts[0] ?? "",
      givenNames: parts.slice(1).join(" "),
    };
  }

  return { surname: "", givenNames: "" };
}

function buildUniversalInfoProgress(
  profile: ApplicantProfileSummary | null,
  authEmail?: string | null,
  hasPassportUpload = false
): UniversalInfoProgress {
  const legacyBirthplace = parseLegacyBirthplace(profile?.place_of_birth);
  const legacyName = parseLegacyName(profile?.full_name);
  const completedCount = UNIVERSAL_PROFILE_FIELDS.filter((field) => {
    if (field === "email" && !profile?.email && authEmail) return true;
    if (field === "surname")
      return Boolean(profile?.surname?.trim() || legacyName.surname);
    if (field === "given_names")
      return Boolean(profile?.given_names?.trim() || legacyName.givenNames);
    if (field === "birth_country")
      return Boolean(
        profile?.birth_country?.trim() || legacyBirthplace.country
      );
    if (field === "birth_province_or_state") {
      return Boolean(
        profile?.birth_province_or_state?.trim() ||
        legacyBirthplace.provinceOrState
      );
    }
    if (field === "birth_city") {
      return Boolean(
        profile?.birth_city?.trim() ||
        legacyBirthplace.city ||
        profile?.place_of_birth?.trim()
      );
    }
    return Boolean(profile?.[field]?.trim());
  }).length;

  return {
    completedCount: completedCount + (hasPassportUpload ? 1 : 0),
    totalCount: UNIVERSAL_PROFILE_FIELDS.length + 1,
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const PAGE_SCALE = 1;
  const heroRef = useRef<HTMLDivElement>(null);
  const [applicantName, setApplicantName] = useState<string | null>(null);
  // Country code of the current application, shown in the hero subtitle.
  const [heroCountry, setHeroCountry] = useState<string | null>(null);
  const [activeVisa, setActiveVisa] = useState<ActiveVisaSummary | null>(null);

  // 核心业务状态
  const [selectedApplicationStatus, setSelectedApplicationStatus] =
    useState<StatusApplication | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);
  const [universalInfoProgress, setUniversalInfoProgress] =
    useState<UniversalInfoProgress>({
      completedCount: 0,
      totalCount: UNIVERSAL_PROFILE_FIELDS.length,
    });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const latestLoadRequestId = useRef(0);
  const dashboardLoadInFlightRef = useRef(false);
  const lastDashboardLoadAtRef = useRef(0);

  // Handle magic link auth callback
  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash;

    if (hash && hash.includes("access_token")) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(({ data, error: authError }) => {
            if (authError) {
              setError(t("authError"));
              setIsLoading(false);
              return;
            }
            if (data.session) {
              window.history.replaceState(null, "", window.location.pathname);
            }
            setAuthChecked(true);
          });
      } else {
        setAuthChecked(true);
      }
    } else {
      setAuthChecked(true);
    }
  }, [t]);

  const fetchData = useCallback(
    async ({
      showLoading = true,
      retryOnAbort = true,
    }: {
      showLoading?: boolean;
      retryOnAbort?: boolean;
    } = {}) => {
      if (dashboardLoadInFlightRef.current) return;
      dashboardLoadInFlightRef.current = true;
      const requestId = latestLoadRequestId.current + 1;
      latestLoadRequestId.current = requestId;
      const isLatestRequest = () => latestLoadRequestId.current === requestId;
      let keepLoadingForRetry = false;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        // Start the expensive lifecycle read at the same time, but do not keep
        // the whole dashboard behind it. The hero and primary actions only
        // depend on the compact dashboard query.
        const statusPromise = getClientApplicationStatuses().catch(
          (statusError) => {
            if (!isIgnorableDashboardLoadError(statusError)) {
              console.error(
                "Failed to load client home timeline",
                statusError,
              );
            }
            return null;
          },
        );
        const dashboard = await getClientHomeDashboardData();
        lastDashboardLoadAtRef.current = Date.now();
        if (!dashboard.authenticated) {
          if (isLatestRequest()) setIsTimelineLoading(false);
          if (showLoading && isLatestRequest()) setIsLoading(false);
          return;
        }

        if (dashboard.error) throw new Error(dashboard.error);

        const profile = dashboard.profile;
        const authName = dashboard.authEmail?.split("@")[0] ?? null;
        if (!isLatestRequest()) return;
        setUniversalInfoProgress(
          buildUniversalInfoProgress(
            profile as ApplicantProfileSummary | null,
            dashboard.authEmail
          )
        );

        const profileTyped = profile as {
          id: string;
          full_name: string | null;
        } | null;
        if (!profileTyped) {
          if (authName) setApplicantName(authName);
          setActiveVisa(null);
          setSelectedApplicationStatus(null);
          setIsTimelineLoading(false);
          return;
        }

        setApplicantName(profileTyped.full_name || authName);

        if (!isLatestRequest()) return;
        const loadedApplications = dashboard.applications as ApplicationRow[];
        const loadedPayments = dashboard.payments as PaymentRow[];

        // Current application = explicit active selection, then last-visited
        // form context, then the newest ongoing application.
        const activeSelection = readActiveApplicationSelection();
        const formTarget = readApplicationFormTarget(
          getRecentApplicationFormHref()
        );
        const currentApplication =
          loadedApplications.find((application) =>
            activeSelection?.applicationId
              ? application.id === activeSelection.applicationId
              : false,
          ) ??
          loadedApplications.find((application) => {
            if (formTarget?.applicationId)
              return application.id === formTarget.applicationId;
            if (!formTarget?.country || !formTarget.visaType) return false;
            return (
              application.country.toLowerCase() ===
                formTarget.country.toLowerCase() &&
              getFormVisaType(application.visa_type).toLowerCase() ===
                getFormVisaType(formTarget.visaType).toLowerCase()
            );
          }) ??
          loadedApplications.find((application) => isOngoingApplicationState(application.status)) ??
          null;
        if (!currentApplication) {
          setSelectedApplicationStatus(null);
          setIsTimelineLoading(false);
        } else {
          setIsTimelineLoading(true);
          void statusPromise
            .then((statusResult) => {
              if (!isLatestRequest() || !statusResult) return;
              const currentStatus =
                statusResult.applications.find(
                  (application) => application.id === currentApplication.id,
                ) ?? null;
              setSelectedApplicationStatus(currentStatus);
              if (
                currentStatus &&
                activeSelection?.applicationId !== currentApplication.id
              ) {
                setActiveApplicationSelection({
                  applicationId: currentApplication.id,
                  packageId: currentApplication.visa_package_id,
                  country: currentApplication.country,
                  visaType: currentApplication.visa_type,
                  href: getNextApplicationHref(
                    currentApplication,
                    loadedPayments,
                  ),
                });
              }
            })
            .finally(() => {
              if (isLatestRequest()) setIsTimelineLoading(false);
            });
        }
        setHeroCountry(currentApplication?.country ?? null);
        setActiveVisa(
          currentApplication
            ? {
                href: getNextApplicationHref(
                  currentApplication,
                  loadedPayments
                ),
                status: currentApplication.status,
                visaName: getVisaPackageTitle(
                  currentApplication.country,
                  currentApplication.visa_type,
                  locale
                ),
              }
            : null
        );

        if (loadedApplications.length === 0) {
          setUniversalInfoProgress(
            buildUniversalInfoProgress(
              profile as ApplicantProfileSummary | null,
              dashboard.authEmail
            )
          );
          setSelectedApplicationStatus(null);
          setIsTimelineLoading(false);
          return;
        }

        if (!isLatestRequest()) return;
        const loadedDocuments = dashboard.documents as DocumentRow[];
        const hasPassportUpload = loadedDocuments.some(
          (document) =>
            PASSPORT_DOCUMENT_TYPES.has(document.document_type) &&
            document.status !== "missing"
        );
        setUniversalInfoProgress(
          buildUniversalInfoProgress(
            profile as ApplicantProfileSummary | null,
            dashboard.authEmail,
            hasPassportUpload
          )
        );
      } catch (loadError) {
        if (!isLatestRequest()) return;
        if (isIgnorableDashboardLoadError(loadError)) {
          if (retryOnAbort) {
            keepLoadingForRetry = true;
            window.setTimeout(() => {
              void fetchData({ showLoading, retryOnAbort: false });
            }, 100);
          }
          return;
        }
        console.error("Failed to load client home dashboard", loadError);
        setError(t("dashboardError"));
      } finally {
        dashboardLoadInFlightRef.current = false;
        if (showLoading && isLatestRequest() && !keepLoadingForRetry)
          setIsLoading(false);
      }
    },
    [locale, t]
  );

  useEffect(() => {
    if (!authChecked) return;
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastDashboardLoadAtRef.current < 30_000) return;
      void fetchData({ showLoading: false });
    };

    void fetchData();
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);

    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [authChecked, fetchData]);

  // Keep the immersive navigation white until the hero has fully left the viewport.
  useEffect(() => {
    const syncNavColor = () => {
      const isPastHero = (heroRef.current?.getBoundingClientRect().bottom ?? 0) <= 0;
      document.documentElement.style.setProperty(
        "--nav-text-color",
        isPastHero ? "#000000" : "#ffffff"
      );
      document.documentElement.style.setProperty(
        "--nav-stroke-color",
        isPastHero ? "#000000" : "#ffffff"
      );
    };

    window.addEventListener("scroll", syncNavColor, { passive: true });
    window.addEventListener("resize", syncNavColor);
    syncNavColor();
    return () => {
      window.removeEventListener("scroll", syncNavColor);
      window.removeEventListener("resize", syncNavColor);
    };
  }, [isLoading]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  // The hero keeps the shared blue gradient and reflects the country through its artwork.
  const heroTheme = getCountryHeroTheme(heroCountry);

  const headingVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } },
  };

  return (
    <div
      className="bg-[#fcfcfc] relative min-h-screen overflow-x-hidden w-screen left-1/2 -translate-x-1/2 -mt-36 xl:-mt-32"
      data-name="VIZA Dashboard - Home"
      style={{
        transform: `translateX(-50%) scale(${PAGE_SCALE})`,
        transformOrigin: "top center",
        width: `${100 / PAGE_SCALE}vw`,
      }}
    >
      {/* Hero Background — shared blue gradient with country-specific artwork. */}
      <div
        ref={heroRef}
        data-home-hero
        className="absolute left-0 right-0 top-0 z-0 h-[1080px] overflow-hidden xl:h-[538px]"
      >
        <div
          className="absolute inset-0"
          style={{ backgroundImage: heroGradientCss(heroTheme) }}
        />
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.05)] mix-blend-hard-light" />
        {heroTheme.image && (
          <div className="absolute h-[900px] left-1/2 -translate-x-1/2 bottom-0 w-[760px] blur-sm">
            <img
              alt=""
              className="w-full h-full object-contain object-bottom"
              src={heroTheme.image}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.08)]" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full flex flex-col items-center px-4 sm:px-6 md:px-10 xl:px-20 pt-[164px] xl:pt-[148px] -mt-[130px]">
        {/* Main Greeting */}
        <motion.div
          className="font-heading font-medium leading-[1.3] not-italic text-[28px] xl:text-[32px] text-white mt-[127px] tracking-[-0.96px] w-full max-w-[1090px]"
          initial="hidden"
          animate="visible"
          variants={headingVariants}
        >
          <p className="mb-0 text-[rgba(255,255,255,0.65)]">
            {t("welcomeBack", {
              name: applicantName?.split(" ")[0] || "there",
            })}
          </p>
          <p>
            {heroCountry
              ? t("vizaApplicationForCountry", {
                  country: getDestinationDisplayNameForLocale(
                    heroCountry,
                    locale
                  ),
                })
              : t("vizaApplication")}
          </p>
        </motion.div>

        {/* ── 核心改变：完全移除了 p2 的流程图，把你的三个磨砂玻璃面板提上来到 p2 绝佳悬浮位置 ── */}
        <motion.div
          className="w-full max-w-[1090px] mt-6 xl:mt-[41px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div className="flex flex-col xl:flex-row gap-[16px] items-stretch w-full">
            <ActiveVisaCard
              href={activeVisa?.href ?? "/client/destinations"}
              status={activeVisa?.status ?? null}
              visaName={activeVisa?.visaName ?? null}
            />
            <UniversalInfoCard {...universalInfoProgress} />
            <QuickActionsCard />
          </div>
        </motion.div>

        <div className="mt-12 w-full sm:mt-16">
          {isTimelineLoading ? (
            <TimelineLoadingState />
          ) : (
            <ApplicationTimelineSection application={selectedApplicationStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
