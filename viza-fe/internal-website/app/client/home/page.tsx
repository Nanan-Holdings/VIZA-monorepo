"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, CircleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
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
import {
  PopularDestinationsSection,
  type DestinationApplicationProgress,
} from "@/components/client/home/PopularDestinationsSection";
import { getUserVisaPackages, type UserVisaPackage } from "@/app/actions/user-package";
import {
  getVisaDestinationKey,
  getVisaPackageTitleZh,
} from "@/lib/visa-destinations";

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

interface ApplicationRow {
  id: string;
  status: string;
  country: string;
  visa_type: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface DocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AnswerRow {
  application_id: string;
  field_name: string;
  value_text: string | null;
  updated_at: string | null;
}

interface ApplicantProfileSummary {
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
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
  "full_name",
  "date_of_birth",
  "place_of_birth",
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

function buildUniversalInfoProgress(
  profile: ApplicantProfileSummary | null,
  authEmail?: string | null,
): UniversalInfoProgress {
  const completedCount = UNIVERSAL_PROFILE_FIELDS.filter((field) => {
    if (field === "email" && !profile?.email && authEmail) return true;
    return Boolean(profile?.[field]?.trim());
  }).length;

  return {
    completedCount,
    totalCount: UNIVERSAL_PROFILE_FIELDS.length,
  };
}

function getProgressLabel(status: string, percent: number): string {
  if (status === "approved") return "已批准";
  if (status === "submitted") return "已提交";
  if (status === "rejected") return "需要处理";
  if (percent >= 70) return "接近完成";
  if (percent >= 30) return "填写中";
  return "已开始";
}

function buildApplicationProgress(
  applications: ApplicationRow[],
  documents: DocumentRow[],
  answers: AnswerRow[],
): Record<string, DestinationApplicationProgress> {
  const docsByApplication = new Map<string, DocumentRow[]>();
  const answersByApplication = new Map<string, AnswerRow[]>();

  for (const document of documents) {
    const existing = docsByApplication.get(document.application_id) ?? [];
    existing.push(document);
    docsByApplication.set(document.application_id, existing);
  }

  for (const answer of answers) {
    if (!answer.value_text?.trim()) continue;
    const existing = answersByApplication.get(answer.application_id) ?? [];
    existing.push(answer);
    answersByApplication.set(answer.application_id, existing);
  }

  return applications.reduce<Record<string, DestinationApplicationProgress>>((progress, application) => {
    const appAnswers = answersByApplication.get(application.id) ?? [];
    const appDocs = docsByApplication.get(application.id) ?? [];
    const hasPhoto = appAnswers.some((answer) => answer.field_name === "photo_path");
    const answeredFieldCount = new Set(appAnswers.map((answer) => answer.field_name)).size;
    const documentCount = appDocs.filter((document) => document.status !== "missing").length;

    let percent = 10;
    if (application.status === "submitted" || application.status === "approved") {
      percent = 100;
    } else if (application.status === "rejected") {
      percent = 85;
    } else {
      percent += Math.min(55, answeredFieldCount * 3);
      if (hasPhoto) percent += 10;
      percent += Math.min(20, documentCount * 5);
      percent = Math.min(95, Math.max(10, percent));
    }

    progress[getVisaDestinationKey(application.country, application.visa_type)] = {
      applicationId: application.id,
      status: application.status,
      percent,
      label: getProgressLabel(application.status, percent),
      updatedAt: application.updated_at ?? application.submitted_at ?? application.created_at,
    };
    return progress;
  }, {});
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const t = useTranslations("home");
  const PAGE_SCALE = 1;
  const [applicantName, setApplicantName] = useState<string | null>(null);
  
  // 核心业务状态
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [applicationProgress, setApplicationProgress] = useState<Record<string, DestinationApplicationProgress>>({});
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [visaPackages, setVisaPackages] = useState<UserVisaPackage[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [universalInfoProgress, setUniversalInfoProgress] = useState<UniversalInfoProgress>({
    completedCount: 0,
    totalCount: UNIVERSAL_PROFILE_FIELDS.length,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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

  useEffect(() => {
    if (!authChecked) return;
    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (!user) {
          setIsLoading(false);
          return;
        }

        // 获取用户订阅的所有签证包
        const packages = await getUserVisaPackages();
        if (!isMounted) return;
        setVisaPackages(packages);

        const { data: profile } = await supabase
          .from("applicant_profiles")
          .select("id, full_name, date_of_birth, place_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, email, phone, wechat")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!isMounted) return;

        const authName = user.user_metadata?.full_name || user.user_metadata?.name || null;
        setUniversalInfoProgress(
          buildUniversalInfoProgress(profile as ApplicantProfileSummary | null, user.email ?? null),
        );

        const profileTyped = profile as { id: string; full_name: string | null } | null;
        if (profileTyped) {
          setApplicantName(profileTyped.full_name || authName);

          const { data: appRows } = await supabase
            .from("applications")
            .select("id, status, country, visa_type, submitted_at, created_at, updated_at")
            .eq("applicant_id", profileTyped.id)
            .order("created_at", { ascending: false });

          if (!isMounted) return;
          const loadedApplications = (appRows ?? []) as ApplicationRow[];
          setApplications(loadedApplications);

          if (loadedApplications.length > 0) {
            const applicationIds = loadedApplications.map((app) => app.id);
            const [{ data: docs }, { data: answers }] = await Promise.all([
              supabase
                .from("application_documents")
                .select("id, application_id, document_type, status, created_at, updated_at")
                .in("application_id", applicationIds),
              supabase
                .from("visa_application_answers")
                .select("application_id, field_name, value_text, updated_at")
                .in("application_id", applicationIds),
            ]);

            if (!isMounted) return;
            const loadedDocuments = (docs ?? []) as DocumentRow[];
            const loadedAnswers = (answers ?? []) as AnswerRow[];
            setDocuments(loadedDocuments);
            setApplicationProgress(buildApplicationProgress(loadedApplications, loadedDocuments, loadedAnswers));
          } else {
            setDocuments([]);
            setApplicationProgress({});
          }
        } else if (authName) {
          setApplicantName(authName);
        }

        setActivityEvents(buildActivityEvents(applications, documents));
      } catch {
        if (isMounted) setError(t("dashboardError"));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    function buildActivityEvents(
      appsList: ApplicationRow[],
      docsList: DocumentRow[]
    ): ActivityEvent[] {
      const events: ActivityEvent[] = [];

      for (const application of appsList) {
        const applicationName = getVisaPackageTitleZh(application.country, application.visa_type);
        if (application.submitted_at) {
          events.push({
            id: `app-submitted-${application.id}`,
            eventType: "status_change",
            label: t("activity.applicationSubmitted"),
            sublabel: applicationName,
            timestamp: application.submitted_at,
            icon: "check",
          });
        }
        events.push({
          id: `app-created-${application.id}`,
          eventType: "application_created",
          label: t("activity.applicationCreated"),
          sublabel: applicationName,
          timestamp: application.created_at,
          icon: "clock",
        });
      }

      for (const doc of docsList) {
        const docLabel = t(`docLabels.${doc.document_type}`);
        events.push({
          id: `doc-${doc.id}`,
          eventType: "document_upload",
          label: t("activity.documentUploaded", { docType: docLabel }),
          sublabel: doc.status === "rejected" ? t("activity.documentRejected") : t("activity.documentReceived"),
          timestamp: doc.updated_at,
          icon: doc.status === "rejected" ? "alert" : "upload",
        });
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events.slice(0, 5);
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [authChecked, t]);

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
          <p>{t("vizaApplication")}</p>
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

        {/* ── 下方顺畅衔接：热门目的地签证表单进度流 ── */}
        <PopularDestinationsSection
          selectedPackages={visaPackages}
          applicationProgress={applicationProgress}
        />

        {/* Recent Activity Heading */}
        <motion.p
          className="font-heading font-medium leading-[1.3] not-italic text-[#3d3d3d] text-[30px] mt-10 tracking-[-0.9px] w-full max-w-[1090px]"
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