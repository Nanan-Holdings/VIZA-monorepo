export type PhaseStatus = "done" | "active" | "upcoming" | "locked" | "blocked";

export type RealWorldChannel = "in_person" | "mail" | "online";

export type ApplicationPredicate =
  | { kind: "applicationStatusIn"; values: string[] }
  | { kind: "submissionResultStatusIn"; values: string[] }
  | { kind: "submittedAtSet" }
  | { kind: "documentCountAtLeast"; n: number }
  | { kind: "always" };

export interface JourneyPhase {
  id: string;
  icon: string;
  etaDays: number;
  durationLabelKey: string;
  realWorld?: RealWorldChannel;
  ctaHrefWhenActive?: string;
  ctaLabelKey?: string;
  triggers: {
    completedWhen?: ApplicationPredicate;
    activeWhen?: ApplicationPredicate;
  };
}

export interface VisaJourney {
  visaType: string;
  visaTypeAliases?: string[];
  country: string;
  countryAliases?: string[];
  flag: string;
  totalEtaLabelKey: string;
  phases: JourneyPhase[];
}

export interface ApplicationSnapshot {
  hasApplication: boolean;
  applicationStatus: string | null;
  submissionResultStatus: string | null;
  submittedAt: string | null;
  documentsUploadedCount: number;
}
