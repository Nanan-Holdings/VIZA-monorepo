import type { VisaJourney } from "./types";

export const idTouristB211aJourney: VisaJourney = {
  visaType: "B211A",
  visaTypeAliases: ["tourist_b211a"],
  country: "indonesia",
  flag: "🇮🇩",
  totalEtaLabelKey: "home.duration.aboutFiveWorkingDays",
  phases: [
    {
      id: "form",
      icon: "📋",
      etaDays: 1,
      durationLabelKey: "home.duration.day1",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: {
          kind: "applicationStatusIn",
          values: ["submitted", "processing", "done"],
        },
        activeWhen: { kind: "applicationStatusIn", values: ["draft", "in_progress"] },
      },
    },
    {
      id: "submit",
      icon: "✈️",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      realWorld: "online",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "pay",
      icon: "💳",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      triggers: {
        completedWhen: {
          kind: "applicationStatusIn",
          values: ["processing", "done"],
        },
        activeWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "email_visa",
      icon: "📧",
      etaDays: 5,
      durationLabelKey: "home.duration.aboutFiveWorkingDays",
      triggers: {
        completedWhen: { kind: "applicationStatusIn", values: ["done"] },
        activeWhen: { kind: "applicationStatusIn", values: ["processing"] },
      },
    },
  ],
};
