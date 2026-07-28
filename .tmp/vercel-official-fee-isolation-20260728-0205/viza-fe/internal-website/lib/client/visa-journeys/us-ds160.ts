import type { VisaJourney } from "./types";

export const usDs160Journey: VisaJourney = {
  visaType: "B1_B2",
  visaTypeAliases: ["DS160", "US_B1_B2"],
  country: "united_states",
  flag: "🇺🇸",
  totalEtaLabelKey: "home.duration.threeToSixWeeks",
  phases: [
    {
      id: "form",
      icon: "📋",
      etaDays: 5,
      durationLabelKey: "home.duration.daysThreeToFive",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: {
          kind: "submissionResultStatusIn",
          values: ["stopped_at_pay", "stopped_at_sign", "submitted"],
        },
        activeWhen: { kind: "applicationStatusIn", values: ["draft", "in_progress"] },
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
        completedWhen: {
          kind: "submissionResultStatusIn",
          values: ["stopped_at_sign", "submitted"],
        },
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["stopped_at_pay"],
        },
      },
    },
    {
      id: "schedule_interview",
      icon: "📅",
      etaDays: 14,
      durationLabelKey: "home.duration.oneToTwoWeeks",
      ctaLabelKey: "home.nextAction.cta.bookInterview",
      triggers: {
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["stopped_at_sign"],
        },
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
      id: "interview",
      icon: "🎤",
      etaDays: 1,
      durationLabelKey: "home.duration.dayOf",
      realWorld: "in_person",
      triggers: {},
    },
    {
      id: "passport_pickup",
      icon: "📬",
      etaDays: 7,
      durationLabelKey: "home.duration.aboutOneWeek",
      realWorld: "mail",
      triggers: {},
    },
    {
      id: "decision",
      icon: "✅",
      etaDays: 14,
      durationLabelKey: "home.duration.oneToTwoWeeks",
      triggers: {
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["submitted"],
        },
      },
    },
  ],
};
