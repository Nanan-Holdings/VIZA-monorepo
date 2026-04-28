import type { ApplicationPredicate, ApplicationSnapshot, JourneyPhase, PhaseStatus, VisaJourney } from "./types";
import { ukStandardVisitorJourney } from "./uk-standard-visitor";
import { usDs160Journey } from "./us-ds160";
import { schengenCShortStayJourney } from "./schengen-c-short-stay";
import { auVisitor600Journey } from "./au-visitor-600";
import { vnEVisaJourney } from "./vn-e-visa";
import { idTouristB211aJourney } from "./id-tourist-b211a";

export * from "./types";

const JOURNEYS: VisaJourney[] = [
  ukStandardVisitorJourney,
  usDs160Journey,
  schengenCShortStayJourney,
  auVisitor600Journey,
  vnEVisaJourney,
  idTouristB211aJourney,
];

const FALLBACK_JOURNEY: VisaJourney = {
  visaType: "_fallback",
  country: "_unknown",
  flag: "🌐",
  totalEtaLabelKey: "home.duration.varies",
  phases: [
    {
      id: "application",
      icon: "📋",
      etaDays: 5,
      durationLabelKey: "home.duration.daysThreeToFive",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
        activeWhen: { kind: "applicationStatusIn", values: ["draft", "in_progress"] },
      },
    },
    {
      id: "documents",
      icon: "📁",
      etaDays: 3,
      durationLabelKey: "home.duration.daysOneToThree",
      ctaHrefWhenActive: "/client/documents",
      ctaLabelKey: "home.nextAction.cta.uploadDocs",
      triggers: {
        completedWhen: { kind: "documentCountAtLeast", n: 4 },
        activeWhen: { kind: "documentCountAtLeast", n: 1 },
      },
    },
    {
      id: "submit",
      icon: "✈️",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "review",
      icon: "🔍",
      etaDays: 7,
      durationLabelKey: "home.duration.aboutOneWeek",
      triggers: {
        activeWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "decision",
      icon: "✅",
      etaDays: 7,
      durationLabelKey: "home.duration.varies",
      triggers: {},
    },
  ],
};

export function resolveJourney(country: string | null, visaType: string | null): VisaJourney {
  if (visaType) {
    const lcVisa = visaType.toLowerCase();
    const byVisaType = JOURNEYS.find(
      (j) =>
        j.visaType.toLowerCase() === lcVisa ||
        (j.visaTypeAliases ?? []).some((a) => a.toLowerCase() === lcVisa)
    );
    if (byVisaType) return byVisaType;
  }
  if (country) {
    const lcCountry = country.toLowerCase();
    const byCountry = JOURNEYS.find(
      (j) =>
        j.country === lcCountry ||
        (j.countryAliases ?? []).some((a) => a.toLowerCase() === lcCountry)
    );
    if (byCountry) return byCountry;
  }
  return FALLBACK_JOURNEY;
}

function evaluatePredicate(predicate: ApplicationPredicate | undefined, snap: ApplicationSnapshot): boolean {
  if (!predicate) return false;
  switch (predicate.kind) {
    case "always":
      return true;
    case "applicationStatusIn":
      return snap.applicationStatus !== null && predicate.values.includes(snap.applicationStatus);
    case "submissionResultStatusIn":
      return snap.submissionResultStatus !== null && predicate.values.includes(snap.submissionResultStatus);
    case "submittedAtSet":
      return snap.submittedAt !== null;
    case "documentCountAtLeast":
      return snap.documentsUploadedCount >= predicate.n;
    default:
      return false;
  }
}

export interface PhaseEvaluation {
  phase: JourneyPhase;
  status: PhaseStatus;
}

/**
 * Walk phases in order; first phase whose `completedWhen` is false becomes
 * the active phase. Everything before is `done`, everything after is
 * `upcoming`. Honours an explicit `activeWhen` predicate as a tiebreaker.
 */
export function evaluatePhases(journey: VisaJourney, snap: ApplicationSnapshot): PhaseEvaluation[] {
  if (!snap.hasApplication) {
    return journey.phases.map((phase, idx) => ({
      phase,
      status: idx === 0 ? "active" : "upcoming",
    }));
  }

  const completed = journey.phases.map((p) => evaluatePredicate(p.triggers.completedWhen, snap));
  const explicitActive = journey.phases.map((p) => evaluatePredicate(p.triggers.activeWhen, snap));

  let activeIdx = -1;

  // Prefer an explicitly-active phase that hasn't completed yet.
  for (let i = 0; i < journey.phases.length; i++) {
    if (explicitActive[i] && !completed[i]) {
      activeIdx = i;
      break;
    }
  }

  // Fallback: first non-completed phase after a completed one.
  if (activeIdx < 0) {
    for (let i = 0; i < journey.phases.length; i++) {
      if (!completed[i]) {
        activeIdx = i;
        break;
      }
    }
  }

  if (activeIdx < 0) {
    return journey.phases.map((phase) => ({ phase, status: "done" as PhaseStatus }));
  }

  return journey.phases.map((phase, i) => {
    let status: PhaseStatus;
    if (i < activeIdx) status = "done";
    else if (i === activeIdx) status = "active";
    else status = "upcoming";
    return { phase, status };
  });
}

export function findActivePhase(evaluations: PhaseEvaluation[]): PhaseEvaluation | null {
  return evaluations.find((e) => e.status === "active") ?? null;
}

export function computePercentComplete(evaluations: PhaseEvaluation[]): number {
  if (evaluations.length === 0) return 0;
  const doneCount = evaluations.filter((e) => e.status === "done").length;
  const active = evaluations.find((e) => e.status === "active") ? 0.5 : 0;
  const pct = ((doneCount + active) / evaluations.length) * 100;
  return Math.round(pct);
}

export function computeRemainingEtaDays(evaluations: PhaseEvaluation[]): number {
  return evaluations
    .filter((e) => e.status === "active" || e.status === "upcoming")
    .reduce((sum, e) => sum + e.phase.etaDays, 0);
}
