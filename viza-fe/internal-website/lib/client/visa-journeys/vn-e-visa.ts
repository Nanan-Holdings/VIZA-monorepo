import type { VisaJourney } from "./types";

export const vnEVisaJourney: VisaJourney = {
  visaType: "VN_E_VISA",
  country: "vietnam",
  flag: "🇻🇳",
  totalEtaLabelKey: "home.duration.aboutThreeWorkingDays",
  phases: [
    {
      id: "form",
      icon: "📋",
      etaDays: 1,
      durationLabelKey: "home.duration.day1",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: { kind: "submittedAtSet" },
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
        completedWhen: { kind: "submittedAtSet" },
      },
    },
    {
      id: "wait_email",
      icon: "📧",
      etaDays: 3,
      durationLabelKey: "home.duration.aboutThreeWorkingDays",
      triggers: {
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["submitted_pending_email"],
        },
      },
    },
    {
      id: "print_and_travel",
      icon: "🖨️",
      etaDays: 1,
      durationLabelKey: "home.duration.day1",
      realWorld: "in_person",
      triggers: {},
    },
  ],
};
