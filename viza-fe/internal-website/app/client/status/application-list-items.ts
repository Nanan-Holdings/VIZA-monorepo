import {
  getPopularVisaDestinationByPackage,
} from "@/lib/visa-destinations";
import { isOngoingApplicationState } from "@/lib/client/active-application-selection";
import { isDs160VisaType } from "@/lib/submission-queue";
import type {
  ApplicationListItem,
  ApplicationListRecord,
  ApplicationListTone,
} from "./applications-list";
import type {
  ClientStatusState,
  StatusApplication,
} from "./status-data";

type StatusTranslation = (key: string) => string;

const UNITED_STATES_COUNTRIES = new Set([
  "US",
  "USA",
  "UNITED_STATES",
  "UNITED_STATES_OF_AMERICA",
]);

const HIDDEN_INTERVIEW_STATES = new Set([
  "cancelled",
  "canceled",
  "archived",
  "deleted",
]);

export const APPLICATION_LIST_TONE: Record<ClientStatusState, ApplicationListTone> = {
  not_started: "brand",
  needs_payment: "alert",
  needs_consent: "warn",
  in_progress: "brand",
  needs_documents: "warn",
  packet_pending: "brand",
  external_pending: "brand",
  submitted: "brand",
  needs_attention: "warn",
  approved: "success",
  rejected: "alert",
};

export function normalizeCountryParam(value: string | null): string | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim().toLowerCase();
  if (!decoded) return null;
  const aliases: Record<string, string> = {
    malaysia: "马来西亚",
    my: "马来西亚",
    马来西亚: "马来西亚",
    thailand: "泰国",
    th: "泰国",
    泰国: "泰国",
    singapore: "新加坡",
    sg: "新加坡",
    新加坡: "新加坡",
  };
  return aliases[decoded] ?? decoded;
}

function statusLabel(state: ClientStatusState, t: StatusTranslation): string {
  return t(`states.${state}`);
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isUnitedStatesCountry(value: string): boolean {
  return UNITED_STATES_COUNTRIES.has(normalizeToken(value));
}

function interviewPracticeAction(record: {
  applicationId: string | null;
  country: string;
  visaType: string;
  state: ClientStatusState;
}, application: StatusApplication, isZh: boolean): ApplicationListRecord["secondaryAction"] {
  if (!record.applicationId) return null;
  if (!isUnitedStatesCountry(record.country)) return null;
  if (!isDs160VisaType(record.visaType)) return null;
  if (HIDDEN_INTERVIEW_STATES.has(normalizeToken(record.state).toLowerCase())) return null;
  if (HIDDEN_INTERVIEW_STATES.has(normalizeToken(application.rawApplicationStatus).toLowerCase())) return null;
  return {
    href: `/client/interview-practice?applicationId=${encodeURIComponent(record.applicationId)}`,
    label: isZh ? "模拟面试" : "Mock interview",
  };
}

export function toApplicationListItem(
  application: StatusApplication,
  locale: string,
  t: StatusTranslation
): ApplicationListItem {
  const isZh = locale.startsWith("zh");
  const catalogueDestination = getPopularVisaDestinationByPackage(
    application.country,
    application.visaType
  );
  const records: ApplicationListRecord[] = application.applicationRecords.map(
    (record) => ({
      selectionKey: record.id,
      applicationId: record.applicationId,
      packageId: record.packageId,
      visaLabel: isZh ? record.visaTypeLabelZh : record.visaTypeLabel,
      stateLabel: statusLabel(record.state, t),
      tone: APPLICATION_LIST_TONE[record.state],
      progressPercent: record.progressPercent,
      country: record.country,
      visaType: record.visaType,
      continueHref: record.continueHref,
      detailHref: record.detailHref,
      ongoing: isOngoingApplicationState(record.state),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submittedAt: record.submittedAt,
      secondaryAction: interviewPracticeAction(record, application, isZh),
    })
  );
  const primaryRecord =
    records.find((record) => record.ongoing) ?? records[0] ?? null;

  return {
    key: application.key,
    countryKey: application.countryKey,
    flag: application.countryFlag,
    countryLabel: isZh ? application.countryNameZh : application.countryName,
    visaLabel:
      primaryRecord?.visaLabel ??
      (isZh ? application.visaTypeLabelZh : application.visaTypeLabel),
    stateLabel: primaryRecord?.stateLabel ?? statusLabel(application.state, t),
    tone: primaryRecord?.tone ?? APPLICATION_LIST_TONE[application.state],
    progressPercent:
      primaryRecord?.progressPercent ?? application.progressPercent,
    continueHref: primaryRecord?.continueHref ?? "/client/application",
    country: application.country,
    visaType: application.visaType,
    destinationId: catalogueDestination?.id ?? null,
    records,
  };
}
