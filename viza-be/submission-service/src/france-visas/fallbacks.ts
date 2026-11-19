import type { FvApplicationAnswers } from "./field-mappings";
import { NormalizationError } from "./normalize";

/**
 * A France answer that France-Visas would reject (or that is missing) and
 * that the applicant must fix in VIZA. The worker never substitutes a value:
 * an official visa form must only ever contain the applicant's own data.
 */
export interface FranceAnswerIssue {
  step: "step2" | "step5";
  /** France-Visas field (FvApplicationAnswers key). */
  field: string;
  /** VIZA answer field(s) the value comes from, for the fix-it message. */
  answerFields: string[];
  reason: "missing" | "contains_non_latin" | "invalid_format";
  labelZh: string;
  labelEn: string;
}

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
  const s2 = answers.step2;
  const s5 = answers.step5;

  check("step2", s2.placeOfBirth, { field: "placeOfBirth", answerFields: ["place_of_birth"], labelZh: "出生地", labelEn: "Place of birth", latinOnly: true }, issues);
  check("step2", s2.street, { field: "street", answerFields: ["home_address_line_1"], labelZh: "现居住址", labelEn: "Home address", latinOnly: true }, issues);
  check("step2", s2.place, { field: "place", answerFields: ["home_address_city"], labelZh: "现居城市", labelEn: "Home city", latinOnly: true }, issues);
  check("step2", s2.phoneNumber, { field: "phoneNumber", answerFields: ["phone_number"], labelZh: "电话号码", labelEn: "Phone number", phone: true }, issues);
  check("step2", s2.email, { field: "email", answerFields: ["email_address"], labelZh: "电子邮箱", labelEn: "Email address", email: true }, issues);

  // France-Visas opens the job-details subsection for "Other" occupations.
  if (s2.occupation === "65005") {
    check("step2", s2.occupationOtherSpecify, { field: "occupationOtherSpecify", answerFields: ["current_occupation"], labelZh: "职业说明", labelEn: "Occupation (please specify)", latinOnly: true }, issues);
    check("step2", s2.businessSegment, { field: "businessSegment", answerFields: ["fv_business_segment"], labelZh: "所属行业", labelEn: "Business sector" }, issues);
    check("step2", s2.employerName, { field: "employerName", answerFields: ["employer_name"], labelZh: "雇主或学校名称", labelEn: "Employer or school name", latinOnly: true }, issues);
    check("step2", s2.employerStreet, { field: "employerStreet", answerFields: ["employer_address_line_1"], labelZh: "雇主或学校地址", labelEn: "Employer or school address", latinOnly: true }, issues);
    check("step2", s2.employerPlace, { field: "employerPlace", answerFields: ["employer_city"], labelZh: "雇主或学校所在城市", labelEn: "Employer or school city", latinOnly: true }, issues);
    check("step2", s2.employerCountry, { field: "employerCountry", answerFields: ["employer_country"], labelZh: "雇主或学校所在国家", labelEn: "Employer or school country" }, issues);
    // France-Visas needs at least one employer contact; whichever is given must be valid.
    const hasPhone = Boolean(s2.employerPhone?.trim());
    const hasEmail = Boolean(s2.employerEmail?.trim());
    if (!hasPhone && !hasEmail) {
      check("step2", undefined, { field: "employerPhone", answerFields: ["employer_phone", "employer_email"], labelZh: "雇主或学校电话或邮箱", labelEn: "Employer or school phone or email" }, issues);
    }
    if (hasPhone) check("step2", s2.employerPhone, { field: "employerPhone", answerFields: ["employer_phone"], labelZh: "雇主或学校电话", labelEn: "Employer or school phone", phone: true }, issues);
    if (hasEmail) check("step2", s2.employerEmail, { field: "employerEmail", answerFields: ["employer_email"], labelZh: "雇主或学校邮箱", labelEn: "Employer or school email", email: true }, issues);
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
