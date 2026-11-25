/**
 * Answers the France-Visas official form receives must be the applicant's own
 * values in Latin script. These rules mirror the submission worker's
 * `findFranceAnswerIssues` (viza-be/submission-service/src/france-visas/
 * fallbacks.ts), which is the final authority; this copy lets the applicant fix
 * fields before a job is queued.
 */

export interface FranceAnswerProblem {
  field: string;
  labelZh: string;
  reason: "missing" | "contains_non_latin" | "invalid_format";
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

type Kind = "latin" | "phone" | "email" | "any";

const APPLICANT_FIELDS: Array<[string, string, Kind]> = [
  ["place_of_birth", "出生地", "latin"],
  ["home_address_line_1", "现居住址", "latin"],
  ["home_address_city", "现居城市", "latin"],
  ["phone_number", "电话号码", "phone"],
  ["email_address", "电子邮箱", "email"],
  ["employer_name", "雇主或学校名称", "latin"],
  ["employer_address_line_1", "雇主或学校地址", "latin"],
  ["employer_city", "雇主或学校所在城市", "latin"],
  ["employer_phone", "雇主或学校电话", "phone"],
  ["employer_email", "雇主或学校邮箱", "email"],
];

/**
 * France-Visas opens its employer / educational-establishment section for
 * students and requires every field in it; VIZA fills it from these answers.
 */
const SCHOOL_FIELDS: Array<[string, string, Kind]> = [
  ["school_name", "学校名称", "latin"],
  ["school_address", "学校地址", "latin"],
  ["school_city", "学校所在城市", "latin"],
  ["school_country", "学校所在国家", "any"],
  ["school_phone", "学校电话", "phone"],
  ["school_email", "学校电子邮箱", "email"],
];

const HOST_FIELDS: Array<[string, string, Kind]> = [
  ["host_surname", "邀请人姓", "latin"],
  ["host_given_names", "邀请人名", "latin"],
  ["host_address_line_1", "邀请人地址", "latin"],
  ["host_postcode", "邀请人地址邮编", "latin"],
  ["host_city", "邀请人所在城市", "latin"],
  ["host_phone", "邀请人电话", "phone"],
  ["host_email", "邀请人邮箱", "email"],
];

const ACCOMMODATION_FIELDS: Array<[string, string, Kind]> = [
  ["accommodation_name", "酒店或住处名称", "latin"],
  ["accommodation_address_line_1", "住宿地址", "latin"],
  ["accommodation_postcode", "住宿地址邮编", "latin"],
  ["accommodation_city", "住宿城市", "latin"],
  ["accommodation_phone", "住宿电话", "phone"],
  ["accommodation_email", "住宿邮箱", "email"],
];

function problemFor(value: string, kind: Kind): FranceAnswerProblem["reason"] | null {
  if (kind === "latin" && containsNonLatinText(value)) return "contains_non_latin";
  if (kind === "phone" && !PHONE_RE.test(value)) return "invalid_format";
  if (kind === "email" && !EMAIL_RE.test(value)) return "invalid_format";
  return null;
}

/**
 * Problems in the answers France-Visas would receive. Only values the
 * applicant entered are checked for script/format; the postcode of the chosen
 * accommodation block is also required, because the form never had one and
 * France-Visas does.
 */
export function validateFranceOfficialAnswers(
  answers: Record<string, string | null | undefined>,
): FranceAnswerProblem[] {
  const problems: FranceAnswerProblem[] = [];
  const text = (field: string) => answers[field]?.trim() ?? "";
  const checkFields = (fields: Array<[string, string, Kind]>) => {
    for (const [field, labelZh, kind] of fields) {
      const value = text(field);
      if (!value) continue;
      const reason = problemFor(value, kind);
      if (reason) problems.push({ field, labelZh, reason });
    }
  };

  checkFields(APPLICANT_FIELDS);
  if (text("is_student").toLowerCase() === "yes") {
    checkFields(SCHOOL_FIELDS);
    for (const [field, labelZh] of SCHOOL_FIELDS) {
      if (!text(field)) problems.push({ field, labelZh, reason: "missing" });
    }
  }
  // France-Visas step 1 needs the city of submission (TLScontact centre).
  if (!text("submission_centre") && !text("fv_deposit_town")) {
    problems.push({ field: "submission_centre", labelZh: "递交签证申请的城市", reason: "missing" });
  }

  const accommodationType = text("accommodation_type").toLowerCase();
  if (accommodationType === "private_host") {
    checkFields(HOST_FIELDS);
    if (!text("host_postcode")) problems.push({ field: "host_postcode", labelZh: "邀请人地址邮编", reason: "missing" });
  } else if (accommodationType === "hotel" || accommodationType === "rented") {
    checkFields(ACCOMMODATION_FIELDS);
    // France-Visas requires the establishment's postcode, phone and e-mail
    // (VIZA also uses the phone and e-mail for the reception contact).
    const required: Array<[string, string]> = [
      ["accommodation_postcode", "住宿地址邮编"],
      ["accommodation_phone", "住宿电话"],
      ["accommodation_email", "住宿电子邮箱"],
    ];
    for (const [field, labelZh] of required) {
      if (!text(field)) problems.push({ field, labelZh, reason: "missing" });
    }
  }
  return problems;
}

/** Chinese fix-it message for a 422 response. */
export function franceAnswerProblemsMessage(problems: FranceAnswerProblem[]): string {
  const nonLatin = problems.filter((problem) => problem.reason === "contains_non_latin");
  const invalid = problems.filter((problem) => problem.reason === "invalid_format");
  const missing = problems.filter((problem) => problem.reason === "missing");
  const parts: string[] = [];
  if (nonLatin.length) parts.push(`请用英文或拼音填写：${nonLatin.map((p) => p.labelZh).join("、")}`);
  if (invalid.length) parts.push(`格式不正确：${invalid.map((p) => p.labelZh).join("、")}`);
  if (missing.length) parts.push(`请补充：${missing.map((p) => p.labelZh).join("、")}`);
  return `${parts.join("；")}。France-Visas 官网只接受这些信息的英文（拉丁字母）版本。`;
}
