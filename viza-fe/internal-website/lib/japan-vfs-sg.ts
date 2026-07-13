export type JapanVisaRequestType = "single_entry" | "double_entry" | "multiple_entry";
export type SingaporePassType = "pr" | "employment_pass" | "s_pass" | "work_permit" | "dependent_pass" | "long_term_visit_pass" | "student_pass";
export type JapanApplicantOccupation = "employed" | "self_employed" | "student" | "retired" | "housewife" | "unemployed";

export interface JapanVfsEligibilityInput {
  nationality: string | null | undefined;
  passportType: string | null | undefined;
  singaporePassType: string | null | undefined;
  singaporePassExpiryDate: string | null | undefined;
  intendedReturnDate: string | null | undefined;
}

export interface JapanVfsChecklistItem {
  id: string;
  labelZh: string;
  labelEn: string;
  required: boolean;
  noteZh: string;
}

const VALID_PASSES = new Set<SingaporePassType>([
  "pr", "employment_pass", "s_pass", "work_permit", "dependent_pass", "long_term_visit_pass", "student_pass",
]);

function isOnOrAfter(left: string, right: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(left) && /^\d{4}-\d{2}-\d{2}$/.test(right) && left >= right;
}

export function getJapanVfsEligibility(input: JapanVfsEligibilityInput): { eligible: boolean; reasonZh: string } {
  if (!/^(china|cn|people'?s republic of china|中国)$/i.test(input.nationality?.trim() ?? "")) {
    return { eligible: false, reasonZh: "此服务仅适用于中国普通护照持有人。" };
  }
  if (!/^(ordinary|regular|normal|普通)$/i.test(input.passportType?.trim() ?? "")) {
    return { eligible: false, reasonZh: "仅支持普通护照；外交、公务及其他旅行证件请按使馆指引办理。" };
  }
  if (!VALID_PASSES.has(input.singaporePassType as SingaporePassType)) {
    return { eligible: false, reasonZh: "新加坡短期访客不能在当地递交。请提供有效 PR 或长期准证。" };
  }
  if (!input.singaporePassExpiryDate || !input.intendedReturnDate || !isOnOrAfter(input.singaporePassExpiryDate, input.intendedReturnDate)) {
    return { eligible: false, reasonZh: "新加坡准证必须覆盖日本行程及返回新加坡日期。" };
  }
  return { eligible: true, reasonZh: "您符合在新加坡 JVAC（VFS）递交旅游签证的基本资格。" };
}

export function getJapanVfsChecklist(
  visaType: JapanVisaRequestType,
  occupation: JapanApplicantOccupation,
): JapanVfsChecklistItem[] {
  const items: JapanVfsChecklistItem[] = [
    { id: "passport", labelZh: "有效护照原件", labelEn: "Valid passport (original)", required: true, noteZh: "请确认有足够空白签证页。" },
    { id: "application_form", labelZh: "签证申请表", labelEn: "Visa application form", required: true, noteZh: "完成、打印并按护照签名式样签署。" },
    { id: "photo", labelZh: "近六个月白底证件照", labelEn: "Recent colour photo", required: true, noteZh: "按 JVAC 尺寸要求粘贴，不用订书钉。" },
    { id: "sg_pass", labelZh: "新加坡长期准证", labelEn: "Singapore long-term pass", required: true, noteZh: "正反面复印件；数字准证附验证页，且须覆盖返新日期。" },
    { id: "financial", labelZh: "财力证明", labelEn: "Financial proof", required: true, noteZh: "IRAS 报税通知或近期银行流水/存折。" },
    { id: "flight", labelZh: "往返航班信息", labelEn: "Round-trip flight information", required: true, noteZh: "应显示姓名、航班、日期和时间。" },
    { id: "itinerary", labelZh: "逐日行程", labelEn: "Daily schedule of stay", required: true, noteZh: "与航班及住宿日期一致。" },
  ];
  if (occupation === "employed") items.splice(4, 0, { id: "employment", labelZh: "在职证明", labelEn: "Certificate of employment", required: true, noteZh: "使用公司抬头并注明职位、入职日期及准假信息。" });
  if (occupation === "self_employed") items.splice(4, 0, { id: "acra", labelZh: "ACRA 企业资料", labelEn: "ACRA business profile", required: true, noteZh: "签发日期应在三个月内。" });
  if (["student", "retired", "housewife", "unemployed"].includes(occupation)) items.splice(4, 0,
    { id: "sponsor_letter", labelZh: "资助信", labelEn: "Sponsorship letter", required: true, noteZh: "说明旅费由谁承担。" },
    { id: "relationship", labelZh: "关系证明", labelEn: "Proof of relationship", required: true, noteZh: "如结婚证或出生证明。" },
    { id: "sponsor_financial", labelZh: "资助人财力与身份材料", labelEn: "Sponsor financial and identity proof", required: true, noteZh: "附资助人的护照资料页、准证和财力证明。" },
  );
  if (visaType === "multiple_entry") items.push(
    { id: "multiple_reason", labelZh: "多次签申请理由说明", labelEn: "Multiple-entry visa explanation", required: true, noteZh: "说明多次赴日旅游需求，内容须与行程和财力材料一致。" },
    { id: "multiple_financial", labelZh: "多次签财力/关系材料", labelEn: "Multiple-entry financial or family proof", required: true, noteZh: "主申请人及随行配偶/子女按最新 JVAC 清单提交。" },
  );
  return items;
}

export const JAPAN_VFS_SG_OFFICIAL_URL = "https://visa.vfsglobal.com/sgp/en/jpn/book-an-appointment";
