import type { FvApplicationAnswers } from "./field-mappings";
import { NormalizationError } from "./normalize";

/**
 * A France answer that France-Visas would reject (or that is missing) and
 * that the applicant must fix in VIZA. The worker never substitutes a value:
 * an official visa form must only ever contain the applicant's own data.
 */
export interface FranceAnswerIssue {
  step: "step1" | "step2" | "step5";
  /** France-Visas field (FvApplicationAnswers key). */
  field: string;
  /** VIZA answer field(s) the value comes from, for the fix-it message. */
  answerFields: string[];
  reason: "missing" | "contains_non_latin" | "invalid_format";
  labelZh: string;
  labelEn: string;
}

const OTHER_OCCUPATION = "65005";
const STUDENT_OCCUPATION = "69005";

/** VIZA answer field and Chinese label behind each employer-section field. */
const EMPLOYER_FIELDS = {
  name: ["employer_name", "工作单位名称"],
  street: ["employer_address_line_1", "工作单位地址"],
  city: ["employer_city", "工作单位所在城市"],
  country: ["employer_country", "工作单位所在国家"],
  phone: ["employer_phone", "工作单位电话"],
  email: ["employer_email", "工作单位电子邮箱"],
} as const;
const SCHOOL_FIELDS = {
  name: ["school_name", "学校名称"],
  street: ["school_address", "学校地址"],
  city: ["school_city", "学校所在城市"],
  country: ["school_country", "学校所在国家"],
  phone: ["school_phone", "学校电话"],
  email: ["school_email", "学校电子邮箱"],
} as const;

/** Any letter that is not Latin script (Han, kana, Hangul, Cyrillic, Arabic…). */
const NON_LATIN_LETTER_RE = /(?!\p{Script=Latin})\p{L}/u;
/** Full-width forms and CJK punctuation, e.g. "，" or "（". */
function hasFullWidthText(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) return true;
  }
  return false;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9\s().-]{5,24}$/;

export function containsNonLatinText(value: string): boolean {
  return NON_LATIN_LETTER_RE.test(value) || hasFullWidthText(value);
}

interface Rule {
  field: string;
  answerFields: string[];
  labelZh: string;
  labelEn: string;
  latinOnly?: boolean;
  email?: boolean;
  phone?: boolean;
}

function check(
  step: FranceAnswerIssue["step"],
  value: string | undefined,
  rule: Rule,
  issues: FranceAnswerIssue[],
): void {
  const trimmed = value?.trim() ?? "";
  let reason: FranceAnswerIssue["reason"] | null = null;
  if (!trimmed) reason = "missing";
  else if (rule.latinOnly && containsNonLatinText(trimmed)) reason = "contains_non_latin";
  else if (rule.email && !EMAIL_RE.test(trimmed)) reason = "invalid_format";
  else if (rule.phone && !PHONE_RE.test(trimmed)) reason = "invalid_format";
  if (!reason) return;
  issues.push({
    step,
    field: rule.field,
    answerFields: rule.answerFields,
    reason,
    labelZh: rule.labelZh,
    labelEn: rule.labelEn,
  });
}

/**
 * Check the answers France-Visas receives for free text it rejects (non-Latin
 * script in official fields, malformed phone/email) or required values that
 * are missing. Returns every problem; an empty list means the answers can be
 * sent as they are. Nothing is changed.
 */
export function findFranceAnswerIssues(answers: FvApplicationAnswers): FranceAnswerIssue[] {
  const issues: FranceAnswerIssue[] = [];
  const s1 = answers.step1;
  const s2 = answers.step2;
  const s5 = answers.step5;

  check("step1", s1.depositTown || s1.depositTownCity, { field: "depositTown", answerFields: ["submission_centre"], labelZh: "递交签证申请的城市", labelEn: "City of submission" }, issues);

  check("step2", s2.placeOfBirth, { field: "placeOfBirth", answerFields: ["place_of_birth"], labelZh: "出生地", labelEn: "Place of birth", latinOnly: true }, issues);
  check("step2", s2.street, { field: "street", answerFields: ["home_address_line_1"], labelZh: "现居住址", labelEn: "Home address", latinOnly: true }, issues);
  check("step2", s2.place, { field: "place", answerFields: ["home_address_city"], labelZh: "现居城市", labelEn: "Home city", latinOnly: true }, issues);
  check("step2", s2.phoneNumber, { field: "phoneNumber", answerFields: ["phone_number"], labelZh: "电话号码", labelEn: "Phone number", phone: true }, issues);
  check("step2", s2.email, { field: "email", answerFields: ["email_address"], labelZh: "电子邮箱", labelEn: "Email address", email: true }, issues);

  // France-Visas opens the employer / educational-establishment section for
  // "Other" occupations and for students, and requires every field in it.
  const isStudent = s2.occupation === STUDENT_OCCUPATION;
  if (s2.occupation === OTHER_OCCUPATION) {
    check("step2", s2.occupationOtherSpecify, { field: "occupationOtherSpecify", answerFields: ["current_occupation"], labelZh: "职业说明", labelEn: "Occupation (please specify)", latinOnly: true }, issues);
    check("step2", s2.businessSegment, { field: "businessSegment", answerFields: ["fv_business_segment"], labelZh: "所属行业", labelEn: "Business sector" }, issues);
  }
  if (s2.occupation === OTHER_OCCUPATION || isStudent) {
    const f = isStudent ? SCHOOL_FIELDS : EMPLOYER_FIELDS;
    check("step2", s2.employerName, { field: "employerName", answerFields: [f.name[0]], labelZh: f.name[1], labelEn: "Employer or school name", latinOnly: true }, issues);
    check("step2", s2.employerStreet, { field: "employerStreet", answerFields: [f.street[0]], labelZh: f.street[1], labelEn: "Employer or school address", latinOnly: true }, issues);
    check("step2", s2.employerPlace, { field: "employerPlace", answerFields: [f.city[0]], labelZh: f.city[1], labelEn: "Employer or school city", latinOnly: true }, issues);
    check("step2", s2.employerCountry, { field: "employerCountry", answerFields: [f.country[0]], labelZh: f.country[1], labelEn: "Employer or school country" }, issues);
    check("step2", s2.employerPhone, { field: "employerPhone", answerFields: [f.phone[0]], labelZh: f.phone[1], labelEn: "Employer or school phone", phone: true }, issues);
    check("step2", s2.employerEmail, { field: "employerEmail", answerFields: [f.email[0]], labelZh: f.email[1], labelEn: "Employer or school email", email: true }, issues);
  }

  if (s5.cbxHasHostPerson) {
    check("step5", s5.hostPersonSurname, { field: "hostPersonSurname", answerFields: ["host_surname"], labelZh: "邀请人姓", labelEn: "Host surname", latinOnly: true }, issues);
    check("step5", s5.hostPersonFirstnames, { field: "hostPersonFirstnames", answerFields: ["host_given_names"], labelZh: "邀请人名", labelEn: "Host first name(s)", latinOnly: true }, issues);
    check("step5", s5.hostPersonAddress, { field: "hostPersonAddress", answerFields: ["host_address_line_1"], labelZh: "邀请人地址", labelEn: "Host address", latinOnly: true }, issues);
    check("step5", s5.hostPersonZipcode, { field: "hostPersonZipcode", answerFields: ["host_postcode"], labelZh: "邀请人地址邮编", labelEn: "Host postcode", latinOnly: true }, issues);
    check("step5", s5.hostPersonPlace, { field: "hostPersonPlace", answerFields: ["host_city"], labelZh: "邀请人所在城市", labelEn: "Host city", latinOnly: true }, issues);
    check("step5", s5.hostPersonCountry, { field: "hostPersonCountry", answerFields: ["host_country"], labelZh: "邀请人所在国家", labelEn: "Host country" }, issues);
    check("step5", s5.hostPersonPhone, { field: "hostPersonPhone", answerFields: ["host_phone"], labelZh: "邀请人电话", labelEn: "Host phone", phone: true }, issues);
    check("step5", s5.hostPersonEmail, { field: "hostPersonEmail", answerFields: ["host_email"], labelZh: "邀请人邮箱", labelEn: "Host email", email: true }, issues);
  }

  // Hotel / rental: the establishment fills France-Visas' host-organisation
  // block and, as reception, its contact person — all from accommodation_*.
  if (s5.cbxHasHostOrganization) {
    check("step5", s5.hostOrgName, { field: "hostOrgName", answerFields: ["accommodation_name"], labelZh: "酒店名称或住宿名称", labelEn: "Hotel or accommodation name", latinOnly: true }, issues);
    check("step5", s5.hostOrgStreet, { field: "hostOrgStreet", answerFields: ["accommodation_address_line_1"], labelZh: "住宿地址", labelEn: "Accommodation address", latinOnly: true }, issues);
    check("step5", s5.hostOrgZipcode, { field: "hostOrgZipcode", answerFields: ["accommodation_postcode"], labelZh: "住宿地址邮编", labelEn: "Accommodation postcode", latinOnly: true }, issues);
    check("step5", s5.hostOrgPlace, { field: "hostOrgPlace", answerFields: ["accommodation_city"], labelZh: "住宿城市", labelEn: "Accommodation city", latinOnly: true }, issues);
    check("step5", s5.hostOrgCountry, { field: "hostOrgCountry", answerFields: ["accommodation_country"], labelZh: "住宿所在申根国", labelEn: "Accommodation country" }, issues);
    check("step5", s5.hostOrgPhone, { field: "hostOrgPhone", answerFields: ["accommodation_phone"], labelZh: "住宿电话", labelEn: "Accommodation phone", phone: true }, issues);
    check("step5", s5.hostOrgEmail, { field: "hostOrgEmail", answerFields: ["accommodation_email"], labelZh: "住宿电子邮箱", labelEn: "Accommodation email", email: true }, issues);
  }

  return issues;
}

/** One-line summary for queue errors and logs (no answer values). */
export function describeFranceAnswerIssues(issues: FranceAnswerIssue[]): string {
  return issues
    .map((issue) => `${issue.labelEn} (${issue.answerFields.join("/")}): ${issue.reason}`)
    .join("; ");
}

/**
 * Thrown before any official-portal work when answers need fixing. It is a
 * data error (never retried); `issues` lists every field to correct.
 */
export class FranceAnswersInvalidError extends NormalizationError {
  readonly errorCode = "france_answers_invalid" as const;
  readonly issues: FranceAnswerIssue[];
  constructor(issues: FranceAnswerIssue[]) {
    super(issues.map((issue) => issue.answerFields[0]).join(","), describeFranceAnswerIssues(issues));
    this.name = "FranceAnswersInvalidError";
    this.issues = issues;
  }
}

/**
 * No France-Visas login is linked and automatic registration is off. The
 * applicant registers on france-visas.gouv.fr themselves and links the login
 * in VIZA; retrying without one cannot succeed, so it is a data error.
 */
export class FranceAccountRequiredError extends NormalizationError {
  readonly errorCode = "france_account_required" as const;
  readonly messageZh =
    "请先在 VIZA 关联您的 France-Visas 账号（在 france-visas.gouv.fr 注册后填写邮箱和密码），然后重新提交。";
  constructor() {
    super("fv_account", "No France-Visas account is linked for this applicant");
    this.name = "FranceAccountRequiredError";
  }
}

/** Applicant-facing Chinese message listing what to fix (no answer values). */
export function franceAnswerIssuesMessageZh(issues: FranceAnswerIssue[]): string {
  const byReason = (reason: FranceAnswerIssue["reason"]) =>
    issues.filter((issue) => issue.reason === reason).map((issue) => issue.labelZh);
  const parts: string[] = [];
  const nonLatin = byReason("contains_non_latin");
  const invalid = byReason("invalid_format");
  const missing = byReason("missing");
  if (nonLatin.length) parts.push(`请用英文或拼音填写：${nonLatin.join("、")}`);
  if (invalid.length) parts.push(`格式不正确：${invalid.join("、")}`);
  if (missing.length) parts.push(`请补充：${missing.join("、")}`);
  return `${parts.join("；")}。France-Visas 官网只接受这些信息的英文（拉丁字母）版本，修改后重新提交即可。`;
}
