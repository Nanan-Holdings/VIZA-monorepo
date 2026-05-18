"use client";

import { useEffect, useState } from "react";
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
import { ApplicationStatusCard } from "@/components/client/home/ApplicationStatusCard";
import { DocumentProgressCard } from "@/components/client/home/DocumentProgressCard";
import { QuickActionsCard } from "@/components/client/home/QuickActionsCard";
import { RecentActivitySection, type ActivityEvent } from "@/components/client/home/RecentActivitySection";
import { PopularDestinationsSection } from "@/components/client/home/PopularDestinationsSection";
import { getUserVisaPackage, type UserVisaPackage } from "@/app/actions/user-package";
import { getDestinationFlag } from "@/lib/visa-destinations";

// ---------------------------------------------------------------------------
// Country helpers
// ---------------------------------------------------------------------------

function getCountryFlag(country: string): string {
  return getDestinationFlag(country);
}

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
            Something went wrong loading your dashboard. Please try refreshing the page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApplicationRow {
  id: string;
  status: string;
  country: string;
  visa_type: string;
  submitted_at: string | null;
  created_at: string;
}

interface DocumentRow {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Visa Timeline Card (shown when no application exists)
// ---------------------------------------------------------------------------

type StageStatus = "active" | "locked";

const STAGE_IDS = ["application", "documents", "submit", "review", "decision"] as const;

const STAGE_META: Record<string, { icon: string; status: StageStatus; href?: string }> = {
  application: { icon: "📋", status: "active", href: "/client/application" },
  documents: { icon: "📁", status: "locked" },
  submit: { icon: "✈️", status: "locked" },
  review: { icon: "🔍", status: "locked" },
  decision: { icon: "✅", status: "locked" },
};

function VisaStageCard({ title, subtitle, badge, icon, status, href }: {
  title: string; subtitle: string; badge: string; icon: string; status: StageStatus; href?: string;
}) {
  const isLocked = status === "locked";

  const inner = (
    <div
      className={[
        "w-full rounded-[16px] border border-[#efefef]",
        isLocked ? "bg-[rgba(239,239,239,0.5)]" : "bg-white hover:bg-[#fbfbfb] transition-colors cursor-pointer",
      ].join(" ")}
    >
      <div className="flex flex-col xl:flex-row xl:items-center w-full p-[16px] xl:p-[20px] gap-[12px] xl:gap-[24px] xl:justify-between">
        <div className="flex items-center gap-[16px] xl:gap-[20px] min-w-0">
          <div
            className={[
              "relative rounded-[8px] shrink-0 size-[72px] xl:size-[80px] flex items-center justify-center text-[32px]",
              isLocked ? "bg-[#f0f0f0] opacity-60" : "bg-[#eef3fa]",
            ].join(" ")}
          >
            <span role="img">{icon}</span>
          </div>
          <div className={["flex flex-col gap-[8px] min-w-0", isLocked ? "opacity-50" : ""].join(" ")}>
            <p className="font-heading font-medium leading-[1.3] text-[#3d3d3d] text-[18px] xl:text-[20px] tracking-[-0.6px] truncate">
              {title}
            </p>
            <p className="font-normal leading-[1.3] text-[14px] xl:text-[16px] text-[rgba(0,0,0,0.45)] tracking-[-0.48px] truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <div
          className={[
            "shrink-0 rounded-[999px] px-[20px] xl:px-[24px] py-[8px] xl:py-[12px] font-medium text-[14px] xl:text-[16px] leading-[1.5] tracking-[-0.24px] w-full xl:w-auto text-center",
            isLocked ? "bg-[#dcdcdc] text-[#989898]" : "bg-[#03346E] text-white",
          ].join(" ")}
        >
          {badge}
        </div>
      </div>
    </div>
  );

  if (href && !isLocked) {
    return <a href={href}>{inner}</a>;
  }
  return inner;
}

function VisaTimelineCard({ packageName }: { packageName?: string }) {
  const t = useTranslations("home.visaTimeline");

  return (
    <motion.div
      className="w-full max-w-[1090px] mt-20 xl:mt-24 flex flex-col gap-[16px]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="font-heading font-medium leading-[1.3] text-[30px] text-[#3d3d3d] tracking-[-0.9px]">
        {packageName || t("heading")}
      </p>
      <p className="font-normal leading-[1.3] text-[20px] text-[rgba(0,0,0,0.45)] tracking-[-0.6px]">
        {t("subheading")}
      </p>

      {STAGE_IDS.map((id) => {
        const meta = STAGE_META[id];
        return (
          <VisaStageCard
            key={id}
            title={t(`stages.${id}.title`)}
            subtitle={t(`stages.${id}.subtitle`)}
            badge={t(`stages.${id}.badge`)}
            icon={meta.icon}
            status={meta.status}
            href={meta.href}
          />
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const t = useTranslations("home");
  const PAGE_SCALE = 1;
  const [applicantName, setApplicantName] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [visaPackage, setVisaPackage] = useState<UserVisaPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  function buildActivityEvents(
    application: ApplicationRow | null,
    documents: DocumentRow[]
  ): ActivityEvent[] {
    const events: ActivityEvent[] = [];

    if (application) {
      if (application.submitted_at) {
        events.push({
          id: `app-submitted-${application.id}`,
          eventType: "status_change",
          label: t("activity.applicationSubmitted"),
          sublabel: visaPackage?.name ?? t("activity.visaType"),
          timestamp: application.submitted_at,
          icon: "check",
        });
      }
      events.push({
        id: `app-created-${application.id}`,
        eventType: "application_created",
        label: t("activity.applicationCreated"),
        sublabel: visaPackage?.name ?? t("activity.visaType"),
        timestamp: application.created_at,
        icon: "clock",
      });
    }

    for (const doc of documents) {
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

  // Fetch VIZA dashboard data once auth is confirmed
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

        // Fetch assigned visa package
        getUserVisaPackage().then((pkg) => {
          if (isMounted && pkg) setVisaPackage(pkg);
        });

        const { data: profile } = await supabase
          .from("applicant_profiles")
          .select("id, full_name")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        const authName = user.user_metadata?.full_name || user.user_metadata?.name || null;

        if (profile) {
          setApplicantName((profile as { full_name: string | null }).full_name || authName);

          const { data: app } = await supabase
            .from("applications")
            .select("id, status, country, visa_type, submitted_at, created_at")
            .eq("applicant_id", (profile as { id: string }).id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!isMounted) return;

          if (app) {
            setApplication(app as ApplicationRow);

            const { data: docs } = await supabase
              .from("application_documents")
              .select("id, document_type, status, created_at, updated_at")
              .eq("application_id", (app as { id: string }).id);

            if (!isMounted) return;
            setDocuments((docs ?? []) as DocumentRow[]);
          }
        } else if (authName) {
          setApplicantName(authName);
        }
      } catch {
        if (isMounted) setError(t("dashboardError"));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [authChecked, t]);

  // Nav color changes based on scroll (hero is navy, content below is white)
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 450;
      document.documentElement.style.setProperty("--nav-text-color", isScrolled ? "#000000" : "#ffffff");
      document.documentElement.style.setProperty("--nav-stroke-color", isScrolled ? "#000000" : "#ffffff");
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const uploadedDocuments = documents.filter((d) => d.status !== "missing");
  const activityEvents = buildActivityEvents(application, documents);

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
      {/* Hero Background - VIZA Navy */}
      <div className="absolute top-0 left-0 right-0 h-[980px] xl:h-[538px] overflow-hidden z-0">
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

        {/* Glass Panel */}
        <motion.div
          className="w-full max-w-[1090px] mt-4 xl:mt-[41px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div className="flex flex-col xl:flex-row gap-[16px] items-stretch w-full">
            {application ? (
              <>
                <ApplicationStatusCard
                  status={application.status}
                  visaType={application.visa_type}
                  country={application.country}
                  submittedAt={application.submitted_at}
                />
                <DocumentProgressCard
                  uploadedCount={uploadedDocuments.length}
                  totalRequired={6}
                />
                <QuickActionsCard />
              </>
            ) : (
              <>
                {/* Application card */}
                <motion.div
                  className="basis-0 grow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0, duration: 0.5 }}
                >
                  <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[240px]">
                    <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
                    <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">{t("application")}</p>
                    <div className="w-full">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-4xl leading-none" role="img" aria-label="flag">{visaPackage ? getCountryFlag(visaPackage.country) : "🌐"}</span>
                        <div>
                          <p className="text-white font-heading font-medium text-[18px] leading-tight">
                            {visaPackage?.name ?? t("emptyApplication.noActiveApplication")}
                          </p>
                          {visaPackage?.description && (
                            <p className="text-[rgba(255,255,255,0.65)] text-[13px] mt-0.5">{visaPackage.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30">
                        {t("notStarted")}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Documents card */}
                <motion.div
                  className="basis-0 grow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                >
                  <div className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[240px]">
                    <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
                    <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">{t("documentsTitle")}</p>
                    <div className="w-full space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-heading font-normal text-[48px] leading-none text-white">0</span>
                        <span className="text-[rgba(255,255,255,0.55)] text-[14px]">{t("ofRequired", { total: 6 })}</span>
                      </div>
                      <div className="w-full bg-[rgba(255,255,255,0.2)] rounded-full h-2">
                        <div className="bg-white rounded-full h-2 transition-all duration-700" style={{ width: "0%" }} />
                      </div>
                      <p className="text-[rgba(255,255,255,0.55)] text-[13px]">{t("percentComplete", { pct: 0 })}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Quick Actions card */}
                <QuickActionsCard />
              </>
            )}
          </div>
        </motion.div>

        {/* Timeline / stage cards (only when no application) */}
        {!application && (
          <>
            <PopularDestinationsSection selectedPackage={visaPackage} />
            <VisaTimelineCard packageName={visaPackage?.name} />
          </>
        )}

        {/* Recent Activity Heading */}
        <motion.p
          className="font-heading font-medium leading-[1.3] not-italic text-[#3d3d3d] text-[30px] mt-[56px] tracking-[-0.9px] w-full max-w-[1090px]"
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
