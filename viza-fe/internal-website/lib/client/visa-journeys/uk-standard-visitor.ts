import type { VisaJourney } from "./types";
import { UK_VISA_LINKS } from "../uk-visa-links";

export const ukStandardVisitorJourney: VisaJourney = {
  visaType: "UK_STANDARD_VISITOR",
  country: "united_kingdom",
  flag: "🇬🇧",
  totalEtaLabelKey: "home.duration.aboutThreeWeeks",
  phases: [
    {
      id: "ukvi_account",
      icon: "🔑",
      etaDays: 1,
      durationLabelKey: "home.duration.day1",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.start",
      triggers: {
        completedWhen: {
          kind: "applicationStatusIn",
          values: ["draft", "in_progress", "submitted", "processing", "done"],
        },
      },
    },
    {
      id: "form",
      icon: "📋",
      etaDays: 3,
      durationLabelKey: "home.duration.daysOneToThree",
      ctaHrefWhenActive: "/client/application",
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: {
          kind: "submissionResultStatusIn",
          values: [
            "stopped_at_pay",
            "funding_required",
            "payment_pending",
            "payment_review_required",
            "paid",
            "submitted_pending_email",
            "submitted",
          ],
        },
        activeWhen: { kind: "applicationStatusIn", values: ["draft", "in_progress"] },
      },
    },
    {
      id: "pay",
      icon: "📄",
      etaDays: 1,
      durationLabelKey: "home.duration.sameDay",
      ctaHrefWhenActive: UK_VISA_LINKS.signInVisaApplication,
      ctaLabelKey: "home.nextAction.cta.continue",
      triggers: {
        completedWhen: {
          kind: "submissionResultStatusIn",
          values: ["submitted_pending_email", "submitted"],
        },
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: [
            "stopped_at_pay",
            "funding_required",
            "payment_pending",
            "payment_review_required",
            "paid",
          ],
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
        completedWhen: { kind: "documentCountAtLeast", n: 5 },
        activeWhen: { kind: "documentCountAtLeast", n: 1 },
      },
    },
    {
      id: "ukvcas",
      icon: "👆",
      etaDays: 7,
      durationLabelKey: "home.duration.withinOneWeek",
      realWorld: "in_person",
      ctaLabelKey: "home.nextAction.cta.bookAppointment",
      triggers: {
        completedWhen: {
          kind: "submissionResultStatusIn",
          values: ["submitted"],
        },
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["appointment_held"],
        },
      },
    },
    {
      id: "decision",
      icon: "✅",
      etaDays: 21,
      durationLabelKey: "home.duration.aboutThreeWeeks",
      triggers: {
        activeWhen: {
          kind: "submissionResultStatusIn",
          values: ["submitted"],
        },
      },
    },
  ],
};
