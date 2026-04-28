"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserVisaPackage } from "@/app/actions/user-package";
import {
  resolveJourney,
  evaluatePhases,
  findActivePhase,
  computePercentComplete,
  computeRemainingEtaDays,
  type ApplicationSnapshot,
  type PhaseStatus,
  type RealWorldChannel,
} from "@/lib/client/visa-journeys";

export interface JourneyVisaPackage {
  id: string;
  name: string;
  description: string | null;
  country: string;
  visaType: string;
  flag: string;
}

export interface JourneyOverview {
  currentPhaseIndex: number;
  totalPhases: number;
  currentPhaseI18nKey: string;
  currentPhaseId: string;
  percentComplete: number;
  expectedDecisionLabel: string | null;
  expectedDecisionRoughLabelKey: string;
}

export interface JourneyNextAction {
  phaseId: string;
  phaseI18nKey: string;
  ctaLabelKey: string;
  ctaHref: string;
  documentsRemaining: number;
}

export interface JourneyPhaseView {
  id: string;
  icon: string;
  i18nKey: string;
  durationLabelKey: string;
  status: PhaseStatus;
  dateLabel: string | null;
  realWorld?: RealWorldChannel;
}

export interface ApplicationJourneyPayload {
  visaPackage: JourneyVisaPackage | null;
  hasApplication: boolean;
  overview: JourneyOverview;
  nextAction: JourneyNextAction | null;
  phases: JourneyPhaseView[];
  rawJourneyVisaType: string;
}

const FLAG_BY_COUNTRY: Record<string, string> = {
  indonesia: "🇮🇩",
  united_states: "🇺🇸",
  japan: "🇯🇵",
  australia: "🇦🇺",
  singapore: "🇸🇬",
  china: "🇨🇳",
  united_kingdom: "🇬🇧",
  canada: "🇨🇦",
  vietnam: "🇻🇳",
  schengen: "🇪🇺",
  european_union: "🇪🇺",
};

function flagFor(country: string): string {
  return FLAG_BY_COUNTRY[country.toLowerCase()] ?? "🌐";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function projectDecisionDate(submittedAt: string | null, remainingEtaDays: number): string | null {
  if (!submittedAt) return null;
  const start = new Date(submittedAt);
  if (Number.isNaN(start.getTime())) return null;
  const projected = new Date(start.getTime() + remainingEtaDays * 24 * 60 * 60 * 1000);
  return projected.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AuthResolution {
  authUserId: string;
}

async function resolveAuthUserId(): Promise<AuthResolution | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("users")
      .select("auth_user_id")
      .eq("id", impersonation.userId)
      .maybeSingle();
    if (data?.auth_user_id) return { authUserId: data.auth_user_id };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { authUserId: user.id };
}

async function loadApplicationSnapshot(authUserId: string): Promise<{
  snapshot: ApplicationSnapshot;
  submittedAt: string | null;
  applicationCountry: string | null;
  applicationVisaType: string | null;
}> {
  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile) {
    return {
      snapshot: {
        hasApplication: false,
        applicationStatus: null,
        submissionResultStatus: null,
        submittedAt: null,
        documentsUploadedCount: 0,
      },
      submittedAt: null,
      applicationCountry: null,
      applicationVisaType: null,
    };
  }

  const { data: app } = await adminClient
    .from("applications")
    .select("id, status, country, visa_type, submitted_at, submission_result_status")
    .eq("applicant_id", (profile as { id: string }).id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    return {
      snapshot: {
        hasApplication: false,
        applicationStatus: null,
        submissionResultStatus: null,
        submittedAt: null,
        documentsUploadedCount: 0,
      },
      submittedAt: null,
      applicationCountry: null,
      applicationVisaType: null,
    };
  }

  const typedApp = app as {
    id: string;
    status: string;
    country: string;
    visa_type: string;
    submitted_at: string | null;
    submission_result_status: string | null;
  };

  const { count } = await adminClient
    .from("application_documents")
    .select("id", { count: "exact", head: true })
    .eq("application_id", typedApp.id)
    .neq("status", "missing");

  return {
    snapshot: {
      hasApplication: true,
      applicationStatus: typedApp.status,
      submissionResultStatus: typedApp.submission_result_status,
      submittedAt: typedApp.submitted_at,
      documentsUploadedCount: count ?? 0,
    },
    submittedAt: typedApp.submitted_at,
    applicationCountry: typedApp.country,
    applicationVisaType: typedApp.visa_type,
  };
}

function emptyPayload(): ApplicationJourneyPayload {
  const journey = resolveJourney(null, null);
  const evaluations = evaluatePhases(journey, {
    hasApplication: false,
    applicationStatus: null,
    submissionResultStatus: null,
    submittedAt: null,
    documentsUploadedCount: 0,
  });

  return {
    visaPackage: null,
    hasApplication: false,
    overview: {
      currentPhaseIndex: 0,
      totalPhases: journey.phases.length,
      currentPhaseI18nKey: `home.journey.${journey.visaType}.${journey.phases[0].id}.title`,
      currentPhaseId: journey.phases[0].id,
      percentComplete: 0,
      expectedDecisionLabel: null,
      expectedDecisionRoughLabelKey: journey.totalEtaLabelKey,
    },
    nextAction: null,
    phases: evaluations.map(({ phase, status }) => ({
      id: phase.id,
      icon: phase.icon,
      i18nKey: `home.journey.${journey.visaType}.${phase.id}`,
      durationLabelKey: phase.durationLabelKey,
      status,
      dateLabel: null,
      realWorld: phase.realWorld,
    })),
    rawJourneyVisaType: journey.visaType,
  };
}

export async function getApplicationJourney(): Promise<ApplicationJourneyPayload> {
  try {
    const auth = await resolveAuthUserId();
    if (!auth) return emptyPayload();

    const [pkg, snap] = await Promise.all([
      getUserVisaPackage(),
      loadApplicationSnapshot(auth.authUserId),
    ]);

    const country = pkg?.country ?? snap.applicationCountry;
    const visaType = pkg?.visa_type ?? snap.applicationVisaType;

    const journey = resolveJourney(country, visaType);
    const evaluations = evaluatePhases(journey, snap.snapshot);
    const active = findActivePhase(evaluations);
    const currentPhaseIndex = active
      ? evaluations.findIndex((e) => e.phase.id === active.phase.id)
      : evaluations.length - 1;
    const percentComplete = computePercentComplete(evaluations);
    const remainingEta = computeRemainingEtaDays(evaluations);
    const expectedDecisionLabel = projectDecisionDate(snap.submittedAt, remainingEta);

    const visaPackage: JourneyVisaPackage | null = pkg
      ? {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          country: pkg.country,
          visaType: pkg.visa_type,
          flag: flagFor(pkg.country),
        }
      : null;

    const phases: JourneyPhaseView[] = evaluations.map(({ phase, status }) => {
      let dateLabel: string | null = null;
      if (status === "done" && snap.submittedAt) {
        dateLabel = formatDate(snap.submittedAt);
      } else if (status === "active" && snap.submittedAt) {
        dateLabel = formatDate(snap.submittedAt);
      }
      return {
        id: phase.id,
        icon: phase.icon,
        i18nKey: `home.journey.${journey.visaType}.${phase.id}`,
        durationLabelKey: phase.durationLabelKey,
        status,
        dateLabel,
        realWorld: phase.realWorld,
      };
    });

    let nextAction: JourneyNextAction | null = null;
    if (active && active.phase.ctaHrefWhenActive) {
      nextAction = {
        phaseId: active.phase.id,
        phaseI18nKey: `home.journey.${journey.visaType}.${active.phase.id}`,
        ctaLabelKey: active.phase.ctaLabelKey ?? "home.nextAction.cta.continue",
        ctaHref: active.phase.ctaHrefWhenActive,
        documentsRemaining: 0,
      };
    } else if (active) {
      nextAction = {
        phaseId: active.phase.id,
        phaseI18nKey: `home.journey.${journey.visaType}.${active.phase.id}`,
        ctaLabelKey: active.phase.ctaLabelKey ?? "home.nextAction.cta.viewDetails",
        ctaHref: "/client/application",
        documentsRemaining: 0,
      };
    }

    const overview: JourneyOverview = {
      currentPhaseIndex,
      totalPhases: evaluations.length,
      currentPhaseI18nKey: active
        ? `home.journey.${journey.visaType}.${active.phase.id}.title`
        : `home.journey.${journey.visaType}.${journey.phases[journey.phases.length - 1].id}.title`,
      currentPhaseId: active?.phase.id ?? journey.phases[journey.phases.length - 1].id,
      percentComplete,
      expectedDecisionLabel,
      expectedDecisionRoughLabelKey: journey.totalEtaLabelKey,
    };

    return {
      visaPackage,
      hasApplication: snap.snapshot.hasApplication,
      overview,
      nextAction,
      phases,
      rawJourneyVisaType: journey.visaType,
    };
  } catch (err) {
    console.error("[getApplicationJourney] Error:", err);
    return emptyPayload();
  }
}
