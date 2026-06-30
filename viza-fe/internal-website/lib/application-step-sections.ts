export type ApplicationStepSectionKey =
  | "personal"
  | "travel"
  | "travelCompanions"
  | "previousTravel"
  | "addressAndPhone"
  | "passport"
  | "usContact"
  | "family"
  | "workEducationTraining"
  | "securityAndBackground"
  | "documents"
  | "photo"
  | "review"
  | "team"
  | "confirmation";

export interface ApplicationStepRef {
  id: number;
  name: string;
  description: string;
  sourceName?: string;
}

export interface ApplicationStepSection<TStep extends ApplicationStepRef = ApplicationStepRef> {
  id: string;
  key: ApplicationStepSectionKey;
  title: string;
  steps: TStep[];
}

function normalizeStepName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function getDynamicStepTranslationCandidates(stepName: string): string[] {
  const trimmed = stepName.trim().replace(/\s+/g, " ");
  const withoutDots = trimmed.replace(/\./g, "");
  const slashTight = withoutDots.replace(/\s*\/\s*/g, "/");
  const slashSpaced = withoutDots.replace(/\s*\/\s*/g, " / ");
  const ampersandAsAnd = withoutDots.replace(/\s*&\s*/g, " and ");
  const andAsAmpersand = withoutDots.replace(/\s+and\s+/gi, " & ");

  return Array.from(new Set([
    trimmed,
    withoutDots,
    slashTight,
    slashSpaced,
    ampersandAsAnd,
    andAsAmpersand,
  ]));
}

export function getApplicationStepSectionKey(step: Pick<ApplicationStepRef, "name" | "sourceName">): ApplicationStepSectionKey {
  const rawSourceName = (step.sourceName ?? step.name).trim();
  const sourceName = normalizeStepName(rawSourceName);

  if (rawSourceName.includes("旅客信息") || rawSourceName.includes("个人信息")) return "personal";
  if (rawSourceName.includes("护照信息") || rawSourceName.includes("旅行证件")) return "passport";
  if (
    rawSourceName.includes("抵达") ||
    rawSourceName.includes("离境") ||
    rawSourceName.includes("行程信息") ||
    rawSourceName.includes("旅行信息") ||
    rawSourceName.includes("停留信息")
  ) return "travel";
  if (
    rawSourceName.includes("住宿信息") ||
    rawSourceName.includes("联系信息") ||
    rawSourceName.includes("居住")
  ) return "addressAndPhone";
  if (rawSourceName.includes("健康申报") || rawSourceName.includes("声明")) return "securityAndBackground";
  if (rawSourceName.includes("支持材料") || rawSourceName.includes("材料")) return "documents";
  if (rawSourceName.includes("团队") || rawSourceName.includes("同行")) return "team";
  if (rawSourceName.includes("确认")) return "confirmation";
  if (rawSourceName.includes("审核")) return "review";

  if (sourceName.startsWith("required information")) return "personal";
  if (sourceName.startsWith("personal information")) return "personal";
  if (sourceName.startsWith("personal details")) return "personal";
  if (sourceName.startsWith("traveller information")) return "personal";
  if (sourceName.startsWith("requested information")) return "travel";
  if (sourceName.startsWith("travel information")) return "travel";
  if (sourceName.startsWith("information about the trip")) return "travel";
  if (sourceName.startsWith("trip details")) return "travel";
  if (sourceName.startsWith("trip information")) return "travel";
  if (sourceName.startsWith("stay in malaysia") || sourceName.startsWith("stay in thailand")) return "travel";
  if (sourceName.startsWith("trip expenses") || sourceName.includes("expenses insurance")) return "travel";
  if (sourceName.startsWith("accompanying children")) return "travel";
  if (sourceName.startsWith("accommodation in schengen")) return "travel";
  if (sourceName.startsWith("travel companions")) return "travelCompanions";
  if (sourceName.startsWith("travel history")) return "previousTravel";
  if (sourceName.startsWith("previous u s travel") || sourceName.startsWith("previous us travel")) return "previousTravel";
  if (sourceName.startsWith("contact information")) return "addressAndPhone";
  if (sourceName.startsWith("address and phone")) return "addressAndPhone";
  if (sourceName.startsWith("contact details residence") || sourceName.startsWith("contact details and residence")) return "addressAndPhone";
  if (sourceName.includes("passport information")) return "passport";
  if (sourceName.startsWith("travel document identity") || sourceName.startsWith("travel document and identity")) return "passport";
  if (sourceName.includes("us contact information") || sourceName.includes("us point of contact")) return "usContact";
  if (sourceName.startsWith("family information")) return "family";
  if (sourceName.startsWith("eu eea ch family member")) return "family";
  if (sourceName.includes("work education training") || sourceName.includes("work and education")) return "workEducationTraining";
  if (sourceName.startsWith("occupation")) return "workEducationTraining";
  if (sourceName.startsWith("financial support")) return "travel";
  if (sourceName.startsWith("health declaration")) return "securityAndBackground";
  if (sourceName.startsWith("official submission checklist")) return "securityAndBackground";
  if (sourceName.startsWith("declaration")) return "securityAndBackground";
  if (sourceName.startsWith("security and background")) return "securityAndBackground";
  if (sourceName.startsWith("supporting documents") || sourceName.startsWith("upload documents")) return "documents";
  if (sourceName.startsWith("upload photo")) return "photo";
  if (sourceName.startsWith("review")) return "review";
  if (sourceName.startsWith("team")) return "team";
  if (sourceName.startsWith("confirmation")) return "confirmation";

  return "review";
}

export function buildApplicationStepSections<TStep extends ApplicationStepRef>(
  steps: TStep[],
  titles: Record<ApplicationStepSectionKey, string>,
): ApplicationStepSection<TStep>[] {
  const sections: ApplicationStepSection<TStep>[] = [];

  for (const step of steps) {
    const key = getApplicationStepSectionKey(step);
    const previousSection = sections[sections.length - 1];
    if (previousSection?.key === key) {
      previousSection.steps.push(step);
      continue;
    }

    sections.push({
      id: `${key}-${sections.length}`,
      key,
      title: titles[key],
      steps: [step],
    });
  }

  return sections;
}
