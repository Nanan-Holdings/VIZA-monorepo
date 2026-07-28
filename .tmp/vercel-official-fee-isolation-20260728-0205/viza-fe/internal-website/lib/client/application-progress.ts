import type { ApplicationPaymentRecord } from "@/app/actions/application-lifecycle";
import {
  getFormVisaType,
  getVisaDestinationKey,
} from "@/lib/visa-destinations";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

// ---------------------------------------------------------------------------
// Row shapes shared by the home dashboard and the destinations switch page
// ---------------------------------------------------------------------------

export interface ApplicationRow {
  id: string;
  status: string;
  country: string;
  visa_type: string;
  visa_package_id: string | null;
  submission_result_status: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AnswerRow {
  application_id: string;
  field_name: string;
  value_text: string | null;
  updated_at: string | null;
}

export type FormFieldSchemaMap = Map<string, VisaFormFieldRow[]>;

export type PaymentRow = ApplicationPaymentRecord;

export interface DestinationApplicationProgress {
  applicationId: string;
  status: string;
  percent: number;
  label: string;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

const FORM_COMPLETE_STATUSES = new Set([
  "payment_pending",
  "submitted",
  "submitted_to_government",
  "biometrics_pending",
  "approved",
  "rejected",
  "delivered",
  "staff_action_required",
]);

const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "success", "complete", "completed"]);

const TERMINAL_PROGRESS_STATUSES = new Set([
  "submitted",
  "submitted_to_government",
  "biometrics_pending",
  "approved",
  "delivered",
]);

const NEAR_COMPLETE_STATUSES = new Set([
  "payment_pending",
  "staff_action_required",
]);

const SUBMISSION_IN_FLIGHT_STATUSES = new Set([
  "waiting",
  "processing",
  "ready",
  "succeeded",
  "success",
]);

export function getProgressLabel(
  status: string,
  percent: number,
  isZh: boolean,
  submissionResultStatus?: string | null,
): string {
  const normalizedResultStatus = submissionResultStatus?.toLowerCase() ?? "";
  if (["waiting", "processing"].includes(normalizedResultStatus)) {
    return isZh ? "正在提交" : "Submitting";
  }
  if (status === "approved") return isZh ? "已批准" : "Approved";
  if (status === "submitted") return isZh ? "已提交" : "Submitted";
  if (status === "rejected") return isZh ? "需要处理" : "Needs attention";
  if (percent >= 70) return isZh ? "接近完成" : "Almost complete";
  if (percent >= 30) return isZh ? "填写中" : "In progress";
  return isZh ? "已开始" : "Started";
}

// ---------------------------------------------------------------------------
// Next-step routing
// ---------------------------------------------------------------------------

export function buildApplicationHref(application: ApplicationRow): string {
  const params = new URLSearchParams({
    country: application.country,
    visaType: application.visa_type,
  });
  return `/client/application?${params.toString()}`;
}

export function buildCheckoutHref(application: ApplicationRow): string {
  const params = new URLSearchParams();
  if (application.visa_package_id) params.set("packageId", application.visa_package_id);
  params.set("applicationId", application.id);
  return `/client/checkout?${params.toString()}`;
}

export function buildStatusHref(application: ApplicationRow): string {
  const params = new URLSearchParams({ applicationId: application.id });
  return `/client/status?${params.toString()}`;
}

export function isFormComplete(application: ApplicationRow): boolean {
  return Boolean(application.submitted_at) || FORM_COMPLETE_STATUSES.has(application.status.toLowerCase());
}

export function isPaymentComplete(application: ApplicationRow, payments: PaymentRow[]): boolean {
  return payments.some((payment) => {
    const matchesApplication = payment.application_id === application.id;
    const matchesPackage = Boolean(application.visa_package_id && payment.visa_package_id === application.visa_package_id);
    return (matchesApplication || matchesPackage) && PAID_PAYMENT_STATUSES.has(payment.status.toLowerCase());
  });
}

export function getNextApplicationHref(application: ApplicationRow, payments: PaymentRow[]): string {
  if (!isFormComplete(application)) return buildApplicationHref(application);
  if (application.country === "south_korea" && application.visa_type === "KR_C39_SHORT_TERM_VISIT") {
    return buildApplicationHref(application);
  }
  if (!isPaymentComplete(application, payments)) return buildCheckoutHref(application);
  return buildStatusHref(application);
}

// ---------------------------------------------------------------------------
// Progress computation
// ---------------------------------------------------------------------------

function hasCompletedAnswer(answer: AnswerRow): boolean {
  const value = answer.value_text;
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized === "[]" || normalized === "{}" || normalized === "null") return false;
  return true;
}

function buildAnswerValues(answers: AnswerRow[]): Record<string, string> {
  return answers.reduce<Record<string, string>>((values, answer) => {
    if (hasCompletedAnswer(answer)) values[answer.field_name] = answer.value_text!.trim();
    return values;
  }, {});
}

function getFormCompletionPercent(
  fields: VisaFormFieldRow[] | undefined,
  answers: AnswerRow[],
): number {
  const answerValues = buildAnswerValues(answers);
  const answeredNames = new Set(Object.keys(answerValues));

  if (!fields || fields.length === 0) {
    const answeredFieldCount = answeredNames.size;
    if (answeredFieldCount === 0) return 0;
    return Math.min(100, Math.round((answeredFieldCount / 25) * 100));
  }

  const visibleFields = fields.filter((field) => evaluateShowIf(field, answerValues, fields));
  const requiredFields = visibleFields.filter(
    (field) => field.required && !isRequiredUnlessSatisfied(field, answerValues),
  );
  const fieldsToMeasure = requiredFields.length > 0 ? requiredFields : visibleFields;
  if (fieldsToMeasure.length === 0) return answeredNames.size > 0 ? 100 : 0;

  const completedCount = fieldsToMeasure.filter((field) => answeredNames.has(field.fieldName)).length;
  const fieldCompletionPercent = Math.round((completedCount / fieldsToMeasure.length) * 100);
  const visibleStepNumbers = new Set(visibleFields.map((field) => field.stepNumber));
  const answeredStepNumbers = new Set(
    visibleFields
      .filter((field) => answeredNames.has(field.fieldName))
      .map((field) => field.stepNumber),
  );
  const stepCoveragePercent =
    visibleStepNumbers.size > 0
      ? Math.round((answeredStepNumbers.size / visibleStepNumbers.size) * 100)
      : 0;

  return Math.max(fieldCompletionPercent, stepCoveragePercent);
}

function getApplicationProgressPercent(
  application: ApplicationRow,
  appDocs: DocumentRow[],
  appAnswers: AnswerRow[],
  fields: VisaFormFieldRow[] | undefined,
): number {
  const normalizedStatus = application.status.toLowerCase();
  const normalizedSubmissionResultStatus = application.submission_result_status?.toLowerCase() ?? "";
  if (
    application.submitted_at ||
    TERMINAL_PROGRESS_STATUSES.has(normalizedStatus) ||
    SUBMISSION_IN_FLIGHT_STATUSES.has(normalizedSubmissionResultStatus)
  ) {
    return 100;
  }
  if (normalizedStatus === "rejected") return 85;
  if (NEAR_COMPLETE_STATUSES.has(normalizedStatus)) return 95;

  const formPercent = getFormCompletionPercent(fields, appAnswers);
  const uploadedDocumentCount = appDocs.filter((document) => document.status !== "missing").length;
  const documentPercent = Math.min(100, uploadedDocumentCount * 25);
  const startedBase = appAnswers.length > 0 || appDocs.length > 0 ? 5 : 0;
  const percent = startedBase + formPercent * 0.8 + documentPercent * 0.15;

  return Math.min(95, Math.max(startedBase > 0 ? 10 : 0, Math.round(percent)));
}

export function buildApplicationProgress(
  applications: ApplicationRow[],
  documents: DocumentRow[],
  answers: AnswerRow[],
  fieldSchemas: FormFieldSchemaMap,
  isZh: boolean,
): Record<string, DestinationApplicationProgress> {
  const docsByApplication = new Map<string, DocumentRow[]>();
  const answersByApplication = new Map<string, AnswerRow[]>();

  for (const document of documents) {
    const existing = docsByApplication.get(document.application_id) ?? [];
    existing.push(document);
    docsByApplication.set(document.application_id, existing);
  }

  for (const answer of answers) {
    if (!hasCompletedAnswer(answer)) continue;
    const existing = answersByApplication.get(answer.application_id) ?? [];
    existing.push(answer);
    answersByApplication.set(answer.application_id, existing);
  }

  return applications.reduce<Record<string, DestinationApplicationProgress>>((progress, application) => {
    const appAnswers = answersByApplication.get(application.id) ?? [];
    const appDocs = docsByApplication.get(application.id) ?? [];
    const fields = fieldSchemas.get(getFormVisaType(application.visa_type).toLowerCase());
    const percent = getApplicationProgressPercent(application, appDocs, appAnswers, fields);
    const updatedAt = application.updated_at ?? application.submitted_at ?? application.created_at;
    const destinationKey = getVisaDestinationKey(application.country, application.visa_type);
    const existing = progress[destinationKey];
    const existingUpdatedAt = existing?.updatedAt ? Date.parse(existing.updatedAt) : 0;
    const candidateUpdatedAt = updatedAt ? Date.parse(updatedAt) : 0;
    if (
      existing &&
      (existing.percent > percent ||
        (existing.percent === percent && existingUpdatedAt >= candidateUpdatedAt))
    ) {
      return progress;
    }

    progress[destinationKey] = {
      applicationId: application.id,
      status: application.status,
      percent,
      label: getProgressLabel(application.status, percent, isZh, application.submission_result_status),
      updatedAt,
    };
    return progress;
  }, {});
}
