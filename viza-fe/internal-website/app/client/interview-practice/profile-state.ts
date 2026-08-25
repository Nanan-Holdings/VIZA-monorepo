import type {
  ApplicantProfile,
  InterviewContextSummary,
  InterviewProfileField,
  InterviewProfileFieldState,
  InterviewQuestion,
} from "@/app/api/interview/types";

export const INTERVIEW_DISCLAIMER_VERSION = 1;

export const PROFILE_GROUPS: Array<{
  title: string;
  fields: InterviewProfileField[];
}> = [
  { title: "访问计划", fields: ["purpose", "purposeDetails", "destinations", "travelDates", "duration"] },
  { title: "资金与职业", fields: ["funding", "budget", "occupation", "employer"] },
  { title: "旅行经历", fields: ["previousTravel", "companions", "usContact", "refusalHistory"] },
  { title: "约束与回国安排", fields: ["homeTies"] },
];

export const KEY_INTERVIEW_FIELDS: InterviewProfileField[] = [
  "purposeDetails",
  "destinations",
  "travelDates",
  "duration",
  "funding",
  "occupation",
  "homeTies",
];

function valueFor(profile: ApplicantProfile, field: InterviewProfileField) {
  if (field === "purpose") return profile.purpose === "other" && !profile.purposeDetails.trim() ? "" : profile.purpose;
  return (profile[field] ?? "").trim();
}

export function fieldState(
  context: InterviewContextSummary | null,
  field: InterviewProfileField,
): InterviewProfileFieldState {
  return context?.fieldStates?.find((state) => state.field === field) ?? {
    field,
    status: "missing",
    source: null,
  };
}

function rebuildContext(
  context: InterviewContextSummary,
  states: InterviewProfileFieldState[],
): InterviewContextSummary {
  const missingFields = states.filter((state) => state.status === "missing").map((state) => state.field);
  const verifiedFields = states.filter((state) => state.status === "confirmed").map((state) => state.field);
  const needsConfirmationFields = states.filter((state) => state.status === "needs_confirmation").map((state) => state.field);
  return {
    ...context,
    fieldStates: states,
    missingFields,
    verifiedFields,
    needsConfirmationFields,
    consistencyStatus: verifiedFields.length === 0
      ? "unverified"
      : missingFields.length || needsConfirmationFields.length
        ? "partially_verifiable"
        : "verifiable",
  };
}

export function updatePracticeField(
  profile: ApplicantProfile,
  context: InterviewContextSummary | null,
  field: InterviewProfileField,
  value: string,
): { profile: ApplicantProfile; context: InterviewContextSummary | null } {
  const nextProfile = { ...profile, [field]: value } as ApplicantProfile;
  if (!context) return { profile: nextProfile, context };
  const currentStates = context.fieldStates ?? [];
  const nextState: InterviewProfileFieldState = {
    field,
    status: value.trim() ? "confirmed" : "missing",
    source: value.trim() ? "practice" : null,
  };
  const states = currentStates.some((state) => state.field === field)
    ? currentStates.map((state) => state.field === field ? nextState : state)
    : [...currentStates, nextState];
  return { profile: nextProfile, context: rebuildContext(context, states) };
}

export function confirmExistingProfile(
  profile: ApplicantProfile,
  context: InterviewContextSummary,
): InterviewContextSummary {
  const states = (context.fieldStates ?? []).map((state) => (
    valueFor(profile, state.field)
      ? { ...state, status: "confirmed" as const }
      : { ...state, status: "missing" as const, source: null }
  ));
  return rebuildContext(context, states);
}

export function mergeLoadedProfile(
  currentProfile: ApplicantProfile,
  currentContext: InterviewContextSummary | null,
  loadedProfile: ApplicantProfile,
) {
  if (!currentContext) return loadedProfile;
  const next = { ...currentProfile };
  for (const field of Object.keys(loadedProfile) as InterviewProfileField[]) {
    const state = fieldState(currentContext, field);
    const preservePracticeValue = state.source === "practice"
      && state.status === "confirmed"
      && Boolean(valueFor(next, field));
    if (preservePracticeValue) continue;
    (next as Record<InterviewProfileField, string>)[field] = loadedProfile[field] ?? "";
  }
  return next;
}

const ANSWER_CAPTURE_FIELDS: Record<string, InterviewProfileField[]> = {
  purpose: ["purposeDetails"],
  itinerary: ["destinations"],
  duration: ["duration"],
  funding: ["funding"],
  employment_education: ["occupation"],
  companions_contact: ["companions", "usContact"],
  travel_refusal_history: ["previousTravel", "refusalHistory"],
  return_ties: ["homeTies"],
};

export function captureMissingFactsFromAnswer(
  profile: ApplicantProfile,
  context: InterviewContextSummary | null,
  question: InterviewQuestion,
  answer: string,
) {
  if (!context || !answer.trim()) return { profile, context };
  const questionId = question.parentId ?? question.id;
  let nextProfile = profile;
  let nextContext: InterviewContextSummary | null = context;
  for (const field of ANSWER_CAPTURE_FIELDS[questionId] ?? []) {
    if (fieldState(nextContext, field).status !== "missing") continue;
    const updated = updatePracticeField(nextProfile, nextContext, field, answer.trim());
    nextProfile = updated.profile;
    nextContext = updated.context;
  }
  return { profile: nextProfile, context: nextContext };
}

export function profilePreparationCounts(context: InterviewContextSummary | null) {
  const states = context?.fieldStates ?? [];
  return {
    confirmed: states.filter((state) => state.status === "confirmed").length,
    needsConfirmation: states.filter((state) => state.status === "needs_confirmation").length,
    criticalMissing: states.filter((state) => state.status === "missing" && KEY_INTERVIEW_FIELDS.includes(state.field)).length,
  };
}
