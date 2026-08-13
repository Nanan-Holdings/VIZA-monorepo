import {
  getApplicationStepSectionKey,
  type ApplicationStepRef,
  type ApplicationStepSection,
} from "@/lib/application-step-sections";

const SECTION_TITLES = {
  delivery: "递送地点",
  overseasTourism: "旅居海外大陆地区人民申请来台观光",
  applicant: "申请人资料",
  kinship: "亲属状况（亲属资料）",
  declaration: "申报事项",
} as const;

const QUALIFICATION_STEP = "Photo & Basic Status";
const DOCUMENTS_STEP = "Supporting Documents";

export function isTaiwanEntryPermitQualificationStepSource(sourceName?: string | null): boolean {
  return sourceName === QUALIFICATION_STEP;
}

export function shouldShowStandaloneDocumentStep(showDocumentStep: boolean, visaType?: string | null): boolean {
  return showDocumentStep && visaType !== "TW_ENTRY_PERMIT";
}

export function getTaiwanEntryPermitInlineDocumentStepId(
  steps: Array<{ id: number; sourceName?: string | null }>,
): number | null {
  return steps.find((step) => isTaiwanEntryPermitQualificationStepSource(step.sourceName))?.id ?? null;
}

export function buildTaiwanEntryPermitSections<TStep extends ApplicationStepRef>(
  steps: TStep[],
): ApplicationStepSection<TStep>[] {
  const sections: ApplicationStepSection<TStep>[] = [
    { id: "taiwan-delivery", key: "personal", title: SECTION_TITLES.delivery, steps: [] },
    { id: "taiwan-overseas-tourism", key: "travel", title: SECTION_TITLES.overseasTourism, steps: [] },
    { id: "taiwan-applicant", key: "personal", title: SECTION_TITLES.applicant, steps: [] },
    { id: "taiwan-kinship", key: "family", title: SECTION_TITLES.kinship, steps: [] },
    { id: "taiwan-declaration", key: "securityAndBackground", title: SECTION_TITLES.declaration, steps: [] },
  ];
  const byId = new Map(sections.map((section) => [section.id, section]));
  const fallbackSections: ApplicationStepSection<TStep>[] = [];

  for (const step of steps) {
    switch (step.sourceName) {
      case "Delivery Location":
        byId.get("taiwan-delivery")?.steps.push({ ...step, name: "递送地点" });
        break;
      case QUALIFICATION_STEP:
        byId.get("taiwan-overseas-tourism")?.steps.push({ ...step, name: "申请资格与证别" });
        break;
      case DOCUMENTS_STEP:
        break;
      case "Applicant Identity":
        byId.get("taiwan-applicant")?.steps.push({ ...step, name: "申请人资料" });
        break;
      case "Taiwan Contact Address":
        byId.get("taiwan-applicant")?.steps.push({ ...step, name: "在台联络地址" });
        break;
      case "Other Nationality":
        byId.get("taiwan-applicant")?.steps.push({ ...step, name: "其他国籍护（证）照" });
        break;
      case "Kinship Information":
        byId.get("taiwan-kinship")?.steps.push({ ...step, name: "亲属状况（亲属资料）" });
        break;
      case "Declaration":
        byId.get("taiwan-declaration")?.steps.push({ ...step, name: "申报事项" });
        break;
      default:
        fallbackSections.push({
          id: `taiwan-${String(step.sourceName ?? step.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          key: getApplicationStepSectionKey(step),
          title: step.name,
          steps: [step],
        });
    }
  }

  return [...sections.filter((section) => section.steps.length > 0), ...fallbackSections];
}
