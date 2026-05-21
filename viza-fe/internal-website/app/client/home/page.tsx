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
import { RecentActivitySection, type ActivityEvent } from "@/components/client/home/RecentActivitySection";
import { VisaOverviewCard } from "@/components/client/home/VisaOverviewCard";
import { NextActionCard } from "@/components/client/home/NextActionCard";
import { VisaJourneyTimeline } from "@/components/client/home/VisaJourneyTimeline";
import {
  getApplicationJourney,
  type ApplicationJourneyPayload,
} from "@/app/actions/application-journey";

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
// Interfaces
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
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const t = useTranslations("home");
  const PAGE_SCALE = 1;
  const [applicantName, setApplicantName] = useState<string | null>(null);
  const [journey, setJourney] = useState<ApplicationJourneyPayload | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
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

        // 先拉起后端的综合核心状态流数据封装包
        const journeyPromise = getApplicationJourney();

        const { data: profile } = await supabase
          .from("applicant_profiles")
          .select("id, full_name")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!isMounted) return;

        const authName = user.user_metadata?.full_name || user.user_metadata?.name || null;
        const profileTyped = profile as { id: string; full_name: string | null } | null;
        
        if (profileTyped) {
          setApplicantName(profileTyped.full_name || authName);
        } else if (authName) {
          setApplicantName(authName);
        }

        let app: ApplicationRow | null = null;
        let documents: DocumentRow[] = [];

        if (profileTyped) {
          const { data: appRow } = await supabase
            .from("applications")
            .select("id, status, country, visa_type, submitted_at, created_at")
            .eq("applicant_id", profileTyped.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!isMounted) return;
          app = (appRow as ApplicationRow) ?? null;

          if (app) {
            const { data: docs } = await supabase
              .from("application_documents")
              .select("id, document_type, status, created_at, updated_at")
              .eq("application_id", app.id);
            if (!isMounted) return;
            documents = (docs as DocumentRow[] | null) ?? [];
          }
        }

        const journeyResult = await journeyPromise;
        if (!isMounted) return;
        setJourney(journeyResult);
        setActivityEvents(buildActivityEvents(app, documents, journeyResult.visaPackage?.name ?? null));
      } catch {
        if (isMounted) setError(t("dashboardError"));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    function buildActivityEvents(
      application: ApplicationRow | null,
      documents: DocumentRow[],
      packageName: string | null
    ): ActivityEvent[] {
      const events: ActivityEvent[] = [];
      const visaLabel = packageName ?? t("activity.visaType");

      if (application) {
        if (application.submitted_at) {
          events.push({
            id: `app-submitted-${application.id}`,
            eventType: "status_change",
            label: t("activity.applicationSubmitted"),
            sublabel: visaLabel,
            timestamp: application.submitted_at,
            icon: "check",
          });
        }
        events.push({
          id: `app-created-${application.id}`,
          eventType: "application_created",
          label: t("activity.applicationCreated"),
          sublabel: visaLabel,
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

    fetchData();
    return () => {
      isMounted = false;
    };
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

        {/* Glass Panel - 2 cards */}
        {journey ? (
          <motion.div
            className="w-full max-w-[1090px] mt-4 xl:mt-[41px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex flex-col xl:flex-row gap-[16px] items-stretch w-full">
              <VisaOverviewCard
                visaPackage={journey.visaPackage}
                overview={journey.overview}
                hasApplication={journey.hasApplication}
              />
              <NextActionCard
                nextAction={journey.nextAction}
                hasApplication={journey.hasApplication}
              />
            </div>
          </motion.div>
        ) : null}

        {/* Per-visa journey timeline */}
        {journey ? (
          <VisaJourneyTimeline
            visaPackage={journey.visaPackage}
            overview={journey.overview}
            phases={journey.phases}
          />
        ) : null}

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