import type { VisaJourney } from "./types";

export const schengenCShortStayJourney: VisaJourney = {
  visaType: "EU_SCHENGEN_C_SHORT_STAY",
  country: "european_union",
  countryAliases: ["schengen"],
  flag: "🇪🇺",
  totalEtaLabelKey: "home.duration.aboutFifteenWorkingDays",
  phases: [
    {
      id: "form",
      icon: "📋",
      etaDays: 4,
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
      etaDays: 5,
      durationLabelKey: "home.duration.daysThreeToFive",
      ctaHrefWhenActive: "/client/documents",
      ctaLabelKey: "home.nextAction.cta.uploadDocs",
      triggers: {
        completedWhen: { kind: "documentCountAtLeast", n: 5 },
        activeWhen: { kind: "documentCountAtLeast", n: 1 },
      },
    },
    {
      id: "vfs_appointment",
      icon: "📅",
      etaDays: 7,
      durationLabelKey: "home.duration.withinOneWeek",
      realWorld: "in_person",
      ctaLabelKey: "home.nextAction.cta.bookAppointment",
      triggers: {
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["appointment_held"],
        },
      },
    },
    {
      id: "biometrics",
      icon: "👆",
      etaDays: 1,
      durationLabelKey: "home.duration.dayOf",
      realWorld: "in_person",
      triggers: {},
    },
    {
      id: "decision",
      icon: "✅",
      etaDays: 15,
      durationLabelKey: "home.duration.aboutFifteenWorkingDays",
      triggers: {
        activeWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "passport_pickup",
      icon: "📬",
      etaDays: 3,
      durationLabelKey: "home.duration.daysOneToThree",
      realWorld: "in_person",
      triggers: {},
    },
  ],
};
