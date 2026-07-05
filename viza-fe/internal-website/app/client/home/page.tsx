"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CircleAlert } from "lucide-react";
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
import { RecentActivitySection, type ActivityEvent } from "@/components/client/home/RecentActivitySection";

// ─── 完美还原与保留的核心卡片组件 ───
import { QuickActionsCard } from "@/components/client/home/QuickActionsCard";
import { UniversalInfoCard } from "@/components/client/home/UniversalInfoCard";
import { SubscriptionPlanCard } from "@/components/client/home/SubscriptionPlanCard";
import { getApplicationPaymentRecords } from "@/app/actions/application-lifecycle";
import {
  getDestinationDisplayNameForLocale,
  getFormVisaType,
  getVisaPackageTitle,
} from "@/lib/visa-destinations";
import {
  getRecentApplicationFormHref,
  readApplicationFormTarget,
} from "@/lib/client/recent-application-form";
import {
  getNextApplicationHref,
  type ApplicationRow,
  type DocumentRow,
  type PaymentRow,
} from "@/lib/client/application-progress";
import { resolveHomeDocumentLabel } from "./home-activity";
import { isIgnorableDashboardLoadError } from "./home-load-errors";

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

const PASSPORT_DOCUMENT_TYPES = new Set(["passport_copy", "passport_bio_page", "passport_scan", "passport"]);

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
  hasPassportUpload = false,
): UniversalInfoProgress {
  const legacyBirthplace = parseLegacyBirthplace(profile?.place_of_birth);
  const legacyName = parseLegacyName(profile?.full_name);
  const completedCount = UNIVERSAL_PROFILE_FIELDS.filter((field) => {
    if (field === "email" && !profile?.email && authEmail) return true;
    if (field === "surname") return Boolean(profile?.surname?.trim() || legacyName.surname);
    if (field === "given_names") return Boolean(profile?.given_names?.trim() || legacyName.givenNames);
    if (field === "birth_country") return Boolean(profile?.birth_country?.trim() || legacyBirthplace.country);
    if (field === "birth_province_or_state") {
      return Boolean(profile?.birth_province_or_state?.trim() || legacyBirthplace.provinceOrState);
    }
    if (field === "birth_city") {
      return Boolean(profile?.birth_city?.trim() || legacyBirthplace.city || profile?.place_of_birth?.trim());
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
  const [applicantName, setApplicantName] = useState<string | null>(null);
  // Country code of the current application, shown in the hero subtitle.
  const [heroCountry, setHeroCountry] = useState<string | null>(null);

  // 核心业务状态
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [universalInfoProgress, setUniversalInfoProgress] = useState<UniversalInfoProgress>({
    completedCount: 0,
    totalCount: UNIVERSAL_PROFILE_FIELDS.length,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const latestLoadRequestId = useRef(0);

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
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
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

  const buildActivityEvents = useCallback(
    (
      appsList: ApplicationRow[],
      docsList: DocumentRow[],
      paymentsList: PaymentRow[],
    ): ActivityEvent[] => {
      const events: ActivityEvent[] = [];
      const applicationsById = new Map(appsList.map((application) => [application.id, application]));

      for (const application of appsList) {
        const applicationName = getVisaPackageTitle(application.country, application.visa_type, locale);
        const href = getNextApplicationHref(application, paymentsList);
        if (application.submitted_at) {
          events.push({
            id: `app-submitted-${application.id}`,
            eventType: "status_change",
            label: t("activity.applicationSubmitted"),
            sublabel: applicationName,
            timestamp: application.submitted_at,
            icon: "check",
            href,
          });
        }
        events.push({
          id: `app-created-${application.id}`,
          eventType: "application_created",
          label: t("activity.applicationCreated"),
          sublabel: applicationName,
          timestamp: application.created_at,
          icon: "clock",
          href,
        });
      }

      for (const doc of docsList) {
        const application = applicationsById.get(doc.application_id);
        const docLabel = resolveHomeDocumentLabel(t, doc.document_type);
        events.push({
          id: `doc-${doc.id}`,
          eventType: "document_upload",
          label: t("activity.documentUploaded", { docType: docLabel }),
          sublabel: doc.status === "rejected" ? t("activity.documentRejected") : t("activity.documentReceived"),
          timestamp: doc.updated_at,
          icon: doc.status === "rejected" ? "alert" : "upload",
          href: application
            ? doc.status === "rejected"
              ? `/client/documents?applicationId=${encodeURIComponent(application.id)}`
              : getNextApplicationHref(application, paymentsList)
            : undefined,
        });
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events.slice(0, 5);
    },
    [locale, t],
  );

  const fetchData = useCallback(
    async ({
      showLoading = true,
      retryOnAbort = true,
    }: {
      showLoading?: boolean;
      retryOnAbort?: boolean;
    } = {}) => {
      const requestId = latestLoadRequestId.current + 1;
      latestLoadRequestId.current = requestId;
      const isLatestRequest = () => latestLoadRequestId.current === requestId;
      let keepLoadingForRetry = false;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          if (showLoading && isLatestRequest()) setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("applicant_profiles")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const authName = user.user_metadata?.full_name || user.user_metadata?.name || null;
        if (!isLatestRequest()) return;
        setUniversalInfoProgress(
          buildUniversalInfoProgress(profile as ApplicantProfileSummary | null, user.email ?? null),
        );

        const profileTyped = profile as { id: string; full_name: string | null } | null;
        if (!profileTyped) {
          if (authName) setApplicantName(authName);
          setActivityEvents([]);
          return;
        }

        setApplicantName(profileTyped.full_name || authName);

        const { data: appRows } = await supabase
          .from("applications")
          .select("id, status, country, visa_type, visa_package_id, submission_result_status, submitted_at, created_at, updated_at")
          .eq("applicant_id", profileTyped.id)
          .order("created_at", { ascending: false });

        if (!isLatestRequest()) return;
        const loadedApplications = (appRows ?? []) as ApplicationRow[];

        // Current application = last-visited form context, else newest application.
        const formTarget = readApplicationFormTarget(getRecentApplicationFormHref());
        const currentApplication =
          loadedApplications.find((application) => {
            if (formTarget?.applicationId) return application.id === formTarget.applicationId;
            if (!formTarget?.country || !formTarget.visaType) return false;
            return (
              application.country.toLowerCase() === formTarget.country.toLowerCase() &&
              getFormVisaType(application.visa_type).toLowerCase() ===
                getFormVisaType(formTarget.visaType).toLowerCase()
            );
          }) ?? loadedApplications[0] ?? null;
        setHeroCountry(currentApplication?.country ?? null);

        if (loadedApplications.length === 0) {
          setUniversalInfoProgress(
            buildUniversalInfoProgress(profile as ApplicantProfileSummary | null, user.email ?? null),
          );
          setActivityEvents([]);
          return;
        }

        const applicationIds = loadedApplications.map((app) => app.id);
        const packageIds = loadedApplications
          .map((app) => app.visa_package_id)
          .filter((id): id is string => Boolean(id));

        const [{ data: docs }, loadedPayments] = await Promise.all([
          supabase
            .from("application_documents")
            .select("id, application_id, document_type, status, created_at, updated_at")
            .in("application_id", applicationIds),
          getApplicationPaymentRecords(applicationIds, packageIds),
        ]);

        if (!isLatestRequest()) return;
        const loadedDocuments = (docs ?? []) as DocumentRow[];
        const hasPassportUpload = loadedDocuments.some(
          (document) => PASSPORT_DOCUMENT_TYPES.has(document.document_type) && document.status !== "missing",
        );
        setUniversalInfoProgress(
          buildUniversalInfoProgress(profile as ApplicantProfileSummary | null, user.email ?? null, hasPassportUpload),
        );
        // Recent activity is scoped to the current application only — other
        // applications are visible from /client/destinations.
        const currentApplications = currentApplication ? [currentApplication] : [];
        const currentDocuments = loadedDocuments.filter(
          (document) => document.application_id === currentApplication?.id,
        );
        setActivityEvents(buildActivityEvents(currentApplications, currentDocuments, loadedPayments));
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
        if (showLoading && isLatestRequest() && !keepLoadingForRetry) setIsLoading(false);
      }
    },
    [buildActivityEvents, t],
  );

  useEffect(() => {
    if (!authChecked) return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void fetchData({ showLoading: false });
      }, 350);
    };

    void fetchData();
    const channel = supabase
      .channel("home-activity-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "application_documents" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [authChecked, fetchData]);

  // 顶部沉浸式导航颜色动态同步
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 320;
      document.documentElement.style.setProperty("--nav-text-color", isScrolled ? "#000000" : "#ffffff");
      document.documentElement.style.setProperty("--nav-stroke-color", isScrolled ? "#000000" : "#ffffff");
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const headingVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } },
  };

  const activityHeadingVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { delay: 0.3, duration: 0.4 } },
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
      {/* Hero Background - 恢复标准高度，完美衬托单层卡片 */}
      <div className="absolute top-0 left-0 right-0 h-[720px] xl:h-[538px] overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#03346E] to-[#3D6DAD]" />
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.05)] mix-blend-hard-light" />
        <div className="absolute h-[900px] left-1/2 -translate-x-1/2 bottom-0 w-[600px]">
          <img alt="" className="w-full h-full object-contain object-bottom" src="/figma-assets/hero-background.png" />
        </div>
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
            {t("welcomeBack", { name: applicantName?.split(" ")[0] || "there" })}
          </p>
          <p>
            {heroCountry
              ? t("vizaApplicationForCountry", {
                  country: getDestinationDisplayNameForLocale(heroCountry, locale),
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
            <SubscriptionPlanCard />
            <UniversalInfoCard {...universalInfoProgress} />
            <QuickActionsCard />
          </div>
        </motion.div>

        {/* Recent Activity Heading — 与 hero 底部保持充足间距 */}
        <motion.p
          className="mt-16 mb-8 w-full max-w-[1090px] font-heading text-[24px] font-medium leading-[1.3] tracking-[-0.72px] text-[#3d3d3d] sm:mb-10 sm:mt-20 sm:text-[30px] sm:tracking-[-0.9px] xl:mt-24"
          initial="hidden"
          animate="visible"
          variants={activityHeadingVariants}
        >
          {t("recentActivity")}
        </motion.p>

        <RecentActivitySection events={activityEvents} />
      </div>
    </div>
  );
}
