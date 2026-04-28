import type { VisaJourney } from "./types";

export const auVisitor600Journey: VisaJourney = {
  visaType: "AU_VISITOR_600",
  country: "australia",
  flag: "🇦🇺",
  totalEtaLabelKey: "home.duration.aboutThreeWeeks",
  phases: [
    {
      id: "stream_select",
      icon: "🧭",
      etaDays: 1,
      durationLabelKey: "home.duration.day1",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.start",
      triggers: {
        completedWhen: { kind: "applicationStatusIn", values: ["in_progress", "submitted", "processing", "done"] },
        activeWhen: { kind: "applicationStatusIn", values: ["draft"] },
      },
    },
    {
      id: "form",
      icon: "📋",
      etaDays: 5,
      durationLabelKey: "home.duration.daysThreeToFive",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
        activeWhen: { kind: "applicationStatusIn", values: ["in_progress"] },
      },
    },
    {
      id: "signing",
      icon: "✍️",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      ctaHrefWhenActive: "/client/signing",
      ctaLabelKey: "home.nextAction.cta.signDeclaration",
      triggers: {
        // Signature submission flips the application out of in_progress; today
        // we approximate "signed" with submittedAtSet, since the AU runner
        // can only push past Review once the signature artifact is attached.
        completedWhen: { kind: "submittedAtSet" },
        activeWhen: { kind: "applicationStatusIn", values: ["in_progress"] },
      },
    },
    {
      id: "pay",
      icon: "💳",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.payNow",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "submit_online",
      icon: "✈️",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      realWorld: "online",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "biometrics_optional",
      icon: "👆",
      etaDays: 7,
      durationLabelKey: "home.duration.withinOneWeek",
      realWorld: "in_person",
      triggers: {},
    },
    {
      id: "decision",
      icon: "✅",
      etaDays: 21,
      durationLabelKey: "home.duration.aboutThreeWeeks",
      triggers: {
        activeWhen: { kind: "submittedAtSet" },
      },
    },
  ],
};
