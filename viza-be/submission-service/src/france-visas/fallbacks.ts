import type { FvApplicationAnswers } from "./field-mappings";

export interface FranceFieldFallback {
  step: "step2" | "step5";
  field: string;
  reason: "missing" | "contains_non_latin" | "invalid_format";
  originalPreview: string | null;
  fallbackValue: string;
  vizaRuleSuggestion: string;
}

export interface SanitizedFranceAnswers {
  answers: FvApplicationAnswers;
  fieldFallbacks: FranceFieldFallback[];
}

const NON_LATIN_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9\s().-]{5,24}$/;

function cloneAnswers(answers: FvApplicationAnswers): FvApplicationAnswers {
  return {
    step1: { ...answers.step1 },
    step2: { ...answers.step2 },
    step3: { ...answers.step3 },
    step4: { ...answers.step4 },
    step5: {
      ...answers.step5,
      autoFundings: answers.step5.autoFundings?.slice(),
    },
  };
}

function preview(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 32 ? `${trimmed.slice(0, 32)}...` : trimmed;
}

function invalidReason(
  value: string | undefined,
  options: { latinOnly?: boolean; email?: boolean; phone?: boolean } = {},
): FranceFieldFallback["reason"] | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "missing";
  if (options.latinOnly && NON_LATIN_RE.test(trimmed)) return "contains_non_latin";
  if (options.email && !EMAIL_RE.test(trimmed)) return "invalid_format";
  if (options.phone && !PHONE_RE.test(trimmed)) return "invalid_format";
  return null;
}

function applyFallback<T extends object, K extends Extract<keyof T, string>>(
  target: T,
  field: K,
  fallbackValue: string,
  options: {
    step: FranceFieldFallback["step"];
    latinOnly?: boolean;
    email?: boolean;
    phone?: boolean;
    suggestion: string;
  },
  events: FranceFieldFallback[],
): void {
  const original = target[field] as string | undefined;
  const reason = invalidReason(original, options);
  if (!reason) return;
  target[field] = fallbackValue as T[K];
  events.push({
    step: options.step,
    field,
    reason,
    originalPreview: preview(original),
    fallbackValue,
    vizaRuleSuggestion: options.suggestion,
  });
}

/**
 * France-Visas silently rejects some free-text values after a JSF postback,
 * especially CJK text in official Latin-script fields. This prepares an
 * official-portal-only answer copy with conservative defaults and records the
 * exact constraints VIZA should later enforce in its own form schema.
 */
export function sanitizeFranceAnswersForOfficialPortal(
  answers: FvApplicationAnswers,
): SanitizedFranceAnswers {
  const next = cloneAnswers(answers);
  const fieldFallbacks: FranceFieldFallback[] = [];

  applyFallback(next.step2, "placeOfBirth", "BEIJING", {
    step: "step2",
    latinOnly: true,
    suggestion: "Require Latin letters for France-Visas place of birth; collect an English/pinyin city name.",
  }, fieldFallbacks);
  applyFallback(next.step2, "street", "NOT APPLICABLE", {
    step: "step2",
    latinOnly: true,
    suggestion: "Require Latin letters/numbers for France-Visas residential street address.",
  }, fieldFallbacks);
  applyFallback(next.step2, "place", "BEIJING", {
    step: "step2",
    latinOnly: true,
    suggestion: "Require Latin letters for France-Visas residential city/place.",
  }, fieldFallbacks);
  applyFallback(next.step2, "phoneNumber", "13800000000", {
    step: "step2",
    phone: true,
    suggestion: "Require a phone number with digits, optional leading plus, and 6-25 characters.",
  }, fieldFallbacks);
  applyFallback(next.step2, "email", "applicant@example.com", {
    step: "step2",
    email: true,
    suggestion: "Require a valid email address before France-Visas submission.",
  }, fieldFallbacks);

  if (next.step2.occupation === "65005") {
    applyFallback(next.step2, "occupationOtherSpecify", "OTHER", {
      step: "step2",
      latinOnly: true,
      suggestion: "When France-Visas occupation is Other, require a Latin description for 'If other, please specify'.",
    }, fieldFallbacks);
    applyFallback(next.step2, "businessSegment", "OTH", {
      step: "step2",
      suggestion: "When France-Visas occupation opens job details, require a sector; map Other occupation to sector 'Other activities'.",
    }, fieldFallbacks);
    applyFallback(next.step2, "employerName", "NOT APPLICABLE", {
      step: "step2",
      latinOnly: true,
      suggestion: "Require employer or teaching establishment name when France-Visas shows the job details subsection.",
    }, fieldFallbacks);
    applyFallback(next.step2, "employerStreet", "NOT APPLICABLE", {
      step: "step2",
      latinOnly: true,
      suggestion: "Require employer/school address in Latin script when France-Visas shows the job details subsection.",
    }, fieldFallbacks);
    applyFallback(next.step2, "employerPlace", "BEIJING", {
      step: "step2",
      latinOnly: true,
      suggestion: "Require employer/school city in Latin script when France-Visas shows the job details subsection.",
    }, fieldFallbacks);
    if (!next.step2.employerCountry) {
      next.step2.employerCountry = next.step2.country || "CHN";
      fieldFallbacks.push({
        step: "step2",
        field: "employerCountry",
        reason: "missing",
        originalPreview: null,
        fallbackValue: next.step2.employerCountry,
        vizaRuleSuggestion: "Require employer/school country when France-Visas shows the job details subsection.",
      });
    }
    applyFallback(next.step2, "employerPhone", next.step2.phoneNumber || "13800000000", {
      step: "step2",
      phone: true,
      suggestion: "Require employer/school phone or email when France-Visas shows the job details subsection.",
    }, fieldFallbacks);
    applyFallback(next.step2, "employerEmail", next.step2.email || "applicant@example.com", {
      step: "step2",
      email: true,
      suggestion: "Require employer/school email or phone when France-Visas shows the job details subsection.",
    }, fieldFallbacks);
  }

  if (next.step5.cbxHasHostPerson) {
    if (!next.step5.hostPersonCountry) {
      next.step5.hostPersonCountry = "FRA";
      fieldFallbacks.push({
        step: "step5",
        field: "hostPersonCountry",
        reason: "missing",
        originalPreview: null,
        fallbackValue: "FRA",
        vizaRuleSuggestion: "Require accommodation country for France-Visas host/place details.",
      });
    }
    applyFallback(next.step5, "hostPersonSurname", "HOTEL", {
      step: "step5",
      latinOnly: true,
      suggestion: "Require Latin hotel/host name for France-Visas accommodation details.",
    }, fieldFallbacks);
    applyFallback(next.step5, "hostPersonAddress", "HOTEL ADDRESS", {
      step: "step5",
      latinOnly: true,
      suggestion: "Require Latin accommodation address for France-Visas.",
    }, fieldFallbacks);
    applyFallback(next.step5, "hostPersonZipcode", "75001", {
      step: "step5",
      suggestion: "Require accommodation postal code when host/person accommodation is selected.",
    }, fieldFallbacks);
    applyFallback(next.step5, "hostPersonPlace", "PARIS", {
      step: "step5",
      latinOnly: true,
      suggestion: "Require Latin accommodation city/place for France-Visas.",
    }, fieldFallbacks);
    applyFallback(next.step5, "hostPersonPhone", "33123456789", {
      step: "step5",
      phone: true,
      suggestion: "Require accommodation phone with digits, optional leading plus, and 6-25 characters.",
    }, fieldFallbacks);
    applyFallback(next.step5, "hostPersonEmail", "booking@example.com", {
      step: "step5",
      email: true,
      suggestion: "Require a valid accommodation contact email when provided/required.",
    }, fieldFallbacks);
  }

  return { answers: next, fieldFallbacks };
}
