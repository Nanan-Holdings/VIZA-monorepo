import type { DocumentCenterData } from "@/app/client/documents/actions";
import {
  getRepeatInstanceCount,
  getRepeatInstanceValues,
  evaluateShowIf,
  isRequiredUnlessSatisfied,
  isRequiredWhenSatisfied,
} from "@/lib/form-utils";
import {
  getInvalidCanadaTrvFields,
  getMissingCanadaTrvExternalGates,
  isCanadaTrvApplication,
} from "@/lib/canada-trv-completion";
import { isDateFieldValueComplete } from "@/lib/date-field-validation";
import { isDs160FieldVisibleForRuntime } from "@/lib/ds160-age-gate";
import {
  FORMER_SPOUSE_COUNT_FIELD,
  FORMER_SPOUSE_REPEAT_GROUP,
  getFormerSpouseCountIssue,
} from "@/lib/former-spouse-count";
import { getUsContactRelationshipIssue } from "@/lib/us-contact-validation";
import { getDs160ImmediateRelativeRelationshipIssue } from "@/lib/ds160-family-validation";
import {
  DS160_TRIP_PURPOSE_FIELD,
  DS160_TRIP_PURPOSE_REPEAT_GROUP,
  getDs160TripPurposeDuplicateIssue,
} from "@/lib/ds160-travel-validation";
import {
  findDs160DuplicateNationalityFields,
  getDs160NationalityDuplicateMessageForField,
} from "@/lib/ds160-nationality-validation";
import { isLegacyCompatibilityOnlyField } from "@/lib/legacy-compatibility-fields";
import { getDs160OfficialOptionSource, resolveDs160OfficialOptionValue } from "@/lib/ds160-official-options";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

export interface ApplicationStepRef {
  id: number;
  name: string;
  sourceName?: string;
}

export interface MissingApplicationField {
  stepId: number;
  stepName: string;
  fieldName: string;
  label: string;
  labelZh?: string;
  reason: "required" | "invalid" | "external_gate" | "ceac_required";
}

export interface TabCompletionResult {
  completedStepIds: number[];
  missingFields: MissingApplicationField[];
}

interface ComputeAllTabCompletionInput {
  dbSteps: WizardStep[];
  effectiveSteps: ApplicationStepRef[];
  answers: Record<string, string>;
  documentCenterData: DocumentCenterData | null;
  documentsLoaded?: boolean;
  submittedAt?: string | null;
  submissionResultStatus?: string | null;
  country?: string | null;
  visaType?: string | null;
  applicationConsentPresent?: boolean;
  applicationSignaturePresent?: boolean;
  canadaPortalTermsConsentPresent?: boolean;
  documentStepId: number;
  reviewStepId: number;
  teamStepId: number;
  confirmationStepId: number;
  showDocumentStep?: boolean;
  showTeamStep: boolean;
  now?: Date;
}

const LT24_VALUES = new Set(["less_than_24_hours", "less than 24 hours", "h"]);
const TERMINAL_SUBMISSION_STATUSES = new Set([
  "submitted",
  "submitted_mock",
  "completed",
  "unsupported",
  "action_required",
  "needs_user_action",
  "stopped_at_pay",
  "stopped_at_review",
  "form_ready_for_agency",
  "failed",
  "timed_out",
]);
const READY_DOCUMENT_STATUSES = new Set([
  "uploaded",
  "pending_review",
  "approved",
  "accepted",
  "verified",
  "ready",
]);

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function hasValue(value: string | null | undefined): boolean {
  const v = text(value);
  return v.length > 0 && v !== "[]" && v !== "{}";
}

function isAcceptedCheckboxValue(value: string | null | undefined): boolean {
  return ["true", "yes", "1", "on"].includes(normalizeAnswer(value));
}

function normalizeAnswer(value: string | null | undefined): string {
  return text(value).toLowerCase();
}

function getChineseFieldLabel(field: VisaFormFieldRow): string | undefined {
  const labelZh = field.validationRules?.label_zh;
  return typeof labelZh === "string" && labelZh.trim() ? labelZh.trim() : undefined;
}

function isJapanVisitJapanWebApplication(
  country?: string | null,
  visaType?: string | null,
): boolean {
  const normalizedCountry = normalizeAnswer(country).replace(/[\s-]+/g, "_");
  const normalizedVisaType = normalizeAnswer(visaType).replace(/[\s-]+/g, "_");
  return (
    (normalizedCountry === "japan" || normalizedCountry === "jp") &&
    normalizedVisaType === "jp_visit_japan_web"
  );
}

const JP_VJW_MINIMUM_TEXT_LENGTHS = {
  residence_country: 2,
  accommodation_name: 2,
  accommodation_prefecture: 2,
  accommodation_city: 2,
  accommodation_address: 3,
} as const;

const JP_VJW_FLIGHT_NUMBER_PATTERN = /^\d{1,8}$/;

export function getApplicationFieldErrorMessage(
  field: MissingApplicationField,
  options: {
    country?: string | null;
    visaType?: string | null;
    isZh: boolean;
  },
): string {
  if (isJapanVisitJapanWebApplication(options.country, options.visaType)) {
    const japanMessages = options.isZh
      ? {
          residence_country: "请输入有效的居住国家或地区。",
          accommodation_name: "请输入完整的日本住宿名称（英文）。",
          accommodation_prefecture: "请选择日本住宿所在的都道府县。",
          accommodation_city: "请选择日本住宿所在的市区町村。",
          accommodation_address: "请输入完整的日本住宿町名、丁目和门牌号（英文），至少 3 个字符。",
          flight_number: "航班号仅填写 1–8 位数字（例如 SQ111 填写 111），并确认所选航空公司与实际航班一致。",
          planned_stay_days: "计划停留天数必须是 1 至 90 之间的整数。",
          accommodation_postal_code: "日本邮政编码应为 7 位数字，例如 100-0001。",
          accommodation_phone: "住宿电话必须为 10 至 15 位数字，不含加号、空格或连字符。",
        }
      : {
          residence_country: "Enter a valid country or region of residence.",
          accommodation_name: "Enter the full name of your accommodation in Japan in English.",
          accommodation_prefecture: "Select the prefecture of your accommodation in Japan.",
          accommodation_city: "Select the city, ward, town, or village of your accommodation in Japan.",
          accommodation_address: "Enter the complete town, block, and building number of your accommodation in Japan in English (at least 3 characters).",
          flight_number: "Enter only the 1–8 digit numeric part of the flight number (for SQ111, enter 111), and confirm the selected airline matches your flight.",
          planned_stay_days: "Planned stay must be a whole number from 1 to 90 days.",
          accommodation_postal_code: "Enter a seven-digit Japanese postal code, for example 100-0001.",
          accommodation_phone: "Accommodation telephone number must contain 10 to 15 digits without spaces or punctuation.",
        };
    const japanMessage = japanMessages[field.fieldName as keyof typeof japanMessages];
    if (japanMessage) return japanMessage;
  }

  if (field.fieldName === FORMER_SPOUSE_COUNT_FIELD && field.reason === "invalid") {
    return options.isZh
      ? "前任配偶人数必须与已填写的前任配偶信息条数一致，并使用官网提供的选项。"
      : "The number of former spouses must match the completed former-spouse entries and use an official option.";
  }

  if (field.fieldName === "us_contact_relationship" && field.reason === "invalid") {
    return options.isZh
      ? "美国联系人关系与姓名、机构或婚姻状况的组合不符合官网要求。"
      : "The U.S. contact relationship is not compatible with the selected name, organization, or marital-status branch.";
  }

  if (/^us_relative_relationship(?:__\d+)?$/u.test(field.fieldName) && field.reason === "invalid") {
    return options.isZh
      ? "选择“配偶”作为美国直系亲属关系时，婚姻状况必须为已婚或合法分居。"
      : "The immediate-relative Spouse relationship requires a marital status of Married or Legally Separated.";
  }

  if (
    /^purpose_of_trip(?:__\d+)?$/u.test(field.fieldName) &&
    field.reason === "invalid"
  ) {
    return options.isZh
      ? "赴美目的类别不能重复，请为每一项选择不同的类别。"
      : "Each Purpose of Trip to the U.S. category may be selected only once.";
  }

  if (
    field.reason === "invalid" &&
    /^(?:nationality_country|other_nationality_country|other_permanent_resident_country)(?:__\d+)?$/u.test(field.fieldName)
  ) {
    return getDs160NationalityDuplicateMessageForField(field.fieldName, options.isZh);
  }

  if (field.reason === "invalid") {
    const label = options.isZh ? field.labelZh ?? field.label : field.label;
    return options.isZh
      ? `请检查“${label}”的格式或内容。`
      : `Check the format or content of “${label}”.`;
  }
  const label = options.isZh ? field.labelZh ?? field.label : field.label;
  return options.isZh
    ? `请填写“${label}”。`
    : `Complete “${label}”.`;
}

function getInvalidJapanVisitJapanWebFields(
  dbSteps: WizardStep[],
  answers: Record<string, string>,
): Array<{ stepIndex: number; field: VisaFormFieldRow }> {
  const fields = dbSteps.flatMap((step, stepIndex) =>
    step.fields.map((field) => ({ stepIndex, field })),
  );
  return fields.filter(({ field }) => {
    const value = text(answers[field.fieldName]);
    if (!value) return false;

    if (field.fieldName === "flight_number") {
      return !JP_VJW_FLIGHT_NUMBER_PATTERN.test(value);
    }
    const minimum = JP_VJW_MINIMUM_TEXT_LENGTHS[
      field.fieldName as keyof typeof JP_VJW_MINIMUM_TEXT_LENGTHS
    ];
    if (minimum !== undefined && value.length < minimum) return true;

    const rules = field.validationRules as {
      integer?: unknown;
      min?: unknown;
      max?: unknown;
      minLength?: unknown;
      maxLength?: unknown;
      pattern?: unknown;
    } | null;
    if (typeof rules?.minLength === "number" && value.length < rules.minLength) return true;
    if (typeof rules?.maxLength === "number" && value.length > rules.maxLength) return true;
    if (typeof rules?.pattern === "string") {
      try {
        if (!new RegExp(rules.pattern).test(value)) return true;
      } catch {
        // A malformed schema pattern must not make the client crash. The
        // submission API and runner remain the final fail-closed boundary.
      }
    }

    if (field.fieldType === "number") {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) return true;
      if (rules?.integer === true && !Number.isInteger(numberValue)) return true;
      if (typeof rules?.min === "number" && numberValue < rules.min) return true;
      if (typeof rules?.max === "number" && numberValue > rules.max) return true;
    }

    if (field.fieldType === "date") {
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
      if (!isoMatch) return true;
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) return true;
    }

    if (field.fieldType === "select" && field.options?.length) {
      return !field.options.some((candidate) => {
        const optionValue = typeof candidate === "string" ? candidate : candidate.value;
        return optionValue === value;
      });
    }

    return false;
  });
}

function withDerivedTdacTransitAnswer(
  answers: Record<string, string>,
  visaType?: string | null,
): Record<string, string> {
  if (normalizeAnswer(visaType) !== "th_tdac_arrival_card") return answers;
  const arrivalDate = text(answers.arrival_date);
  const departureDate = text(answers.departure_date);
  if (!arrivalDate || !departureDate) return answers;
  return {
    ...answers,
    is_transit_traveler: arrivalDate === departureDate ? "yes" : "",
  };
}

export function isUsDs160(country?: string | null, visaType?: string | null): boolean {
  const normalizedCountry = normalizeAnswer(country).replace(/[\s-]+/g, "_");
  const normalizedVisa = normalizeAnswer(visaType).replace(/[\s-]+/g, "_");
  return (
    normalizedCountry === "us" ||
    normalizedCountry === "usa" ||
    normalizedCountry === "united_states" ||
    normalizedVisa === "ds160" ||
    normalizedVisa === "b1_b2" ||
    normalizedVisa === "us_b1_b2"
  );
}

function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeat_group?: string } | null;
  return typeof rules?.repeat_group === "string" ? rules.repeat_group : null;
}

function instanceKey(fieldName: string, index: number): string {
  return index === 0 ? fieldName : `${fieldName}__${index + 1}`;
}

function requiredExpectedAnswer(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as {
    must_equal?: unknown;
    mustEqual?: unknown;
  } | null;
  const expected = rules?.must_equal ?? rules?.mustEqual;
  return typeof expected === "string" && expected.trim()
    ? expected.trim().toLowerCase()
    : null;
}

function ruleRequiresAcceptance(field: VisaFormFieldRow): boolean {
  const rules = field.validationRules as { mustBeTrue?: unknown } | null;
  return rules?.mustBeTrue === true || requiredExpectedAnswer(field) !== null;
}

const HISTORICAL_DATE_CONTEXT = /(^|_)(birth|born|issue|issued|previous|prior|history|historical|past|last_visit)(_|$)/;
const TRAVEL_ARRIVAL_DATE_CONTEXT = /(^|_)(arrival|entry)(_|$)/;

/**
 * Returns true only for dates that describe the upcoming trip's arrival or
 * entry. Schemas can opt out with `allow_past_date`; otherwise canonical
 * arrival aliases are recognized across country packages. Historical travel,
 * birth, and document-issue dates are deliberately excluded.
 */
export function isUpcomingTravelDateField(field: VisaFormFieldRow): boolean {
  if (field.fieldType !== "date") return false;
  const rules = field.validationRules as {
    min_date?: unknown;
    not_before_today?: unknown;
    allow_past_date?: unknown;
    official_key?: unknown;
    date_role?: unknown;
  } | null;
  if (rules?.allow_past_date === true) return false;
  if (rules?.min_date === "today" || rules?.not_before_today === true) return true;
  if (rules?.date_role === "arrival" || rules?.date_role === "entry") return true;

  const fieldName = field.fieldName.trim().toLowerCase();
  const officialKey = typeof rules?.official_key === "string"
    ? rules.official_key.trim().toLowerCase()
    : "";
  if (HISTORICAL_DATE_CONTEXT.test(fieldName)) return false;
  return TRAVEL_ARRIVAL_DATE_CONTEXT.test(fieldName) ||
    officialKey === "arrival_date" ||
    officialKey === "entry_date";
}

function isoCalendarDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function isPastUpcomingTravelDate(
  field: VisaFormFieldRow,
  value: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const normalized = text(value);
  return isUpcomingTravelDateField(field) &&
    /^\d{4}-\d{2}-\d{2}$/.test(normalized) &&
    normalized < isoCalendarDate(now);
}

export function isVisibleDynamicFieldRequired(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  fields: VisaFormFieldRow[],
): boolean {
  if (isLegacyCompatibilityOnlyField(field)) return false;
  if (isRequiredUnlessSatisfied(field, values)) return false;
  if (!field.required && !isRequiredWhenSatisfied(field, values) && !ruleRequiresAcceptance(field)) return false;
  return evaluateShowIf(field, values, fields);
}

function getAtLeastOneOf(field: VisaFormFieldRow): string[] {
  const value = field.validationRules?.at_least_one_of;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeOptionKey(value: string | null | undefined): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function isAllowedChoiceValue(
  field: VisaFormFieldRow,
  value: string | null | undefined,
  values: Record<string, string>,
  repeatIndex = 0,
): boolean {
  if (!hasValue(value)) return false;
  const officialSource = getDs160OfficialOptionSource(field);
  const choiceValue = officialSource ? resolveDs160OfficialOptionValue(officialSource, value!) : value;
  const rules = field.validationRules as {
    dependent_on?: unknown;
    depends_on?: unknown;
    dependsOn?: unknown;
    dependent_options?: unknown;
  } | null;
  const parentFieldName = [rules?.dependent_on, rules?.depends_on, rules?.dependsOn]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  if (parentFieldName && rules?.dependent_options && typeof rules.dependent_options === "object") {
    const dependentOptions = rules.dependent_options as Record<string, VisaFormFieldRow["options"]>;
    const parentValue = values[instanceKey(parentFieldName, repeatIndex)] ?? values[parentFieldName];
    if (!hasValue(parentValue)) return false;
    const allowedOptions = dependentOptions[parentValue] ?? dependentOptions[normalizeOptionKey(parentValue)];
    if (!Array.isArray(allowedOptions)) return false;
    return allowedOptions.some((option) => (
      typeof option === "string" ? option : option.value
    ) === choiceValue);
  }
  if (
    !field.options?.length ||
    field.validationRules?.remote_search === true ||
    typeof field.validationRules?.official_options_source === "string" ||
    typeof field.validationRules?.dynamic_option_source === "string" ||
    !["select", "radio", "country"].includes(field.fieldType)
  ) return true;
  return field.options.some((option) => (
    typeof option === "string" ? option : option.value
  ) === choiceValue);
}

function isFieldComplete(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  now: Date = new Date(),
  valueKey = field.fieldName,
  repeatIndex = 0,
): boolean {
  if (field.fieldType === "checkbox" && (field.required || ruleRequiresAcceptance(field))) {
    return isAcceptedCheckboxValue(values[valueKey]);
  }
  const expected = requiredExpectedAnswer(field);
  if (expected !== null) return normalizeAnswer(values[valueKey]) === expected;
  const value = text(values[valueKey]);
  if (!hasValue(value)) return false;
  if (!isDateFieldValueComplete(field, value)) return false;
  if (isPastUpcomingTravelDate(field, value, now)) return false;
  return isAllowedChoiceValue(field, value, values, repeatIndex);
}

function missingForDynamicStep(
  step: WizardStep,
  stepId: number,
  stepName: string,
  answers: Record<string, string>,
  visaType?: string | null,
  now: Date = new Date(),
) {
  const missing: MissingApplicationField[] = [];
  for (const field of step.fields) {
    if (isLegacyCompatibilityOnlyField(field)) continue;
    if (!isDs160FieldVisibleForRuntime(field, step, visaType, answers, now)) continue;
    const group = getRepeatGroup(field);
    if (group) {
      const count = getRepeatInstanceCount(field, answers, step.fields);
      for (let index = 0; index < count; index += 1) {
        const valueKey = instanceKey(field.fieldName, index);
        const instanceValues = getRepeatInstanceValues(field, index, answers, step.fields);
        if (!isVisibleDynamicFieldRequired(field, instanceValues, step.fields)) continue;
        if (isFieldComplete(field, instanceValues, now, valueKey, index)) continue;
        missing.push({
          stepId,
          stepName,
          fieldName: valueKey,
          label: `${field.label || field.fieldName}${index > 0 ? ` #${index + 1}` : ""}`,
          labelZh: getChineseFieldLabel(field),
          reason: hasValue(instanceValues[valueKey]) ? "invalid" : "required",
        });
      }
      continue;
    }
    if (!isVisibleDynamicFieldRequired(field, answers, step.fields)) continue;
    if (isFieldComplete(field, answers, now)) continue;
    missing.push({
      stepId,
      stepName,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: hasValue(answers[field.fieldName]) ? "invalid" : "required",
    });
  }

  // CEAC asks for the declared former-spouse count separately from the
  // repeated rows. Keep the cross-field contract in the same completion list
  // used by progress, assistant validation, and final review.
  const formerSpouseCountField = step.fields.find(
    (field) => field.fieldName === FORMER_SPOUSE_COUNT_FIELD,
  );
  const hasFormerSpouseRows = step.fields.some(
    (field) => getRepeatGroup(field) === FORMER_SPOUSE_REPEAT_GROUP,
  );
  if (
    formerSpouseCountField &&
    hasFormerSpouseRows &&
    isDs160FieldVisibleForRuntime(formerSpouseCountField, step, visaType, answers, now) &&
    evaluateShowIf(formerSpouseCountField, answers, step.fields)
  ) {
    const countIssue = getFormerSpouseCountIssue(answers);
    if (countIssue && !missing.some((field) => field.fieldName === FORMER_SPOUSE_COUNT_FIELD)) {
      missing.push({
        stepId,
        stepName,
        fieldName: FORMER_SPOUSE_COUNT_FIELD,
        label: formerSpouseCountField.label || FORMER_SPOUSE_COUNT_FIELD,
        labelZh: getChineseFieldLabel(formerSpouseCountField),
        reason: countIssue.kind === "required" ? "required" : "invalid",
      });
    }
  }

  const usContactRelationshipField = step.fields.find(
    (field) => field.fieldName === "us_contact_relationship",
  );
  if (
    usContactRelationshipField &&
    isDs160FieldVisibleForRuntime(usContactRelationshipField, step, visaType, answers, now) &&
    evaluateShowIf(usContactRelationshipField, answers, step.fields)
  ) {
    const relationshipIssue = getUsContactRelationshipIssue(answers);
    if (
      relationshipIssue &&
      !missing.some((field) => field.fieldName === "us_contact_relationship")
    ) {
      missing.push({
        stepId,
        stepName,
        fieldName: "us_contact_relationship",
        label: usContactRelationshipField.label || "U.S. Contact — Relationship",
        labelZh: getChineseFieldLabel(usContactRelationshipField),
        reason: "invalid",
      });
    }
  }

  const immediateRelativeRelationshipField = step.fields.find(
    (field) => field.fieldName === "us_relative_relationship",
  );
  if (
    immediateRelativeRelationshipField &&
    immediateRelativeRelationshipField.visaType === "DS160" &&
    isDs160FieldVisibleForRuntime(immediateRelativeRelationshipField, step, visaType, answers, now) &&
    evaluateShowIf(immediateRelativeRelationshipField, answers, step.fields)
  ) {
    const count = getRepeatInstanceCount(immediateRelativeRelationshipField, answers, step.fields);
    for (let index = 0; index < count; index += 1) {
      const valueKey = instanceKey(immediateRelativeRelationshipField.fieldName, index);
      const instanceValues = getRepeatInstanceValues(immediateRelativeRelationshipField, index, answers, step.fields);
      if (!evaluateShowIf(immediateRelativeRelationshipField, instanceValues, step.fields)) continue;
      const relationshipIssue = getDs160ImmediateRelativeRelationshipIssue(instanceValues, valueKey);
      if (
        relationshipIssue &&
        !missing.some((field) => field.fieldName === valueKey)
      ) {
        missing.push({
          stepId,
          stepName,
          fieldName: valueKey,
          label: `${immediateRelativeRelationshipField.label || "Relationship to You"}${index > 0 ? ` #${index + 1}` : ""}`,
          labelZh: getChineseFieldLabel(immediateRelativeRelationshipField),
          reason: "invalid",
        });
      }
    }
  }

  const tripPurposeField = step.fields.find(
    (field) =>
      field.fieldName === DS160_TRIP_PURPOSE_FIELD &&
      getRepeatGroup(field) === DS160_TRIP_PURPOSE_REPEAT_GROUP,
  );
  if (
    tripPurposeField &&
    isDs160FieldVisibleForRuntime(tripPurposeField, step, visaType, answers, now) &&
    evaluateShowIf(tripPurposeField, answers, step.fields)
  ) {
    const count = getRepeatInstanceCount(tripPurposeField, answers, step.fields);
    for (let index = 0; index < count; index += 1) {
      const valueKey = instanceKey(tripPurposeField.fieldName, index);
      const duplicateIssue = getDs160TripPurposeDuplicateIssue(answers, valueKey);
      if (!duplicateIssue || missing.some((field) => field.fieldName === valueKey)) continue;
      missing.push({
        stepId,
        stepName,
        fieldName: valueKey,
        label: `${tripPurposeField.label || DS160_TRIP_PURPOSE_FIELD}${index > 0 ? ` #${index + 1}` : ""}`,
        labelZh: getChineseFieldLabel(tripPurposeField),
        reason: "invalid",
      });
    }
  }

  // CEAC rejects a country repeated across the primary nationality, active
  // other-nationality rows, and active permanent-resident rows. Add the
  // duplicate controls to the same missing list used by progress and review.
  for (const duplicateFieldName of findDs160DuplicateNationalityFields(answers)) {
    const baseFieldName = duplicateFieldName.replace(/__\d+$/u, "");
    const duplicateField = step.fields.find((field) => field.fieldName === baseFieldName);
    if (!duplicateField || duplicateField.visaType !== "DS160") continue;
    if (!isDs160FieldVisibleForRuntime(duplicateField, step, visaType, answers, now)) continue;
    const repeatIndex = Number(duplicateFieldName.match(/__(\d+)$/u)?.[1] ?? "1") - 1;
    const scopedValues = getRepeatInstanceValues(duplicateField, repeatIndex, answers, step.fields);
    if (!evaluateShowIf(duplicateField, scopedValues, step.fields)) continue;
    if (missing.some((field) => field.fieldName === duplicateFieldName)) continue;
    missing.push({
      stepId,
      stepName,
      fieldName: duplicateFieldName,
      label: `${duplicateField.label || baseFieldName}${repeatIndex > 0 ? ` #${repeatIndex + 1}` : ""}`,
      labelZh: getChineseFieldLabel(duplicateField),
      reason: "invalid",
    });
  }

  // Some official forms express an OR requirement as a group of individually
  // optional fields. Treat the visible group as required at final review too;
  // otherwise the inline validator and the submit validator disagree.
  const visitedGroups = new Set<string>();
  for (const field of step.fields) {
    const group = getAtLeastOneOf(field);
    if (group.length === 0 || !evaluateShowIf(field, answers, step.fields)) continue;
    const groupKey = [...group].sort().join("|");
    if (visitedGroups.has(groupKey)) continue;
    visitedGroups.add(groupKey);
    const visibleMembers = group
      .map((fieldName) => step.fields.find((candidate) => candidate.fieldName === fieldName))
      .filter((candidate): candidate is VisaFormFieldRow => Boolean(candidate))
      .filter((candidate) => !isLegacyCompatibilityOnlyField(candidate))
      .filter((candidate) => isDs160FieldVisibleForRuntime(candidate, step, visaType, answers, now))
      .filter((candidate) => evaluateShowIf(candidate, answers, step.fields));
    if (visibleMembers.length === 0 || group.some((fieldName) => hasValue(answers[fieldName]))) continue;
    const first = visibleMembers[0];
    missing.push({
      stepId,
      stepName,
      fieldName: first.fieldName,
      label: first.label || first.fieldName,
      labelZh: getChineseFieldLabel(first),
      reason: "required",
    });
  }

  return missing;
}

/**
 * Deterministic, UI-independent missing-field calculation used by both the
 * application wizard and the form-filling assistant. Conditional and
 * required-unless rules are evaluated against the complete answer snapshot.
 */
export function getMissingDynamicFormFields(
  dbSteps: WizardStep[],
  answers: Record<string, string>,
  options: { country?: string | null; visaType?: string | null; now?: Date } = {},
): MissingApplicationField[] {
  const inferredVisaType = options.visaType ?? dbSteps
    .flatMap((step) => step.fields)
    .find((field) => field.visaType)?.visaType;
  const missing = dbSteps.flatMap((step, index) =>
    missingForDynamicStep(step, index, step.stepName, answers, inferredVisaType, options.now),
  );
  if (isCanadaTrvApplication(options.country, options.visaType)) {
    missing.push(...getInvalidCanadaTrvFields(dbSteps, answers).map(({ stepIndex, field }) => ({
      stepId: stepIndex,
      stepName: dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: "invalid" as const,
    })));
  }
  if (isJapanVisitJapanWebApplication(options.country, options.visaType)) {
    missing.push(...getInvalidJapanVisitJapanWebFields(dbSteps, answers).map(({ stepIndex, field }) => ({
      stepId: stepIndex,
      stepName: dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
      fieldName: field.fieldName,
      label: field.label || field.fieldName,
      labelZh: getChineseFieldLabel(field),
      reason: "invalid" as const,
    })));
  }
  return missing;
}

function pushMissing(
  output: MissingApplicationField[],
  fieldByName: Map<string, { field: VisaFormFieldRow; step: WizardStep; stepId: number }>,
  fallbackStepId: number,
  fallbackStepName: string,
  fieldName: string,
  label: string,
) {
  const match = fieldByName.get(fieldName);
  output.push({
    stepId: match?.stepId ?? fallbackStepId,
    stepName: match?.step.stepName ?? fallbackStepName,
    fieldName,
    label: match?.field.label ?? label,
    reason: "ceac_required",
  });
}

export function getDs160CeacMissingFields(
  dbSteps: WizardStep[],
  stepIdsByIndex: number[],
  answers: Record<string, string>,
): MissingApplicationField[] {
  const fieldByName = new Map<string, { field: VisaFormFieldRow; step: WizardStep; stepId: number }>();
  dbSteps.forEach((step, index) => {
    const stepId = stepIdsByIndex[index] ?? index;
    for (const field of step.fields) fieldByName.set(field.fieldName, { field, step, stepId });
  });

  const travelStep = dbSteps.find((step) => /travel information/i.test(step.stepName)) ?? dbSteps[2];
  const travelStepId = travelStep ? (stepIdsByIndex[dbSteps.indexOf(travelStep)] ?? 2) : 2;
  const travelStepName = travelStep?.stepName ?? "Travel Information";
  const missing: MissingApplicationField[] = [];
  const specificPlans = normalizeAnswer(answers.has_specific_travel_plans || answers.has_specific_plans);

  if ((specificPlans === "no" || specificPlans === "n") && !hasValue(answers.intended_arrival_date)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_arrival_date", "Intended Date of Arrival in U.S.");
  }

  const stayUnit = normalizeAnswer(answers.intended_length_of_stay_unit);
  if ((specificPlans === "no" || specificPlans === "n") && !hasValue(answers.intended_length_of_stay_unit)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_length_of_stay_unit", "Intended Length of Stay in U.S. (Unit)");
  }

  if (
    (specificPlans === "no" || specificPlans === "n") &&
    !LT24_VALUES.has(stayUnit) &&
    !hasValue(answers.intended_length_of_stay_value) &&
    !hasValue(answers.intended_length_of_stay)
  ) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "intended_length_of_stay_value", "Intended Length of Stay in U.S. (Value)");
  }

  if ((specificPlans === "yes" || specificPlans === "y") && !hasValue(answers.arrival_date)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "arrival_date", "Date of Arrival in U.S.");
  }

  if (normalizeAnswer(answers.purpose_of_trip) === "b" && !hasValue(answers.purpose_of_trip_specify)) {
    pushMissing(missing, fieldByName, travelStepId, travelStepName, "purpose_of_trip_specify", "Specify");
  }

  return missing;
}

export function getRequiredDocumentProgress(data: DocumentCenterData | null): {
  completed: number;
  total: number;
} {
  // A visible document step whose checklist has not loaded is still an
  // unresolved readiness gate. Count one pending item so the application can
  // never briefly or permanently claim 100% while document readiness is
  // unknown.
  if (!data) return { completed: 0, total: 1 };
  const required = data.requirements.filter((requirement) => requirement.required);
  const missingKeys = new Set(getMissingRequiredDocumentRequirementKeys(data));
  const completed = required.filter((requirement) => !missingKeys.has(requirement.key)).length;
  return { completed, total: required.length };
}

export function getMissingRequiredDocumentRequirementKeys(
  data: DocumentCenterData | null,
): string[] {
  if (!data) return [];
  return data.requirements
    .filter((requirement) => requirement.required)
    .filter((requirement) => !data.documents.some((document) => {
      const matchesRequirement =
        document.requirementKey === requirement.key ||
        document.documentType === requirement.documentType;
      if (!matchesRequirement) return false;
      return READY_DOCUMENT_STATUSES.has(normalizeAnswer(document.status));
    }))
    .map((requirement) => requirement.key);
}

function documentsComplete(data: DocumentCenterData | null): boolean {
  const progress = getRequiredDocumentProgress(data);
  return progress.completed === progress.total;
}

function findStepName(steps: ApplicationStepRef[], stepId: number, fallback: string): string {
  return steps.find((step) => step.id === stepId)?.name ?? fallback;
}

export function getContiguousCompletedCount(steps: ApplicationStepRef[], completedStepIds: Iterable<number>): number {
  const completed = new Set(completedStepIds);
  let count = 0;
  for (const step of steps) {
    if (!completed.has(step.id)) break;
    count += 1;
  }
  return count;
}

export function computeAllTabCompletion(input: ComputeAllTabCompletionInput): TabCompletionResult {
  const completed = new Set<number>();
  const missingFields: MissingApplicationField[] = [];
  const dynamicStepIds = input.dbSteps.map((_, index) => index);
  const showDocumentStep = input.showDocumentStep ?? true;
  const documentsLoaded = input.documentsLoaded ?? true;
  const documentStepComplete = !showDocumentStep || documentsComplete(input.documentCenterData);
  const completionAnswers = withDerivedTdacTransitAnswer(input.answers, input.visaType);

  input.dbSteps.forEach((step, index) => {
    const stepId = dynamicStepIds[index] ?? index;
    const stepName = input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ?? step.stepName;
    const missing = missingForDynamicStep(step, stepId, stepName, completionAnswers, input.visaType, input.now);
    missingFields.push(...missing);
    if (missing.length === 0) completed.add(stepId);
  });

  if (isCanadaTrvApplication(input.country, input.visaType)) {
    const invalidFields = getInvalidCanadaTrvFields(input.dbSteps, completionAnswers)
      .map(({ stepIndex, field }) => {
        const stepId = dynamicStepIds[stepIndex] ?? stepIndex;
        return {
          stepId,
          stepName: input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ??
            input.dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
          fieldName: field.fieldName,
          label: field.label || field.fieldName,
          labelZh: getChineseFieldLabel(field),
          reason: "invalid" as const,
        };
      });
    missingFields.push(...invalidFields);
    for (const item of invalidFields) completed.delete(item.stepId);

    const gateLabels = {
      canada_application_consent: "Application consent",
      canada_application_signature: "Application signature",
      canada_ircc_portal_terms_consent: "IRCC Portal terms authorization",
    } as const;
    missingFields.push(...getMissingCanadaTrvExternalGates({
      applicationConsentPresent: input.applicationConsentPresent,
      applicationSignaturePresent: input.applicationSignaturePresent,
      portalTermsConsentPresent: input.canadaPortalTermsConsentPresent,
    }).map((fieldName) => ({
      stepId: input.reviewStepId,
      stepName: findStepName(input.effectiveSteps, input.reviewStepId, "Review Application"),
      fieldName,
      label: gateLabels[fieldName],
      reason: "external_gate" as const,
    })));
  }

  if (isJapanVisitJapanWebApplication(input.country, input.visaType)) {
    const invalidFields = getInvalidJapanVisitJapanWebFields(input.dbSteps, completionAnswers)
      .map(({ stepIndex, field }) => {
        const stepId = dynamicStepIds[stepIndex] ?? stepIndex;
        return {
          stepId,
          stepName: input.effectiveSteps.find((candidate) => candidate.id === stepId)?.name ??
            input.dbSteps[stepIndex]?.stepName ?? `Step ${stepIndex + 1}`,
          fieldName: field.fieldName,
          label: field.label || field.fieldName,
          labelZh: getChineseFieldLabel(field),
          reason: "invalid" as const,
        };
      });
    missingFields.push(...invalidFields);
    for (const item of invalidFields) completed.delete(item.stepId);
  }

  const ds160Missing = isUsDs160(input.country, input.visaType)
    ? getDs160CeacMissingFields(input.dbSteps, dynamicStepIds, completionAnswers)
    : [];
  missingFields.push(...ds160Missing);
  for (const item of ds160Missing) completed.delete(item.stepId);

  if (showDocumentStep) {
    if (documentStepComplete) {
      completed.add(input.documentStepId);
    } else if (documentsLoaded) {
      missingFields.push({
        stepId: input.documentStepId,
        stepName: findStepName(input.effectiveSteps, input.documentStepId, "Supporting Documents"),
        fieldName: "supporting_documents",
        label: "Required supporting documents",
        reason: "required",
      });
    }
  }
  const priorStepsReady = missingFields.length === 0 && documentStepComplete;
  if (input.dbSteps.length > 0 && priorStepsReady) completed.add(input.reviewStepId);
  if (input.showTeamStep && priorStepsReady) completed.add(input.teamStepId);
  if (input.submittedAt || TERMINAL_SUBMISSION_STATUSES.has(input.submissionResultStatus ?? "")) {
    completed.add(input.confirmationStepId);
  }

  const dedupedMissing = Array.from(
    missingFields
      .reduce((acc, item) => acc.set(`${item.stepId}:${item.fieldName}`, item), new Map<string, MissingApplicationField>())
      .values(),
  );

  return {
    completedStepIds: Array.from(completed).sort((a, b) => a - b),
    missingFields: dedupedMissing,
  };
}
