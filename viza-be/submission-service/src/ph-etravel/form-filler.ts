import type { Locator, Page } from "@playwright/test";
import type { PhEtravelCurrencyParty, PhEtravelPortalPayload } from "./normalize";
import {
  buildPhEtravelAttachmentActionContract,
  normalizePhEtravelCurrencyOwnerBranch,
} from "./attachment-owner-contract";
import {
  loadPhEtravelSeaPortFlowMetadata,
  PH_ETRAVEL_OFFICIAL_COMMON_API,
  type PhEtravelSeaPortFlowResolution,
  verifyPhEtravelSeaPortFlowPage,
} from "./sea-port-flow";
import {
  classifyPhEtravelPostSignatureSemantic,
  guardPhEtravelPostSignatureWizardStep,
  resolvePhEtravelWizardRoute,
  type PhEtravelPostSignatureEvidencePath,
  type PhEtravelPostSignatureSemantic,
} from "./wizard-semantics";
import { buildPhEtravelProfileOwnedActionPlan } from "./profile-owned-preflight";
import {
  buildPhEtravelInitialRegistrationPlan,
  PhEtravelInitialRegistrationError,
  type PhEtravelInitialRegistrationChoice,
} from "./registration-start";

export type PhEtravelFieldKind = "text" | "date" | "choice" | "checkbox";

export interface PhEtravelFieldPlanItem {
  key: string;
  portalName?: string;
  portalValue?: string | null;
  labels: string[];
  kind: PhEtravelFieldKind;
  value: string | boolean | null;
  required?: boolean;
  repeatable?: boolean;
  minimumItems?: number;
}

export const PH_ETRAVEL_HEALTH_STATIC_WARNING =
  "As of July 22, 2023, No Covid-19 test or Vaccination requirement when traveling to the Philippines.";

export const PH_ETRAVEL_HEALTH_SYMPTOM_LABELS = [
  "Altered Mental Status",
  "Colds",
  "Cough",
  "Diarrhea",
  "Difficulty of Breathing",
  "Dizziness",
  "Fever",
  "Headache",
  "Loss of appetite",
  "Loss of smell",
  "Loss of taste",
  "Muscle Pain",
  "Nausea",
  "Rashes, vesicles or blisters",
  "Sore throat",
] as const;

export interface PhEtravelFormFillResult {
  reachedReview: boolean;
  submitted: boolean;
  portalText: string;
  filledFields: string[];
}

export class PhEtravelFormFillError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly portalSummary: string,
  ) {
    super(message);
    this.name = "PhEtravelFormFillError";
  }
}

export function isPhEtravelPublicLandingText(portalText: string): boolean {
  const hasPublicLandingMarker = /click here to sign in|download egovph app/i.test(portalText);
  const hasAuthenticatedMarker =
    /new travel declaration|travel history|view\/manage|\blogout\b/i.test(portalText);
  return hasPublicLandingMarker && !hasAuthenticatedMarker;
}

export function isPhEtravelConfirmationText(portalText: string): boolean {
  const hasReference = /reference\s*(?:no|number)/i.test(portalText);
  const hasQrOrClearance = /qr\s*code|qrcode|immigration officer|customs officer for clearance/i.test(portalText);
  const hasCompletionCopy =
    /registration\s+(?:successful|completed)|successfully\s+registered|thank\s+you\s+for\s+registering|kindly present your passport/i.test(portalText);
  return hasReference && hasQrOrClearance && hasCompletionCopy;
}

export function isPhEtravelReviewSummaryText(portalText: string): boolean {
  return !isPhEtravelPublicLandingText(portalText) &&
    /new travel declaration summary|kindly double check the information before submitting|travel declaration summary/i.test(portalText);
}

export type PhEtravelSeaCustomsPageKind =
  | "manual_forms_notice"
  | "electronic_customs_confirmation"
  | "electronic_other_travel_details"
  | "electronic_signature_required"
  | "family_gate"
  | "family_no_companion_confirmation"
  | "review_summary"
  | "unknown";

export function isPhEtravelSignaturePageText(portalText: string): boolean {
  return !isPhEtravelReviewSummaryText(portalText) &&
    /customs declaration attachments and signature|for customs\s*-\s*declaration signature|declaration signature/i.test(portalText) &&
    /\bsignature\b/i.test(portalText) &&
    /\bclear\b/i.test(portalText) &&
    /by clicking\s+["']?next["']?.*true and correct/i.test(portalText);
}

export function classifyPhEtravelSeaCustomsPage(portalText: string): PhEtravelSeaCustomsPageKind {
  if (isPhEtravelReviewSummaryText(portalText)) return "review_summary";
  if (isPhEtravelSignaturePageText(portalText)) return "electronic_signature_required";
  if (/haven't selected any family members|not traveling with a companion|traveling with a companion/i.test(portalText)) {
    return "family_no_companion_confirmation";
  }
  if (/family member\(s\)|add family member|travel declarations will also be generated for the selected family members|no record found/i.test(portalText)) {
    return "family_gate";
  }
  if (/customs declaration confirmation/i.test(portalText) && /baggage|currency|declare/i.test(portalText) && /\b(?:yes|no)\b/i.test(portalText)) {
    return "electronic_customs_confirmation";
  }
  if (/other travel details|accompanied family members|no\.\s*of baggage|first time visiting philippines/i.test(portalText)) {
    return "electronic_other_travel_details";
  }
  if (/manual forms|baggage\/currency forms|baggage declaration|currencies declaration|download/i.test(portalText) && /customs|currency/i.test(portalText)) {
    return "manual_forms_notice";
  }
  return "unknown";
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function optionLabel(value: string | null): string | null {
  if (!value) return null;
  const aliases: Record<string, string> = {
    FOR_ME: "For me",
    FOR_OTHER: "For other",
    AIR: "Air",
    SEA: "Sea",
    ARRIVAL: "Arrival",
    DEPARTURE: "Departure",
    MALE: "Male",
    FEMALE: "Female",
    HOLIDAY: "Holiday/Pleasure/Vacation",
    BUSINESS: "Business / Professional",
    VISIT_FRIENDS_RELATIVES: "Visit Friends / Relatives",
    RETURNING_RESIDENT: "Returning Resident",
    TRADE_FAIR_EXHIBITION: "Trade Fair / Exhibition",
    HOTEL_RESORT: "Hotel/Resort",
    TRANSIT_VIA_AIRPORT: "Transit Via Airport",
    PHILIPPINE_AIRLINES: "Philippine Airlines",
    CEBU_PACIFIC: "Cebu Pacific",
    SINGAPORE_AIRLINES: "Singapore Airlines",
    STUDENT_MINOR: "Student/Minor",
    PROFESSIONAL_TECHNICAL_ADMIN: "Professional/Technical/Administrative",
    AIRCRAFT_PASSENGER: "Aircraft Passenger",
    FLIGHT_CREW: "Flight Crew",
    VESSEL_PASSENGER: "Vessel Passenger",
    FILIPINO: "Philippine Passport Holder",
    FOREIGNER: "Foreign Passport Holder",
    IS_PHYSICALLY_TRANSFERRED_BY_PERSON: "Physically transferred by person",
    IS_SHIPPED_THRU_COURIER_SERVICE: "Shipped through courier service",
  };
  return aliases[value.toUpperCase()] ?? value.replace(/_/g, " ");
}

function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? "Yes" : "No";
}

export type PhEtravelPreReviewGate =
  | "signature_required"
  | "family_companion_confirmation";

export function classifyPhEtravelPreReviewGate(portalText: string): PhEtravelPreReviewGate | null {
  if (
    isPhEtravelSignaturePageText(portalText) ||
    (
      /signature/i.test(portalText) &&
      (/please make sure to fill out all required fields/i.test(portalText) || /declaration\s+signature\s+required/i.test(portalText))
    )
  ) {
    return "signature_required";
  }
  if (/haven't selected any family members|not traveling with a companion|traveling with a companion/i.test(portalText)) {
    return "family_companion_confirmation";
  }
  return null;
}

export type PhEtravelElectronicCustomsAutofillPhaseKey =
  | "customs_confirmation"
  | "general_declaration_checklist"
  | "goods_item_modal_table"
  | "currency_owner_recipient"
  | "currency_item_modal_table"
  | "currency_source_purpose_checkboxes"
  | "currency_transfer_branch"
  | "attachments_signature";

export interface PhEtravelElectronicCustomsAutofillPhase {
  key: PhEtravelElectronicCustomsAutofillPhaseKey;
  fieldKeys: string[];
  selectors: string[];
  selectorEvidence: "official_key_only" | "selector_plan_ready" | "live_selector_missing";
  automationStatus: "ready" | "selector_plan_ready" | "action_required";
  validationEvidence?: string[];
  blockingGaps?: string[];
  blockedReason?: string;
}

export type PhEtravelElectronicCustomsActionKind =
  | "set_choice"
  | "fill_text"
  | "open_modal"
  | "add_modal_row";

/**
 * A pure, auditable description of an observed AIR customs/currency action.
 * It deliberately has no browser operation capable of advancing to Review or
 * final Submit. A future executor must still reject plans with blockers.
 */
export interface PhEtravelElectronicCustomsAction {
  phase: PhEtravelElectronicCustomsAutofillPhaseKey;
  kind: PhEtravelElectronicCustomsActionKind;
  selector: string;
  value?: string | boolean;
}

export interface PhEtravelElectronicCustomsActionPlan {
  branch: "AIR" | "SEA" | "not_applicable";
  actions: PhEtravelElectronicCustomsAction[];
  blockingCodes: string[];
  actionRequired: boolean;
}

const PH_ETRAVEL_CURRENCY_SOURCE_SELECTORS: Record<string, string> = {
  SALARY: "input[name='currency_sources.0'][value='SALARY']",
  BUSINESS: "input[name='currency_sources.1'][value='BUSINESS']",
  OTHER: "input[name='currency_sources.2'][value='OTHER']",
};

const PH_ETRAVEL_CURRENCY_PURPOSE_SELECTORS: Record<string, string> = {
  LEISURE: "input[name='transport_purposes.0'][value='LEISURE']",
  MEDICAL: "input[name='transport_purposes.1'][value='MEDICAL']",
  PAYABLES: "input[name='transport_purposes.2'][value='PAYABLES']",
  EDUCATION: "input[name='transport_purposes.3'][value='EDUCATION']",
  OTHER: "input[name='transport_purposes.4'][value='OTHER']",
};

const PH_ETRAVEL_CURRENCY_PARTY_FIELDS: Array<keyof PhEtravelCurrencyParty> = [
  "businessName",
  "firstName",
  "middleName",
  "lastName",
  "suffix",
  "occupationOrBusinessActivity",
  "country",
  "address",
  "postalCode",
];

const PH_ETRAVEL_CURRENCY_PARTY_SELECTOR_NAMES: Record<keyof PhEtravelCurrencyParty, string> = {
  businessName: "business_name",
  firstName: "first_name",
  middleName: "middle_name",
  lastName: "last_name",
  suffix: "suffix_name",
  occupationOrBusinessActivity: "occupation",
  country: "country_code",
  address: "street",
  postalCode: "postal_code",
};

function hasPositiveGeneralDeclaration(payload: PhEtravelPortalPayload): boolean {
  return (payload.customs.generalDeclarationResponses ?? []).some((item) => item.response === true);
}

function hasGoodsItemModalBranch(payload: PhEtravelPortalPayload): boolean {
  return (payload.customs.goodsItems ?? []).length > 0 ||
    (payload.customs.generalDeclarationResponses ?? []).some((item) => item.itemNumber === 12 && item.response === true);
}

function hasCurrencyDeclarationBranch(payload: PhEtravelPortalPayload): boolean {
  return payload.customs.hasCurrencyToDeclare ||
    payload.customs.hasCurrencyOverThreshold ||
    (payload.customs.currencyItems ?? []).length > 0;
}

function hasElectronicCustomsSignals(payload: PhEtravelPortalPayload): boolean {
  return payload.customs.hasBaggageOrCurrencyToDeclare ||
    payload.customs.generalDeclarationResponses.length > 0 ||
    payload.customs.goodsItems.length > 0 ||
    payload.customs.hasGoodsToDeclare ||
    payload.customs.hasCurrencyToDeclare ||
    payload.customs.hasDutiableGoods ||
    payload.customs.hasCurrencyOverThreshold ||
    payload.customs.currencyItems.length > 0;
}

function hasPositiveElectronicCustomsDeclaration(payload: PhEtravelPortalPayload): boolean {
  return hasPositiveGeneralDeclaration(payload) ||
    payload.customs.goodsItems.length > 0 ||
    payload.customs.hasGoodsToDeclare ||
    hasCurrencyDeclarationBranch(payload);
}

function phEtravelPostSignatureEvidencePath(input: {
  payload: PhEtravelPortalPayload;
  seaPortFlow: PhEtravelSeaPortFlowResolution | null;
}): PhEtravelPostSignatureEvidencePath {
  const isSeaArrival = input.payload.travelType === "ARRIVAL" &&
    (input.payload.transportType === "SEA" || input.payload.arrivalBranch?.transportType === "SEA");
  if (!isSeaArrival || !input.seaPortFlow) return "unverified";
  // E24 limits metadata to a dynamic page-array gate. It cannot select an
  // electronic evidence path before the rendered route and page content agree.
  return "unverified";
}

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes)];
}

function hasTextValue(value: string | null): value is string {
  return Boolean(value?.trim());
}

function completeChecklistResponses(payload: PhEtravelPortalPayload): boolean {
  const itemNumbers = payload.customs.generalDeclarationResponses.map((item) => item.itemNumber);
  return itemNumbers.length === 12 && new Set(itemNumbers).size === 12 &&
    itemNumbers.every((itemNumber) => itemNumber >= 1 && itemNumber <= 12);
}

function currencyPartyActions(
  phase: "currency_owner_recipient",
  prefix: "owner" | "recipient",
  party: PhEtravelCurrencyParty | null,
): PhEtravelElectronicCustomsAction[] {
  if (!party) return [];
  return PH_ETRAVEL_CURRENCY_PARTY_FIELDS.flatMap((field) => {
    const value = party[field];
    if (!hasTextValue(value)) return [];
    const selectorName = PH_ETRAVEL_CURRENCY_PARTY_SELECTOR_NAMES[field];
    return [{ phase, kind: "fill_text" as const, selector: `[name='${prefix}_${selectorName}']`, value }];
  });
}

/**
 * Compiles only the controls that AIR E7 and SEA E10 both observed through
 * Currency Declaration. It has no browser side effects; transport-specific
 * wrappers below establish whether this shared selector set is applicable.
 */
function buildPhEtravelElectronicPositiveCustomsActionPlan(
  payload: PhEtravelPortalPayload,
  branch: "AIR" | "SEA",
): PhEtravelElectronicCustomsActionPlan {
  const actions: PhEtravelElectronicCustomsAction[] = [{
    phase: "customs_confirmation",
    kind: "set_choice",
    selector: "button:has-text('Yes')",
    value: true,
  }];
  const blockingCodes: string[] = [
    branch === "AIR"
      ? "customs_positive_autofill_not_enabled"
      : "sea_electronic_positive_post_signature_evidence_pending",
  ];
  const checklist = [...payload.customs.generalDeclarationResponses]
    .sort((left, right) => left.itemNumber - right.itemNumber);

  if (!completeChecklistResponses(payload)) {
    blockingCodes.push("customs_checklist_requires_all_12_responses");
  } else {
    for (const item of checklist) {
      actions.push({
        phase: "general_declaration_checklist",
        kind: "set_choice",
        selector: `input[name='check_lists.${item.itemNumber - 1}.response'][value='${item.response}']`,
        value: item.response,
      });
    }
  }

  const otherGoodsSelected = checklist.some((item) => item.itemNumber === 12 && item.response);
  if (otherGoodsSelected || payload.customs.goodsItems.length > 0) {
    if (!hasTextValue(payload.customs.amountOfGoodsCurrency) || !hasTextValue(payload.customs.amountOfGoodsAmount)) {
      blockingCodes.push("customs_goods_amount_incomplete");
    } else {
      actions.push(
        {
          phase: "goods_item_modal_table",
          kind: "set_choice",
          selector: "[name='amount_of_goods_acquired.currency']",
          value: payload.customs.amountOfGoodsCurrency,
        },
        {
          phase: "goods_item_modal_table",
          kind: "fill_text",
          selector: "input[name='amount_of_goods_acquired.amount']",
          value: payload.customs.amountOfGoodsAmount,
        },
      );
    }
    if (otherGoodsSelected && payload.customs.goodsItems.length === 0) {
      blockingCodes.push("customs_other_goods_item_required");
    }
    for (const item of payload.customs.goodsItems) {
      actions.push(
        { phase: "goods_item_modal_table", kind: "open_modal", selector: "button:has-text('Add Item')" },
        { phase: "goods_item_modal_table", kind: "fill_text", selector: "textarea[name='description']", value: item.description },
        { phase: "goods_item_modal_table", kind: "fill_text", selector: "input[name='quantity']", value: item.quantity },
        { phase: "goods_item_modal_table", kind: "fill_text", selector: "input[name='amount']", value: item.amountUsd },
        { phase: "goods_item_modal_table", kind: "add_modal_row", selector: "button:has-text('Add')" },
      );
    }
    if (otherGoodsSelected) blockingCodes.push("other_goods_no_row_page_level_blocking_unverified");
  }

  if (hasCurrencyDeclarationBranch(payload)) {
    const ownerBranch = normalizePhEtravelCurrencyOwnerBranch({
      ownerNotApplicable: payload.customs.currencyOwnerNotApplicable,
      owner: payload.customs.currencyOwner,
      recipient: payload.customs.currencyRecipient,
    });
    actions.push(...currencyPartyActions("currency_owner_recipient", "owner", ownerBranch.owner));
    actions.push(...currencyPartyActions("currency_owner_recipient", "recipient", ownerBranch.recipient));
    blockingCodes.push(...ownerBranch.blockingCodes);

    if (payload.customs.currencyItems.length === 0) {
      blockingCodes.push("customs_currency_item_required");
    }
    for (const item of payload.customs.currencyItems) {
      actions.push(
        { phase: "currency_item_modal_table", kind: "open_modal", selector: "button:has-text('Add Item')" },
        { phase: "currency_item_modal_table", kind: "set_choice", selector: "[name='currency_id']", value: item.currency },
        { phase: "currency_item_modal_table", kind: "set_choice", selector: "[name='monetary_instrument_id']", value: item.monetaryInstrument },
        { phase: "currency_item_modal_table", kind: "fill_text", selector: "input[name='amount']", value: item.amount },
        { phase: "currency_item_modal_table", kind: "add_modal_row", selector: "button:has-text('Add')" },
      );
    }
    blockingCodes.push("complete_currency_and_monetary_instrument_option_lists_unverified");

    if (payload.customs.currencySources.length === 0) blockingCodes.push("customs_currency_source_required");
    for (const source of payload.customs.currencySources) {
      const selector = PH_ETRAVEL_CURRENCY_SOURCE_SELECTORS[source];
      if (!selector) {
        blockingCodes.push("customs_currency_source_option_unverified");
      } else {
        actions.push({ phase: "currency_source_purpose_checkboxes", kind: "set_choice", selector, value: true });
      }
    }
    if (payload.customs.currencySources.includes("OTHER")) {
      if (!hasTextValue(payload.customs.currencySourceOther)) {
        blockingCodes.push("customs_currency_source_other_required");
      } else {
        actions.push({ phase: "currency_source_purpose_checkboxes", kind: "fill_text", selector: "input[name='currency_source_other']", value: payload.customs.currencySourceOther });
      }
    }

    if (payload.customs.currencyTransportPurposes.length === 0) blockingCodes.push("customs_currency_purpose_required");
    for (const purpose of payload.customs.currencyTransportPurposes) {
      const selector = PH_ETRAVEL_CURRENCY_PURPOSE_SELECTORS[purpose];
      if (!selector) {
        blockingCodes.push("customs_currency_purpose_option_unverified");
      } else {
        actions.push({ phase: "currency_source_purpose_checkboxes", kind: "set_choice", selector, value: true });
      }
    }
    if (payload.customs.currencyTransportPurposes.includes("OTHER")) {
      if (!hasTextValue(payload.customs.currencyTransportPurposeOther)) {
        blockingCodes.push("customs_currency_purpose_other_required");
      } else {
        actions.push({ phase: "currency_source_purpose_checkboxes", kind: "fill_text", selector: "input[name='transport_purpose_other']", value: payload.customs.currencyTransportPurposeOther });
      }
    }

    if (!payload.customs.currencyTransportMethod) {
      blockingCodes.push("customs_currency_transfer_method_required");
    } else if (payload.customs.currencyTransportMethod === "is_shipped_thru_courier_service") {
      actions.push({
        phase: "currency_transfer_branch",
        kind: "set_choice",
        selector: "input[name='physical_or_shipped'][value='is_shipped_thru_courier_service']",
        value: true,
      });
      const courierFields: Array<[string, string | null]> = [
        ["courier_name", payload.customs.courierName],
        ["airway_bill_no", payload.customs.airwayBillNumber],
        ["airway_bill_date", payload.customs.airwayBillDate],
      ];
      for (const [field, value] of courierFields) {
        if (!hasTextValue(value)) blockingCodes.push(`customs_${field}_required`);
        else actions.push({ phase: "currency_transfer_branch", kind: "fill_text", selector: `input[name='${field}']`, value });
      }
    } else {
      actions.push({
        phase: "currency_transfer_branch",
        kind: "set_choice",
        selector: "input[name='physical_or_shipped'][value='is_physically_transferred_by_person']",
        value: true,
      });
      if (hasTextValue(payload.customs.noOfDaysInPhilippines)) {
        actions.push({ phase: "currency_transfer_branch", kind: "fill_text", selector: "input[name='no_of_days_in_philippines']", value: payload.customs.noOfDaysInPhilippines });
      } else if (branch === "SEA") {
        blockingCodes.push("sea_electronic_positive_no_of_days_in_philippines_required");
      }
      if (hasTextValue(payload.customs.lastTravelToPhilippines)) {
        actions.push({ phase: "currency_transfer_branch", kind: "fill_text", selector: "input[name='last_travel_to_philippines']", value: payload.customs.lastTravelToPhilippines });
      } else if (branch === "SEA") {
        blockingCodes.push("sea_electronic_positive_last_travel_to_philippines_required");
      }
      if (branch === "AIR") {
        blockingCodes.push("physical_branch_empty_requiredness_unverified");
      }
    }
    if (hasTextValue(payload.customs.bspAuthorizationDate)) {
      actions.push({ phase: "currency_transfer_branch", kind: "fill_text", selector: "input[name='bsp_authorization_date']", value: payload.customs.bspAuthorizationDate });
    }
  }

  if (branch === "AIR" && (payload.customs.customsSignatureDeclaration || payload.customs.customsSignatureFile)) {
    blockingCodes.push(...buildPhEtravelAttachmentActionContract(undefined).blockingCodes);
  }

  return { branch, actions, blockingCodes: uniqueCodes(blockingCodes), actionRequired: true };
}

/**
 * Builds only the evidence-backed AIR positive customs/currency actions. It is
 * intentionally pure so tests and a later executor can audit exactly what
 * would be attempted. Unknown option lists and requiredness remain blockers.
 */
export function buildPhEtravelAirPositiveCustomsActionPlan(
  payload: PhEtravelPortalPayload,
): PhEtravelElectronicCustomsActionPlan {
  if (!hasElectronicCustomsSignals(payload) || !hasPositiveElectronicCustomsDeclaration(payload)) {
    return { branch: "not_applicable", actions: [], blockingCodes: [], actionRequired: false };
  }
  if (payload.travelType !== "ARRIVAL") {
    return {
      branch: "not_applicable",
      actions: [],
      blockingCodes: ["ph_etravel_arrival_customs_action_plan_only"],
      actionRequired: true,
    };
  }
  if (payload.transportType === "SEA" || payload.arrivalBranch?.transportType === "SEA") {
    return {
      branch: "SEA",
      actions: [],
      blockingCodes: ["sea_electronic_positive_post_signature_evidence_pending"],
      actionRequired: true,
    };
  }
  return buildPhEtravelElectronicPositiveCustomsActionPlan(payload, "AIR");
}

export type PhEtravelSeaCustomsActionPlanContext =
  | {
      variant: "manual";
      metadataFlow: "manual";
      pageKind: "manual_forms_notice";
      declarationChoice?: "yes" | "no";
    }
  | {
      variant: "electronic";
      metadataFlow: "electronic";
      pageKind: "electronic_customs_confirmation" | "electronic_signature_required";
      declarationChoice: "yes" | "no";
    }
  | { variant: "unknown"; pageKind: PhEtravelSeaCustomsPageKind; declarationChoice?: "yes" | "no" };

/**
 * SEA E10/E11 prove the electronic Yes path through the signature page.
 * The caller must provide the visible page classification and selected branch;
 * manual or No paths never inherit electronic selector actions.
 */
export function buildPhEtravelSeaElectronicPositiveCustomsActionPlan(
  payload: PhEtravelPortalPayload,
  context: PhEtravelSeaCustomsActionPlanContext,
): PhEtravelElectronicCustomsActionPlan {
  if (payload.travelType !== "ARRIVAL" || (payload.transportType !== "SEA" && payload.arrivalBranch?.transportType !== "SEA")) {
    return {
      branch: "not_applicable",
      actions: [],
      blockingCodes: ["ph_etravel_sea_arrival_customs_action_plan_only"],
      actionRequired: true,
    };
  }
  if (context.variant === "manual") {
    if (context.metadataFlow !== "manual") {
      return {
        branch: "SEA",
        actions: [],
        blockingCodes: ["sea_port_flow_metadata_page_mismatch"],
        actionRequired: true,
      };
    }
    return {
      branch: "SEA",
      actions: [],
      blockingCodes: ["sea_manual_customs_forms_action_required"],
      actionRequired: true,
    };
  }
  if (context.variant !== "electronic" ||
    context.metadataFlow !== "electronic" ||
    (context.pageKind !== "electronic_customs_confirmation" && context.pageKind !== "electronic_signature_required")) {
    return {
      branch: "SEA",
      actions: [],
      blockingCodes: ["sea_electronic_customs_page_content_required"],
      actionRequired: true,
    };
  }
  if (context.declarationChoice === "no") {
    return { branch: "SEA", actions: [], blockingCodes: [], actionRequired: false };
  }
  if (context.pageKind === "electronic_signature_required") {
    return {
      branch: "SEA",
      actions: [],
      blockingCodes: [
        "sea_electronic_positive_attachment_evidence_pending",
        "ph_etravel_signature_required",
        "sea_electronic_positive_post_signature_evidence_pending",
      ],
      actionRequired: true,
    };
  }
  if (!hasPositiveElectronicCustomsDeclaration(payload)) {
    return {
      branch: "SEA",
      actions: [],
      blockingCodes: ["sea_electronic_positive_customs_data_required"],
      actionRequired: true,
    };
  }
  return buildPhEtravelElectronicPositiveCustomsActionPlan(payload, "SEA");
}

function actionRequiredPhase(
  key: PhEtravelElectronicCustomsAutofillPhaseKey,
  fieldKeys: string[],
  blockedReason: string,
  selectors: string[] = [],
  validationEvidence: string[] = [],
  blockingGaps: string[] = [],
): PhEtravelElectronicCustomsAutofillPhase {
  return {
    key,
    fieldKeys,
    selectors,
    selectorEvidence: selectors.length > 0 ? "selector_plan_ready" : "live_selector_missing",
    automationStatus: "action_required",
    validationEvidence,
    blockingGaps,
    blockedReason,
  };
}

function selectorPlanReadyPhase(
  key: PhEtravelElectronicCustomsAutofillPhaseKey,
  fieldKeys: string[],
  selectors: string[],
  validationEvidence: string[] = [],
): PhEtravelElectronicCustomsAutofillPhase {
  return {
    key,
    fieldKeys,
    selectors,
    selectorEvidence: "selector_plan_ready",
    automationStatus: "selector_plan_ready",
    validationEvidence,
  };
}

export function buildPhEtravelElectronicCustomsAutofillPhases(
  payload: PhEtravelPortalPayload,
): PhEtravelElectronicCustomsAutofillPhase[] {
  const phases: PhEtravelElectronicCustomsAutofillPhase[] = [];
  if (!hasElectronicCustomsSignals(payload)) return phases;

  phases.push({
    key: "customs_confirmation",
    fieldKeys: ["with_something_to_declare_arrival"],
    selectors: ["button:has-text('Yes')", "button:has-text('No')"],
    selectorEvidence: "selector_plan_ready",
    automationStatus: "ready",
    validationEvidence: ["AIR positive path: Yes opens electronic customs/currency sequence"],
  });

  if (hasPositiveGeneralDeclaration(payload)) {
    phases.push(selectorPlanReadyPhase(
      "general_declaration_checklist",
      Array.from({ length: 12 }, (_, index) => `check_lists.${index}.response`),
      Array.from({ length: 12 }, (_, index) => `input[name="check_lists.${index}.response"]`),
      ["AIR positive path: checklist radio controls observed with true/false values"],
    ));
  }

  if (hasGoodsItemModalBranch(payload)) {
    phases.push(actionRequiredPhase(
      "goods_item_modal_table",
      [
        "amount_of_goods_acquired.currency",
        "amount_of_goods_acquired.amount",
        "items[].description",
        "items[].quantity",
        "items[].amount_usd",
      ],
      "customs_goods_items_modal",
      [
        "button:has-text('Add Item')",
        "textarea[name='description']",
        "input[name='quantity']",
        "input[name='amount']",
      ],
      [
        "Empty Add shows Description Required",
        "Empty Add shows Quantity Required",
        "Empty Add shows Amount in USD Required",
        "Saved row appears in Quantity/Description/Amount in USD table",
      ],
      ["other_goods_no_row_page_level_blocking_unverified"],
    ));
  }

  if (hasCurrencyDeclarationBranch(payload)) {
    const ownerBranch = normalizePhEtravelCurrencyOwnerBranch({
      ownerNotApplicable: payload.customs.currencyOwnerNotApplicable,
      owner: payload.customs.currencyOwner,
      recipient: payload.customs.currencyRecipient,
    });
    phases.push(
      actionRequiredPhase(
        "currency_owner_recipient",
        ownerBranch.ownerNotApplicable ? ["owner_details_not_applicable"] : [
          "owner_details_not_applicable",
          "owner_business_name",
          "owner_first_name",
          "owner_last_name",
          "owner_occupation",
          "owner_country_code",
          "owner_street",
          "owner_postal_code",
          "recipient_business_name",
          "recipient_first_name",
          "recipient_last_name",
          "recipient_occupation",
          "recipient_country_code",
          "recipient_street",
          "recipient_postal_code",
        ],
        "customs_currency_owner_recipient_structured_controls",
        ownerBranch.ownerNotApplicable ? [] : [
          "input[name='owner_business_name']",
          "input[name='owner_first_name']",
          "input[name='owner_middle_name']",
          "input[name='owner_last_name']",
          "input[name='owner_suffix_name']",
          "input[name='owner_occupation']",
          "[name='owner_country_code']",
          "input[name='owner_street']",
          "input[name='owner_postal_code']",
          "input[name='recipient_business_name']",
          "input[name='recipient_first_name']",
          "input[name='recipient_middle_name']",
          "input[name='recipient_last_name']",
          "input[name='recipient_suffix_name']",
          "input[name='recipient_occupation']",
          "[name='recipient_country_code']",
          "input[name='recipient_street']",
          "input[name='recipient_postal_code']",
        ],
        ["Owner/recipient field selectors observed on AIR positive currency page"],
        ownerBranch.blockingCodes,
      ),
      actionRequiredPhase(
        "currency_item_modal_table",
        ["currencies[].currency", "currencies[].monetary_instrument", "currencies[].amount"],
        "customs_currency_item_modal",
        [
          "button:has-text('Add Item')",
          "[name='currency_id']",
          "[name='monetary_instrument_id']",
          "input[name='amount']",
        ],
        [
          "Empty Add shows Currency Required",
          "Empty Add shows Monetary Instrument Required",
          "Empty Add shows Amount Required",
          "No currency item shows At least have 1 item",
        ],
        ["complete_currency_and_monetary_instrument_option_lists_unverified"],
      ),
      selectorPlanReadyPhase(
        "currency_source_purpose_checkboxes",
        ["currency_sources[]", "currency_source_other", "transport_purposes[]", "transport_purpose_other"],
        [
          "input[name='currency_sources.0'][value='SALARY']",
          "input[name='currency_sources.1'][value='BUSINESS']",
          "input[name='currency_sources.2'][value='OTHER']",
          "input[name='currency_source_other']",
          "input[name='transport_purposes.0'][value='LEISURE']",
          "input[name='transport_purposes.1'][value='MEDICAL']",
          "input[name='transport_purposes.2'][value='PAYABLES']",
          "input[name='transport_purposes.3'][value='EDUCATION']",
          "input[name='transport_purposes.4'][value='OTHER']",
          "input[name='transport_purpose_other']",
        ],
        [
          "Source values observed: SALARY, BUSINESS, OTHER",
          "Purpose values observed: LEISURE, MEDICAL, PAYABLES, EDUCATION, OTHER",
          "Other source/purpose empty fields show Required",
        ],
      ),
      payload.customs.currencyTransportMethod === "is_shipped_thru_courier_service"
        ? selectorPlanReadyPhase(
            "currency_transfer_branch",
            [
              "physical_or_shipped",
              "courier_name",
              "airway_bill_no",
              "airway_bill_date",
              "bsp_authorization_date",
            ],
            [
              "input[name='physical_or_shipped'][value='is_shipped_thru_courier_service']",
              "input[name='courier_name']",
              "input[name='airway_bill_no']",
              "input[name='airway_bill_date']",
              "input[name='bsp_authorization_date']",
            ],
            [
              "Courier branch selector observed",
              "Courier empty fields show Required",
            ],
          )
        : actionRequiredPhase(
            "currency_transfer_branch",
            [
              "physical_or_shipped",
              "no_of_days_in_philippines",
              "last_travel_to_philippines",
              "bsp_authorization_date",
            ],
            "customs_currency_transfer_branch",
            [
              "input[name='physical_or_shipped'][value='is_physically_transferred_by_person']",
              "input[name='no_of_days_in_philippines']",
              "input[name='last_travel_to_philippines']",
              "input[name='bsp_authorization_date']",
            ],
            ["Physical branch selectors observed"],
            ["physical_branch_empty_requiredness_unverified"],
          ),
    );
  }

  if (payload.customs.customsSignatureDeclaration || payload.customs.customsSignatureFile) {
    const attachmentContract = buildPhEtravelAttachmentActionContract(undefined);
    phases.push(actionRequiredPhase(
      "attachments_signature",
      ["attachments", "signature"],
      "customs_attachments_signature_controls",
      [],
      ["Signature canvas and Clear button observed where signature page appears"],
      attachmentContract.blockingCodes,
    ));
  }

  return phases;
}

export function phEtravelStructuredCustomsActionRequired(
  payload: PhEtravelPortalPayload,
  seaPortFlow?: PhEtravelSeaPortFlowResolution | null,
): string[] {
  const isSeaArrival = payload.travelType === "ARRIVAL" &&
    (payload.transportType === "SEA" || payload.arrivalBranch?.transportType === "SEA");
  if (isSeaArrival && hasElectronicCustomsSignals(payload)) {
    if (!seaPortFlow) return ["sea_destination_port_metadata_required"];
    if (seaPortFlow.status === "action_required") return [seaPortFlow.code];
    return ["sea_dynamic_page_gate_live_content_required"];
  }
  const actionPlan = buildPhEtravelAirPositiveCustomsActionPlan(payload);
  if (actionPlan.actionRequired) return actionPlan.blockingCodes;
  const phases = buildPhEtravelElectronicCustomsAutofillPhases(payload);
  const blockers = phases.flatMap((phase) =>
    phase.automationStatus === "action_required" && phase.blockedReason ? [phase.blockedReason] : []
  );
  const selectorPlansReadyButNotEnabled = phases.some((phase) => phase.automationStatus === "selector_plan_ready");
  return selectorPlansReadyButNotEnabled ? [...blockers, "customs_positive_autofill_not_enabled"] : blockers;
}

async function loadOfficialLabelMap(path: string): Promise<Record<string, string>> {
  const response = await fetch(`${PH_ETRAVEL_OFFICIAL_COMMON_API}/${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return {};
  const payload = await response.json() as { data?: Array<{ code?: unknown; name?: unknown }> };
  return Object.fromEntries((payload.data ?? []).flatMap((item) =>
    typeof item.code === "string" && typeof item.name === "string" ? [[item.code, item.name]] : [],
  ));
}

async function loadOfficialLabels(): Promise<Record<string, string>> {
  const paths = [
    "countries?paginate=0&order_by=name&status_by=asc",
    "occupations?paginate=0&order_by=name&status_by=asc",
    "purpose_of_visits?paginate=0&for_arrival=1&order_by=name&status_by=asc",
    "purpose_of_visits?paginate=0&for_departure=1&order_by=name&status_by=asc",
    "travel_companies?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    "travel_ports?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    "sickness_symptoms?paginate=0&order_by=name&status_by=asc&is_active=1",
  ];
  const maps = await Promise.all(paths.map((path) => loadOfficialLabelMap(path).catch(() => ({}))));
  return Object.assign({}, ...maps);
}

function resolvedOptionLabel(value: string | null, officialLabels: Record<string, string>): string | null {
  return value ? officialLabels[value] ?? optionLabel(value) : null;
}

function currencyPartyPlan(prefix: "currency_owner" | "currency_recipient", party: PhEtravelCurrencyParty | null): PhEtravelFieldPlanItem[] {
  if (!party) return [];
  const labelPrefix = prefix === "currency_owner" ? "Owner" : "Recipient";
  return [
    { key: `${prefix}_business_name`, labels: [`${labelPrefix} Business Name`, "Business Name"], kind: "text", value: party.businessName },
    { key: `${prefix}_first_name`, labels: [`${labelPrefix} First Name`, "First Name"], kind: "text", value: party.firstName },
    { key: `${prefix}_middle_name`, labels: [`${labelPrefix} Middle Name`, "Middle Name"], kind: "text", value: party.middleName },
    { key: `${prefix}_last_name`, labels: [`${labelPrefix} Last Name`, "Last Name"], kind: "text", value: party.lastName },
    { key: `${prefix}_suffix`, labels: [`${labelPrefix} Suffix`, "Suffix"], kind: "choice", value: party.suffix },
    { key: `${prefix}_occupation_or_business_activity`, labels: [`${labelPrefix} Occupation/Business Activity`, "Occupation/Business Activity"], kind: "text", value: party.occupationOrBusinessActivity },
    { key: `${prefix}_country`, labels: [`${labelPrefix} Country`, "Country"], kind: "choice", value: party.country },
    { key: `${prefix}_address`, labels: [`${labelPrefix} Address`, "Address"], kind: "text", value: party.address },
    { key: `${prefix}_postal_code`, labels: [`${labelPrefix} Postal Code`, "Postal Code"], kind: "text", value: party.postalCode },
  ];
}

function customsDeclarationPlan(payload: PhEtravelPortalPayload): PhEtravelFieldPlanItem[] {
  const ownerBranch = normalizePhEtravelCurrencyOwnerBranch({
    ownerNotApplicable: payload.customs.currencyOwnerNotApplicable,
    owner: payload.customs.currencyOwner,
    recipient: payload.customs.currencyRecipient,
  });
  const baggagePlan: PhEtravelFieldPlanItem[] = [
    { key: "checked_baggage", labels: ["Checked-in (pcs)", "Checked Baggage"], kind: "choice", value: payload.customs.checkedBaggageCount ?? "0" },
    { key: "handcarry_baggage", labels: ["Hand-carried (pcs)", "Hand Carry Baggage"], kind: "choice", value: payload.customs.handcarryBaggageCount ?? "0" },
  ];
  const hasElectronicCustomsSignals =
    payload.customs.hasBaggageOrCurrencyToDeclare ||
    payload.customs.generalDeclarationResponses.length > 0 ||
    payload.customs.goodsItems.length > 0 ||
    payload.customs.hasGoodsToDeclare ||
    payload.customs.hasCurrencyToDeclare ||
    payload.customs.hasDutiableGoods ||
    payload.customs.hasCurrencyOverThreshold ||
    payload.customs.currencyItems.length > 0;
  if (
    payload.travelType !== "DEPARTURE" &&
    payload.arrivalBranch?.transportType === "SEA" &&
    !hasElectronicCustomsSignals
  ) {
    return baggagePlan;
  }
  return [
    { key: "customs_acknowledgement", labels: ["customs and currency declaration information"], kind: "checkbox", value: payload.customs.customsInformationAcknowledgement, required: true },
    { key: "has_goods_to_declare", labels: ["goods to declare", "restricted, regulated, prohibited, dutiable"], kind: "choice", value: yesNo(payload.customs.hasGoodsToDeclare), required: true },
    { key: "has_currency_to_declare", labels: ["currency or monetary instruments above", "currency to declare"], kind: "choice", value: yesNo(payload.customs.hasCurrencyToDeclare), required: true },
    ...baggagePlan,
    { key: "has_customs_declaration", labels: ["baggage or currency to declare"], kind: "choice", value: yesNo(payload.customs.hasBaggageOrCurrencyToDeclare) },
    ...(payload.customs.generalDeclarationResponses ?? []).map((item) => ({
      key: item.key,
      portalName: `check_lists.${item.itemNumber - 1}.response`,
      labels: [`Declaration item ${item.itemNumber}`, `Checklist item ${item.itemNumber}`],
      kind: "choice" as const,
      value: yesNo(item.response),
    })),
    { key: "amount_of_goods_currency", portalName: "amount_of_goods_acquired.currency", labels: ["Currency of Goods Acquired", "Amount of Goods Currency"], kind: "choice", value: optionLabel(payload.customs.amountOfGoodsCurrency) },
    { key: "amount_of_goods_amount", portalName: "amount_of_goods_acquired.amount", labels: ["Amount of Goods Acquired", "Total Value of Goods"], kind: "text", value: payload.customs.amountOfGoodsAmount },
    ...(payload.customs.goodsItems ?? []).flatMap((item, index) => [
      { key: `goods_item_${index}_description`, labels: ["Description"], kind: "text" as const, value: item.description },
      { key: `goods_item_${index}_quantity`, labels: ["Quantity"], kind: "text" as const, value: item.quantity },
      { key: `goods_item_${index}_amount_usd`, labels: ["Amount in USD"], kind: "text" as const, value: item.amountUsd },
    ]),
    ...currencyPartyPlan("currency_owner", ownerBranch.owner),
    ...currencyPartyPlan("currency_recipient", ownerBranch.recipient),
    ...(payload.customs.currencyItems ?? []).flatMap((item, index) => [
      { key: `currency_item_${index}_currency`, labels: ["Currency", "Currency Name"], kind: "choice" as const, value: optionLabel(item.currency) },
      { key: `currency_item_${index}_monetary_instrument`, labels: ["Monetary Instrument"], kind: "choice" as const, value: optionLabel(item.monetaryInstrument) },
      { key: `currency_item_${index}_amount`, labels: ["Amount"], kind: "text" as const, value: item.amount },
    ]),
    { key: "bsp_authorization_number", labels: ["BSP Prior Authorization Number"], kind: "text", value: payload.customs.bspAuthorizationNumber },
    { key: "bsp_authorization_date", labels: ["BSP Authorization Date"], kind: "date", value: payload.customs.bspAuthorizationDate },
    ...(payload.customs.currencySources ?? []).map((source, index) => ({
      key: `currency_source_${index}`,
      labels: ["Sources of Currencies or Monetary Instruments", source],
      kind: "checkbox" as const,
      value: true,
    })),
    { key: "currency_source_other", labels: ["Other Source", "Source Other"], kind: "text", value: payload.customs.currencySourceOther },
    ...(payload.customs.currencyTransportPurposes ?? []).map((purpose, index) => ({
      key: `currency_purpose_${index}`,
      labels: ["Purpose of Transport", purpose],
      kind: "checkbox" as const,
      value: true,
    })),
    { key: "currency_purpose_other", labels: ["Other Purpose", "Purpose Other"], kind: "text", value: payload.customs.currencyTransportPurposeOther },
    { key: "currency_transport_method", labels: ["Physical transfer or Courier service", "Mode of Transport"], kind: "choice", value: optionLabel(payload.customs.currencyTransportMethod) },
    { key: "no_of_days_in_philippines", labels: ["No. of days in the Philippines"], kind: "text", value: payload.customs.noOfDaysInPhilippines },
    { key: "last_travel_to_philippines", labels: ["Last travel to the Philippines"], kind: "date", value: payload.customs.lastTravelToPhilippines },
    { key: "courier_name", labels: ["Courier Name"], kind: "text", value: payload.customs.courierName },
    { key: "airway_bill_number", labels: ["Airway Bill Number", "Airway Bill No."], kind: "text", value: payload.customs.airwayBillNumber },
    { key: "airway_bill_date", labels: ["Airway Bill Date"], kind: "date", value: payload.customs.airwayBillDate },
  ];
}

export function buildPhEtravelFieldPlan(
  payload: PhEtravelPortalPayload,
  officialLabels: Record<string, string> = {},
): PhEtravelFieldPlanItem[] {
  const isAirArrival = payload.travelType !== "DEPARTURE" && payload.arrivalBranch?.transportType !== "SEA";
  const arrivalTravellerType = payload.arrivalBranch?.travellerType ?? (isAirArrival ? "AIRCRAFT_PASSENGER" : "VESSEL_PASSENGER");
  const hasArrivalDestinationBranch = payload.travelType !== "DEPARTURE" && (isAirArrival || payload.isDisembarking === true);
  const isTravelPortDestination = /travel[_\s-]?port/i.test(payload.destinationType ?? "");
  if (payload.travelType === "DEPARTURE") {
    const isAir = payload.transportType === "AIR";
    return [
      { key: "registration_for", labels: ["Travel Registration", "Registration For"], kind: "choice", value: optionLabel(payload.registrationFor ?? "FOR_ME"), required: true },
      { key: "transport_type", labels: ["Mode of Travel", "Transport Type"], kind: "choice", value: optionLabel(payload.transportType), required: true },
      { key: "travel_type", labels: ["Travel Type"], kind: "choice", value: "Departure", required: true },
      { key: "first_name", labels: ["First Name", "Given Name"], kind: "text", value: payload.firstName, required: true },
      { key: "middle_name", labels: ["Middle Name"], kind: "text", value: payload.middleName },
      { key: "last_name", labels: ["Last Name", "Surname", "Family Name"], kind: "text", value: payload.lastName, required: true },
      { key: "suffix", labels: ["Suffix"], kind: "choice", value: optionLabel(payload.suffix) },
      { key: "date_of_birth", labels: ["Birth Date", "Date of Birth"], kind: "date", value: payload.dateOfBirth, required: true },
      { key: "sex", labels: ["Sex", "Gender"], kind: "choice", value: optionLabel(payload.sex), required: true },
      { key: "passport_holder_type", labels: ["Travel Document Holder", "Passport Holder"], kind: "choice", value: optionLabel(payload.passportHolderType), required: true },
      { key: "nationality", labels: ["Citizenship", "Nationality"], kind: "choice", value: resolvedOptionLabel(payload.nationality, officialLabels), required: true },
      { key: "country_of_birth", labels: ["Country of Birth"], kind: "choice", value: resolvedOptionLabel(payload.countryOfBirth, officialLabels), required: true },
      { key: "country_of_residence", labels: ["Permanent Country of Residence", "Country of Residence"], kind: "choice", value: resolvedOptionLabel(payload.countryOfResidence, officialLabels), required: true },
      { key: "residence_address", labels: ["Permanent Address", "Residence Address"], kind: "text", value: payload.residenceAddress },
      { key: "occupation", labels: ["Occupation"], kind: "choice", value: resolvedOptionLabel(payload.occupation, officialLabels), required: true },
      { key: "passport_number", labels: ["Passport Number"], kind: "text", value: payload.passportNumber, required: true },
      { key: "passport_issuing_authority", labels: ["Passport Issuing Authority", "Country of Issue"], kind: "choice", value: resolvedOptionLabel(payload.passportIssuingAuthority, officialLabels), required: true },
      { key: "passport_issue_date", labels: ["Passport Issued Date", "Passport Issue Date"], kind: "date", value: payload.passportIssueDate, required: true },
      { key: "passport_expiry_date", labels: ["Passport Expiry Date", "Passport Expiration Date"], kind: "date", value: payload.passportExpiryDate, required: true },
      { key: "email", labels: ["Email Address", "Email"], kind: "text", value: payload.emailAddress, required: true },
      { key: "mobile", labels: ["Mobile Number", "Contact Number"], kind: "text", value: `${payload.mobileCountryCode}${payload.mobileNumber}`, required: true },
      { key: "purpose", portalName: "purpose_of_visit_code", labels: ["Purpose of Travel", "Purpose of Visit"], kind: "choice", value: resolvedOptionLabel(payload.purposeOfTravel, officialLabels), required: true },
      { key: "traveller_type", portalName: "passenger_type", labels: ["Traveller Type", "Traveler Type"], kind: "choice", value: optionLabel(payload.travellerType ?? (isAir ? "AIRCRAFT PASSENGER" : "VESSEL PASSENGER")), required: true },
      { key: "travel_company", portalName: "travel_company_code", labels: ["Name of Airline", "Name of Vessel", "Travel Company"], kind: isAir ? "choice" : "text", value: resolvedOptionLabel(payload.airlineOrVesselName, officialLabels), required: true },
      { key: "transport_number", portalName: "flight_number", labels: ["Flight Number", "Vehicle/Vessel Number"], kind: "text", value: payload.flightNumber, required: true },
      { key: "departure_port", portalName: "origin_port_code", labels: ["Airport of Origin in the Philippines", "Seaport of Origin in the Philippines", "Port of Origin"], kind: "choice", value: resolvedOptionLabel(payload.portOfEntry, officialLabels), required: true },
      { key: "departure_date", portalName: "departure_date", labels: ["Date of Departure", "Date of Departure of Flight"], kind: "date", value: payload.departureDate, required: true },
      { key: "destination_country", portalName: "destination_country_code", labels: ["Country of Destination"], kind: "choice", value: resolvedOptionLabel(payload.destinationCountry, officialLabels), required: true },
      { key: "destination_port", portalName: "destination_port", labels: ["Airport/Seaport of Destination", "Port of Destination"], kind: "text", value: payload.destinationPort, required: true },
      { key: "arrival_date", portalName: "arrival_date", labels: ["Date of Arrival at Destination", "Arrival Date"], kind: "date", value: payload.arrivalDate, required: true },
      { key: "destination_address", portalName: "destination_address", labels: ["Destination Address"], kind: "text", value: payload.destinationAddress, required: true },
      { key: "return_date", portalName: "return_date", labels: ["Expected Return Date to the Philippines", "Return Date"], kind: "date", value: payload.returnDate },
      { key: "travel_tax_type", labels: ["Travel Tax Details", "Travel Tax Payment"], kind: "choice", value: optionLabel(payload.travelTaxPaymentType) },
      { key: "travel_tax_reference", labels: ["Travel Tax Reference Number"], kind: "text", value: payload.travelTaxReferenceNumber },
      { key: "travel_tax_ticket", labels: ["Ticket Number"], kind: "text", value: payload.travelTaxTicketNumber },
      { key: "cfo_registration", labels: ["Commission on Filipinos Overseas Registration Number", "CFO Registration Number"], kind: "text", value: payload.cfoRegistrationNumber },
      ...customsDeclarationPlan(payload),
    ];
  }
  return [
    { key: "registration_for", labels: ["Travel Registration", "Registration For"], kind: "choice", value: optionLabel(payload.registrationFor ?? "FOR_ME"), required: true },
    { key: "transport_type", labels: ["Mode of Travel", "Transport Type"], kind: "choice", value: optionLabel(payload.transportType), required: true },
    { key: "travel_type", labels: ["Travel Type"], kind: "choice", value: optionLabel(payload.travelType), required: true },
    { key: "passport_holder_type", labels: ["Travel Document Holder", "Passport Holder", "Passport Holder Type"], kind: "choice", value: optionLabel(payload.passportHolderType), required: true },
    { key: "is_disembarking", portalName: "is_disembarking", labels: ["Are you disembarking?", "Disembarking"], kind: "checkbox", value: payload.isDisembarking ?? false, required: payload.arrivalBranch?.transportType === "SEA" },
    { key: "first_name", labels: ["First Name", "Given Name"], kind: "text", value: payload.firstName, required: true },
    { key: "middle_name", labels: ["Middle Name"], kind: "text", value: payload.middleName },
    { key: "last_name", labels: ["Last Name", "Surname", "Family Name"], kind: "text", value: payload.lastName, required: true },
    { key: "suffix", labels: ["Suffix"], kind: "choice", value: optionLabel(payload.suffix) },
    { key: "passport_number", labels: ["Passport Number"], kind: "text", value: payload.passportNumber, required: true },
    { key: "passport_issue_date", labels: ["Passport Issued Date", "Passport Issue Date"], kind: "date", value: payload.passportIssueDate, required: true },
    { key: "passport_expiry_date", labels: ["Passport Expiry Date", "Passport Expiration Date"], kind: "date", value: payload.passportExpiryDate, required: true },
    { key: "passport_issuing_authority", labels: ["Passport Issuing Authority", "Country of Issue"], kind: "choice", value: resolvedOptionLabel(payload.passportIssuingAuthority, officialLabels), required: true },
    { key: "nationality", labels: ["Citizenship", "Nationality"], kind: "choice", value: resolvedOptionLabel(payload.nationality, officialLabels), required: true },
    { key: "country_of_birth", labels: ["Country of Birth"], kind: "choice", value: resolvedOptionLabel(payload.countryOfBirth, officialLabels), required: true },
    { key: "country_of_residence", labels: ["Permanent Country of Residence", "Country of Residence"], kind: "choice", value: resolvedOptionLabel(payload.countryOfResidence, officialLabels), required: true },
    { key: "residence_address", labels: ["Permanent Address", "Residence Address", "No./Bldg./City/State/Province"], kind: "text", value: payload.residenceAddress },
    { key: "occupation", labels: ["Occupation"], kind: "choice", value: resolvedOptionLabel(payload.occupation, officialLabels), required: true },
    { key: "date_of_birth", labels: ["Birth Date", "Date of Birth"], kind: "date", value: payload.dateOfBirth, required: true },
    { key: "sex", labels: ["Sex", "Gender"], kind: "choice", value: optionLabel(payload.sex), required: true },
    { key: "email", labels: ["Email Address", "Email"], kind: "text", value: payload.emailAddress, required: true },
    { key: "mobile", labels: ["Mobile Number", "Contact Number"], kind: "text", value: `${payload.mobileCountryCode}${payload.mobileNumber}`, required: true },
    { key: "purpose", portalName: "purpose_of_visit_code", labels: ["Purpose of Travel", "Purpose of Visit"], kind: "choice", value: resolvedOptionLabel(payload.purposeOfTravel, officialLabels), required: true },
    { key: "traveller_type", portalName: "passenger_type", labels: ["Traveller Type", "Traveler Type"], kind: "choice", value: optionLabel(payload.travellerType ?? arrivalTravellerType), required: true },
    {
      key: isAirArrival ? "airline" : "vessel_name",
      portalName: isAirArrival ? "travel_company_code" : "vessel_name",
      labels: isAirArrival
        ? ["Name of Airline", "Airline Name", "Name of Airline/Vessel"]
        : ["Name of Vessel", "Vessel Name", "Name of Airline/Vessel"],
      kind: isAirArrival ? "choice" : "text",
      value: resolvedOptionLabel(payload.airlineOrVesselName, officialLabels),
      required: true,
    },
    {
      key: isAirArrival && payload.isSpecialFlight ? "flight_number_special" : isAirArrival ? "flight_number" : "voyage_number",
      portalName: isAirArrival && payload.isSpecialFlight ? "flight_number_special" : "flight_number",
      labels: isAirArrival && payload.isSpecialFlight
        ? ["Specify special flight number"]
        : isAirArrival ? ["Flight Number", "Vehicle/Vessel Number"] : ["Voyage Number", "Vehicle/Vessel Number"],
      kind: isAirArrival && payload.isSpecialFlight ? "text" : isAirArrival ? "choice" : "text",
      value: payload.flightNumber,
      required: true,
    },
    { key: "origin_country", portalName: "origin_country_code", labels: ["Country of Origin"], kind: "choice", value: resolvedOptionLabel(payload.originCountry, officialLabels), required: true },
    {
      key: isAirArrival ? "airport_of_origin" : "seaport_of_origin",
      portalName: "origin_port",
      labels: isAirArrival ? ["Airport of Origin", "Port of Origin"] : ["Seaport of Origin", "Port of Origin"],
      kind: "text",
      value: payload.airportOfOrigin,
      required: true,
    },
    { key: "port_of_entry", portalName: "destination_port_code", labels: ["Airport/Port of Destination in the Philippines", "Port of Entry", isAirArrival ? "Airport of Destination" : "Seaport of Destination"], kind: "choice", value: resolvedOptionLabel(payload.portOfEntry, officialLabels), required: true },
    { key: "with_transit", portalName: "with_transit", labels: ["With Transit", "Connecting Flight"], kind: "checkbox", value: payload.withTransit ?? false },
    { key: "transit_country", portalName: "transit_country_code", labels: ["Country of Transit"], kind: "choice", value: resolvedOptionLabel(payload.transitCountry, officialLabels) },
    { key: "transit_airport", portalName: "transit_port", labels: ["Airport of Transit"], kind: "text", value: payload.transitAirport },
    { key: "transit_date", portalName: "transit_date", labels: ["Date of Transit"], kind: "date", value: payload.transitDate },
    ...(hasArrivalDestinationBranch ? [
      { key: "destination_type", portalName: "stay_location_type", labels: ["Destination upon arrival in the Philippines", "Destination Type"], kind: "choice" as const, value: optionLabel(payload.destinationType ?? "HOTEL_RESORT"), required: true },
      { key: "destination_transit_airport", portalName: "transit_port_code", portalValue: payload.destinationTransitAirport, labels: ["Airport"], kind: "choice" as const, value: resolvedOptionLabel(payload.destinationTransitAirport, officialLabels), required: Boolean(payload.destinationTransitAirport) },
      { key: "destination_country", portalName: "transit_destination_country_code", labels: ["Country of Destination"], kind: "choice" as const, value: resolvedOptionLabel(payload.destinationCountry, officialLabels), required: Boolean(payload.destinationCountry) },
      { key: "disembarking_port", portalName: "disembarking_port_code", labels: ["Disembarking Port", "Travel Port"], kind: "choice" as const, value: resolvedOptionLabel(payload.destinationPort, officialLabels), required: !isAirArrival && isTravelPortDestination },
      ...(!isTravelPortDestination ? [{
        key: "philippines_address",
        portalName: "destination_upon_arrival_in_philippines",
        labels: ["Hotel/Resort Address", "Residence Address", "Address in the Philippines", "Destination Address"],
        kind: "text" as const,
        value: payload.philippinesAddress,
        required: !payload.destinationTransitAirport,
      }] : []),
    ] : []),
    { key: "arrival_date", portalName: "arrival_date", labels: ["Date of Arrival", "Date of Arrival of Flight", "Arrival Date"], kind: "date", value: payload.arrivalDate, required: true },
    { key: "departure_date", portalName: "departure_date", labels: ["Date of Departure", "Date of Departure of Flight", "Departure Date"], kind: "date", value: payload.departureDate, required: true },
    { key: "return_date", portalName: "return_date", labels: ["Date of Return", "Return Date"], kind: "date", value: payload.returnDate, required: Boolean(payload.returnDate) },
    { key: "under_18_count", labels: ["Below 18 yrs. old"], kind: "choice", value: payload.accompaniedUnder18Count ?? "0" },
    { key: "adult_count", labels: ["18 yrs. old and above"], kind: "choice", value: payload.accompanied18PlusCount ?? "0" },
    { key: "first_visit", labels: ["First time visiting Philippines"], kind: "choice", value: yesNo(payload.firstTimeVisitingPhilippines) },
    { key: "health_recent_travel", portalName: "meta.with_recent_travel_history", labels: ["Do you have any recent travel history in the last 30 days?"], kind: "choice", value: yesNo(payload.hasRecentTravelHistory30d), required: true },
    ...(payload.hasRecentTravelHistory30d ? [
      { key: "visited_countries", portalName: "visited_countries", labels: ["Country(ies) worked, visited and transited in the last 30 days"], kind: "choice" as const, value: null, required: true, repeatable: true, minimumItems: 1 },
      ...(payload.visitedCountries30d ?? []).map((country, index) => ({ key: `visited_country_${index}`, portalName: "visited_countries", labels: ["Country(ies) worked, visited and transited in the last 30 days"], kind: "choice" as const, value: resolvedOptionLabel(country, officialLabels), required: true, repeatable: true, minimumItems: 1 })),
    ] : []),
    { key: "health_exposure", portalName: "is_with_history_exposure", labels: ["Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel?"], kind: "choice", value: yesNo(payload.hasExposureToSickPerson30d), required: true },
    { key: "health_sick", portalName: "is_sicked_within_thirty_days", labels: ["Have you been sick in the past 30 days?"], kind: "choice", value: yesNo(payload.hasBeenSick30d), required: true },
    ...(payload.hasBeenSick30d ? [
      { key: "sickness_symptoms", portalName: "sickness_symptoms", labels: ["Symptoms"], kind: "choice" as const, value: null, required: true, repeatable: true, minimumItems: 1 },
      ...(payload.sicknessSymptoms ?? []).map((symptom, index) => ({ key: `sickness_symptom_${index}`, portalName: "sickness_symptoms", labels: ["Symptoms"], kind: "choice" as const, value: resolvedOptionLabel(symptom, officialLabels), required: true, repeatable: true, minimumItems: 1 })),
    ] : []),
    ...customsDeclarationPlan(payload),
  ];
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible({ timeout: 300 }).catch(() => false)) return candidate;
    }
  }
  return null;
}

async function controlForLabel(page: Page, label: string): Promise<Locator | null> {
  const pattern = new RegExp(`^\\s*${escapeRegex(label)}\\s*$`, "i");
  const byLabel = await firstVisible([
    page.getByLabel(pattern),
    page.getByPlaceholder(pattern),
    page.getByRole("combobox", { name: pattern }),
  ]);
  if (byLabel) return byLabel;
  const labelNode = await firstVisible([
    page.locator("label, legend").filter({ hasText: pattern }),
    page.getByText(pattern),
  ]);
  if (!labelNode) return null;
  const direct = await firstVisible([
    labelNode.locator("input:not([type='hidden']), textarea, select, [role='combobox']"),
    labelNode.locator("xpath=following::input[not(@type='hidden')][1]"),
    labelNode.locator("xpath=following::textarea[1]"),
    labelNode.locator("xpath=following::select[1]"),
    labelNode.locator("xpath=following::*[@role='combobox'][1]"),
  ]);
  return direct;
}

async function controlForItem(page: Page, item: PhEtravelFieldPlanItem): Promise<Locator | null> {
  if (item.portalName) {
    const named = await firstVisible([
      page.locator(`input[name="${item.portalName}"]:visible`),
      page.locator(`textarea[name="${item.portalName}"]:visible`),
      page.locator(`select[name="${item.portalName}"]:visible`),
    ]);
    if (named) return named;
  }
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (control) return control;
  }
  return null;
}

async function selectOfficialDatePicker(
  page: Page,
  input: Locator,
  isoDate: string,
): Promise<boolean> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const [, year, month, day] = match;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[Number(month) - 1];
  if (!monthName) return false;

  await input.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  const popper = page.locator(".react-datepicker-popper:visible").last();
  if (!await popper.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) {
    return false;
  }

  const headerSelects = popper.locator(".react-datepicker__header select");
  if (await headerSelects.count().catch(() => 0) >= 2) {
    await headerSelects.nth(1).selectOption(year, { timeout: 5_000 }).catch(() => undefined);
    await headerSelects.nth(0).selectOption(monthName, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }

  const targetDay = popper.locator(
    `.react-datepicker__day--0${day}:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)`,
  ).first();
  if (!await targetDay.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  await targetDay.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
  const formatted = `${month}/${day}/${year}`;
  return await input.inputValue().catch(() => "") === formatted;
}

async function closeHotelLookup(page: Page): Promise<void> {
  const search = page.getByPlaceholder(/^Search\.\.\.$/i).first();
  if (!await search.isVisible({ timeout: 300 }).catch(() => false)) return;
  const overlay = search.locator("xpath=ancestor::ul[@role='listbox'][1]");
  const close = overlay.getByRole("button", { name: /^Close$/i }).first();
  await close.click({ timeout: 3_000 }).catch(() => undefined);
  if (await search.isVisible({ timeout: 500 }).catch(() => false)) {
    await close.evaluate((button) => (button as HTMLButtonElement).click()).catch(() => undefined);
  }
  await search.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
}

async function fillTextOrDate(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  if (item.kind === "date" && item.portalName) {
    const dateInput = await firstVisible([
      page.locator(`input[name="${item.portalName}"]:visible`),
    ]);
    if (dateInput) return selectOfficialDatePicker(page, dateInput, item.value);
  }
  if (item.key === "philippines_address") {
    const destination = await firstVisible([
      page.getByPlaceholder(/Hotel, Resorts, AirBnb, Tourist destinations/i),
      page.getByPlaceholder(/Destination Address/i),
    ]);
    if (destination) {
      await destination.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      const search = await firstVisible([page.getByPlaceholder(/^Search/i)]);
      if (search) {
        await search.fill(item.value, { timeout: 5_000 }).catch(() => undefined);
        await page.waitForTimeout(1_500);
        const searchTerm = item.value.split(",")[0] ?? item.value;
        const suggestion = await firstVisible([
          page.locator("[role='option'], [role='menuitem'], .v-list-item, .q-item, li").filter({ hasText: new RegExp(escapeRegex(searchTerm), "i") }),
        ]);
        if (suggestion) {
          await suggestion.click({ force: true, timeout: 5_000 }).catch(() => undefined);
          return true;
        }
      }
    }
  }
  const namedControl = await controlForItem(page, item);
  if (namedControl) {
    const tag = await namedControl.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (tag !== "select" && await namedControl.getAttribute("role") !== "combobox") {
      const type = await namedControl.getAttribute("type").catch(() => null);
      const value = item.kind === "date" && type !== "date"
        ? item.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")
        : item.value;
      await namedControl.fill(value, { timeout: 10_000 }).catch(() => undefined);
      const retained = await namedControl.inputValue().catch(() => "");
      if (retained) {
        if (item.key === "philippines_address") {
          await closeHotelLookup(page);
          await page.getByText(/^eVisa$/i).click({ force: true, timeout: 2_000 }).catch(() => undefined);
        }
        return true;
      }
    }
  }
  if (namedControl) return false;
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (!control) continue;
    const tag = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (tag === "select" || await control.getAttribute("role") === "combobox") continue;
    const type = await control.getAttribute("type").catch(() => null);
    const value = item.kind === "date" && type !== "date"
      ? item.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")
      : item.value;
    await control.fill(value, { timeout: 10_000 }).catch(() => undefined);
    const retained = await control.inputValue().catch(() => "");
    if (retained) return true;
  }
  return false;
}

const normalizedChoiceText = (value: string): string =>
  value.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

function expectedRadioValue(item: PhEtravelFieldPlanItem): string {
  const wanted = normalizedChoiceText(String(item.value ?? ""));
  if (wanted === "hotel resort") return "hotel";
  if (wanted === "transit via airport") return "transit";
  if (wanted === "yes") return "true";
  if (wanted === "no") return "false";
  return wanted;
}

async function selectStaticNamedCombobox(
  page: Page,
  item: PhEtravelFieldPlanItem,
  namedSelector: string,
): Promise<boolean> {
  const hidden = page.locator(`${namedSelector}[type="hidden"]`).first();
  if (!await hidden.count().catch(() => 0)) return false;
  const root = hidden.locator("xpath=ancestor::div[.//input[@role='combobox']][1]");
  const control = await firstVisible([
    root.locator("input[role='combobox']"),
    hidden.locator("xpath=preceding::input[@role='combobox'][1]"),
  ]);
  if (!control) return false;

  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  if (await control.isEditable().catch(() => false)) {
    await control.fill(item.value as string, { timeout: 5_000 }).catch(() => undefined);
  }
  const wanted = normalizedChoiceText(item.value as string);
  const options = page.getByRole("option");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 500 : 250);
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible({ timeout: 100 }).catch(() => false)) continue;
      if (normalizedChoiceText(await option.innerText().catch(() => "")) !== wanted) continue;
      if (!await option.click({ force: true, timeout: 3_000 }).then(() => true).catch(() => false)) continue;
      await page.waitForTimeout(250);
      return normalizedChoiceText(await hidden.inputValue().catch(() => "")) === wanted;
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function selectTravellerType(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  const wanted = normalizedChoiceText(item.value as string);
  const hidden = page.locator('input[name="passenger_type"][type="hidden"]').first();
  if (!await hidden.count().catch(() => 0)) return false;
  const control = await firstVisible([
    hidden.locator("xpath=preceding::input[@role='combobox'][1]"),
  ]);
  if (!control) return false;
  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await control.fill(item.value as string, { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
  const exactOption = await firstVisible([
    page.getByRole("option").filter({ hasText: new RegExp(`^\\s*${escapeRegex(item.value as string)}\\s*$`, "i") }),
  ]);
  if (exactOption) {
    await exactOption.click({ force: true, timeout: 3_000 }).catch(() => undefined);
  } else {
    await control.press("Enter").catch(() => undefined);
  }
  await page.waitForTimeout(500);
  if (normalizedChoiceText(await hidden.inputValue().catch(() => "")) === wanted) return true;
  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function selectNamedCombobox(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (!item.portalName || typeof item.value !== "string") return false;
  const namedSelector = `input[name="${item.portalName}"]`;
  if (item.key === "traveller_type" && await selectTravellerType(page, item)) return true;
  if (await page.locator(`${namedSelector}[type="hidden"]`).count().catch(() => 0)) {
    return selectStaticNamedCombobox(page, item, namedSelector);
  }
  const control = await firstVisible([page.locator(`${namedSelector}:visible`)]);
  if (!control || await control.getAttribute("role") !== "combobox") return false;

  const wanted = normalizedChoiceText(item.value);
  if (item.key === "flight_number") await page.waitForTimeout(1_500);
  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await control.fill(item.value, { timeout: 5_000 }).catch(() => undefined);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 750 : 350);
    const options = page.getByRole("option");
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible({ timeout: 100 }).catch(() => false)) continue;
      const text = normalizedChoiceText(await option.innerText().catch(() => ""));
      if (text !== wanted && !text.endsWith(` ${wanted}`)) continue;
      if (!await option.click({ force: true, timeout: 3_000 }).then(() => true).catch(() => false)) continue;
      await page.waitForTimeout(300);
      const selectedValue = normalizedChoiceText(
        await page.locator(`${namedSelector}:visible`).first().inputValue().catch(() => ""),
      );
      return selectedValue === wanted || selectedValue.endsWith(` ${wanted}`);
    }
  }
  // Clear the query before the control loses focus. The official component
  // otherwise auto-selects the first filtered option on blur.
  await control.fill("").catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function setFormikChoiceFromSiblingFiber(
  page: Page,
  anchorSelector: string,
  fieldName: string,
  value: string,
): Promise<boolean> {
  const updated = await page.evaluate(({ anchorSelector, fieldName, value }) => {
    type FormikBag = {
      setFieldValue?: unknown;
      values?: unknown;
    };
    type ReactFiberNode = {
      memoizedProps?: unknown;
      return?: ReactFiberNode | null;
    };
    const anchor = document.querySelector(anchorSelector);
    if (!anchor) return false;
    const fiberKey = Object.keys(anchor).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey
      ? (anchor as unknown as Record<string, ReactFiberNode>)[fiberKey]
      : null;
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return ?? null) {
      const props = fiber.memoizedProps;
      if (!props || typeof props !== "object") continue;
      const candidates: FormikBag[] = [props as FormikBag];
      for (const candidate of Object.values(props)) {
        if (candidate && typeof candidate === "object") candidates.push(candidate as FormikBag);
      }
      for (const candidate of candidates) {
        if (
          typeof candidate.setFieldValue !== "function" ||
          !candidate.values ||
          typeof candidate.values !== "object" ||
          !(fieldName in candidate.values)
        ) continue;
        (candidate.setFieldValue as (name: string, nextValue: string, validate?: boolean) => void)(
          fieldName,
          value,
          true,
        );
        return true;
      }
    }
    return false;
  }, { anchorSelector, fieldName, value }).catch(() => false);
  if (!updated) return false;
  await page.waitForTimeout(700);
  return page.getByText(new RegExp(`^\\s*${escapeRegex(value)}\\s*$`, "i"))
    .first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
}

async function selectChoice(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  const valuePattern = new RegExp(`^\\s*${escapeRegex(item.value)}\\s*$`, "i");
  if (item.portalName) {
    const namedRadios = page.locator(`input[type="radio"][name="${item.portalName}"]`);
    const radioCount = await namedRadios.count().catch(() => 0);
    const wanted = normalizedChoiceText(item.value);
    const expectedValue = expectedRadioValue(item);
    for (let index = 0; index < radioCount; index += 1) {
      const radio = namedRadios.nth(index);
      const value = normalizedChoiceText(await radio.getAttribute("value").catch(() => "") ?? "");
      const labelText = normalizedChoiceText(
        await radio.locator("xpath=ancestor::label[1]").innerText().catch(() => ""),
      );
      const mappedMatch = value === expectedValue;
      if (value !== wanted && labelText !== wanted && !mappedMatch) continue;
      await radio.click({ force: true, timeout: 5_000 });
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (await radio.isChecked().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      return false;
    }
  }
  if (item.portalName && await selectNamedCombobox(page, item)) return true;
  if (
    item.portalName === "transit_port_code" &&
    await setFormikChoiceFromSiblingFiber(
      page,
      'input[name="transit_destination_country_code"]',
      item.portalName,
      item.portalValue ?? item.value,
    )
  ) return true;
  for (const label of item.labels) {
    const labelPattern = new RegExp(escapeRegex(label), "i");
    const scopedChoice = await firstVisible([
      page.locator("label, button, [role='radio']").filter({ hasText: valuePattern }),
      page.locator("fieldset, section, div").filter({ hasText: labelPattern }).locator("label, button, [role='radio']").filter({ hasText: valuePattern }),
    ]);
    if (scopedChoice) {
      await scopedChoice.click({ force: true, timeout: 5_000 });
      return true;
    }
  }
  return false;
}

async function setCheckbox(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "boolean") return false;
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (!control) continue;
    const checked = await control.isChecked().catch(() => false);
    if (checked !== item.value) await control.click({ force: true, timeout: 5_000 });
    return true;
  }
  return false;
}

async function fillVisibleFields(page: Page, plan: PhEtravelFieldPlanItem[], completed: Set<string>): Promise<string[]> {
  const newlyFilled: string[] = [];
  for (const item of plan) {
    if (completed.has(item.key) && item.required && item.portalName) {
      const named = page.locator(`input[name="${item.portalName}"]`);
      const count = await named.count().catch(() => 0);
      if (count > 0) {
        const inputType = await named.first().getAttribute("type").catch(() => null);
        const retained = inputType === "radio"
          ? normalizedChoiceText(
            await page.locator(`input[type="radio"][name="${item.portalName}"]:checked`).first().getAttribute("value").catch(() => "") ?? "",
          ) === expectedRadioValue(item)
          : Boolean(await named.first().inputValue().catch(() => ""));
        if (!retained) completed.delete(item.key);
      } else {
        completed.delete(item.key);
      }
    }
    if (completed.has(item.key) || item.value === null || item.value === "") continue;
    const filled = item.kind === "choice"
      ? await selectChoice(page, item)
      : item.kind === "checkbox"
        ? await setCheckbox(page, item)
        : await fillTextOrDate(page, item);
    if (filled) {
      completed.add(item.key);
      newlyFilled.push(item.key);
    }
  }
  return newlyFilled;
}

async function clickVisibleButton(page: Page, pattern: RegExp): Promise<boolean> {
  const target = await firstVisible([
    page.getByRole("button", { name: pattern }),
    page.locator("button, a, [role='button']").filter({ hasText: pattern }),
  ]);
  if (!target || !await target.isEnabled().catch(() => false)) return false;
  await target.click({ force: true, timeout: 10_000 });
  return true;
}

async function selectInitialRegistrationChoice(
  page: Page,
  choice: PhEtravelInitialRegistrationChoice,
): Promise<boolean> {
  const namedRadio = page.locator(
    `input[type="radio"][name="${choice.key}"][value="${choice.value}"]`,
  ).first();
  if (await namedRadio.isVisible().catch(() => false)) {
    await namedRadio.check({ force: true, timeout: 5_000 }).catch(() => undefined);
    return namedRadio.isChecked().catch(() => false);
  }

  const roleRadio = page.getByRole("radio", { name: choice.label }).first();
  if (await roleRadio.isVisible().catch(() => false)) {
    await roleRadio.check({ force: true, timeout: 5_000 }).catch(async () => {
      await roleRadio.click({ force: true, timeout: 5_000 }).catch(() => undefined);
    });
    return roleRadio.isChecked().catch(() => false);
  }

  const label = page.locator("label").filter({ hasText: choice.label }).first();
  if (!await label.isVisible().catch(() => false)) return false;
  await label.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  const nestedRadio = label.locator("input[type='radio']").first();
  if (await nestedRadio.count().catch(() => 0)) {
    return nestedRadio.isChecked().catch(() => false);
  }
  const selectedCard = page.locator("[role='radio'][aria-checked='true']").filter({ hasText: choice.label }).first();
  return selectedCard.isVisible().catch(() => false);
}

async function chooseInitialRegistration(page: Page, completed: Set<string>, payload: PhEtravelPortalPayload): Promise<boolean> {
  const portalText = await page.locator("body").innerText().catch(() => "");
  if (!/Travel Registration/i.test(portalText)) return false;

  let registrationPlan;
  try {
    registrationPlan = buildPhEtravelInitialRegistrationPlan(payload);
  } catch (error) {
    if (!(error instanceof PhEtravelInitialRegistrationError)) throw error;
    throw new PhEtravelFormFillError(error.message, error.code, error.code);
  }
  for (const choice of registrationPlan.choices) {
    if (!await selectInitialRegistrationChoice(page, choice)) {
      throw new PhEtravelFormFillError(
        `Official eTravel did not retain the expected ${choice.value} registration choice.`,
        "ph_etravel_initial_registration_selection_failed",
        choice.key,
      );
    }
    completed.add(choice.key);
  }

  // The consent record only authorizes Continue. It is deliberately not added
  // to the official field plan or submission payload.
  completed.add("registration_consent_authorized");

  if (registrationPlan.continuation === "for_other_action_required") {
    throw new PhEtravelFormFillError(
      "Philippines eTravel FOR OTHER continuation is not verified after the selected Travel Registration branch.",
      "ph_etravel_arrival_for_other_action_required",
      "registration_for",
    );
  }

  const passportHolderPattern = payload.arrivalBranch?.passportHolderType === "FILIPINO" || payload.passportHolderType === "FILIPINO"
    ? /PHILIPPINE\s+PASSPORT|FILIPINO/i
    : /FOREIGN\s+PASSPORT|FOREIGNER/i;
  const passportHolder = page.getByRole("radio", { name: passportHolderPattern }).first();
  if (await passportHolder.isVisible().catch(() => false)) {
    await passportHolder.check({ force: true, timeout: 5_000 }).catch(() => undefined);
    if (!await passportHolder.isChecked().catch(() => false)) {
      throw new PhEtravelFormFillError(
        "Official eTravel did not retain the expected passport-holder choice.",
        "ph_etravel_initial_registration_selection_failed",
        "passport_holder_type",
      );
    }
    completed.add("passport_holder_type");
  }

  const specialFlight = await firstVisible([page.getByLabel(/Special Flight/i)]);
  if (specialFlight) {
    const checked = await specialFlight.isChecked().catch(() => false);
    if (checked !== payload.isSpecialFlight) {
      await specialFlight.click({ force: true, timeout: 5_000 });
    }
    completed.add("is_special_flight");
  }
  return true;
}

async function checkReviewDeclarations(page: Page): Promise<void> {
  const checkboxes = page.locator("input[type='checkbox']:visible, [role='checkbox']:visible");
  const count = await checkboxes.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (!await checkbox.isChecked().catch(() => false)) {
      await checkbox.click({ force: true, timeout: 5_000 });
    }
  }
}

export async function fillPhEtravelOfficialDeclaration(
  page: Page,
  payload: PhEtravelPortalPayload,
  options: {
    stopBeforeSubmit: boolean;
    onStep?: (name: string) => Promise<void>;
    beforeSubmit?: () => Promise<void>;
  },
): Promise<PhEtravelFormFillResult> {
  if (payload.travelType === "ARRIVAL") {
    const profileOwnedPlan = buildPhEtravelProfileOwnedActionPlan();
    throw new PhEtravelFormFillError(
      "Philippines eTravel profile-owned photo, mobile, and residence controls need controlled live and server review before browser filling.",
      "ph_etravel_launch_profile_persona_review_required",
      profileOwnedPlan.blockingCodes.join(", "),
    );
  }
  const completed = new Set<string>();
  const isSeaArrival = payload.travelType === "ARRIVAL" &&
    (payload.transportType === "SEA" || payload.arrivalBranch?.transportType === "SEA");
  const seaPortFlow = isSeaArrival
    ? await loadPhEtravelSeaPortFlowMetadata(payload.portOfEntry)
    : null;
  if (seaPortFlow?.status === "action_required") {
    throw new PhEtravelFormFillError(
      "Philippines eTravel needs the current official SEA destination-port metadata before choosing a customs flow.",
      "ph_etravel_sea_port_flow_action_required",
      seaPortFlow.code,
    );
  }
  const plan = buildPhEtravelFieldPlan(payload, await loadOfficialLabels());
  const structuredCustomsGate = phEtravelStructuredCustomsActionRequired(payload, seaPortFlow);
  if (structuredCustomsGate.length > 0) {
    throw new PhEtravelFormFillError(
      "Philippines eTravel customs/currency declaration needs operator review because structured official controls are not fully automated.",
      "ph_etravel_structured_customs_action_required",
      structuredCustomsGate.join(", "),
    );
  }
  let portalText = await page.locator("body").innerText().catch(() => "");
  const postSignatureEvidencePath = phEtravelPostSignatureEvidencePath({ payload, seaPortFlow });
  const postSignatureSemantics: PhEtravelPostSignatureSemantic[] = [];

  if (/dashboard|etravel registration|travel declaration|my travel/i.test(portalText)) {
    const opened = await clickVisibleButton(page, /new travel declaration|new declaration|register travel|travel declaration|new registration/i);
    if (opened) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
      await options.onStep?.("declaration-opened");
    }
  }

  for (let step = 1; step <= 24; step += 1) {
    portalText = await page.locator("body").innerText().catch(() => "");
    if (seaPortFlow) {
      const pageKind = classifyPhEtravelSeaCustomsPage(portalText);
      const pageFlow = pageKind === "electronic_customs_confirmation"
        ? "shared_confirmation"
        : pageKind === "manual_forms_notice"
          ? "manual"
          : pageKind === "electronic_other_travel_details" ||
          pageKind === "electronic_signature_required"
          ? "electronic"
          : null;
      if (pageFlow) {
        const pageGate = verifyPhEtravelSeaPortFlowPage({ metadata: seaPortFlow, pageFlow });
        if (pageGate.status === "action_required") {
          throw new PhEtravelFormFillError(
            "Philippines eTravel SEA customs page does not match the selected destination-port metadata.",
            "ph_etravel_sea_port_flow_action_required",
            pageGate.code,
          );
        }
      }
    }
    const postSignatureSemantic = classifyPhEtravelPostSignatureSemantic(portalText);
    const postSignatureGuard = postSignatureSemantic
      ? guardPhEtravelPostSignatureWizardStep({
          route: resolvePhEtravelWizardRoute(page.url()),
          evidencePath: postSignatureEvidencePath,
          semantic: postSignatureSemantic,
          previous: postSignatureSemantics,
        })
      : null;
    if (postSignatureSemantic && postSignatureGuard?.status === "action_required") {
      throw new PhEtravelFormFillError(
        "Philippines eTravel post-signature wizard step needs operator review before continuation.",
        postSignatureGuard.code,
        postSignatureGuard.code,
      );
    }
    if (postSignatureSemantic) postSignatureSemantics.push(postSignatureSemantic);
    const preReviewGate = classifyPhEtravelPreReviewGate(portalText);
    if (preReviewGate) {
      throw new PhEtravelFormFillError(
        preReviewGate === "signature_required"
          ? "Philippines eTravel requires a declaration signature before Review."
          : "Philippines eTravel requires operator confirmation of the Family Member(s) companion gate before Review.",
        preReviewGate === "signature_required"
          ? "ph_etravel_signature_required"
          : "ph_etravel_family_companion_confirmation",
        preReviewGate,
      );
    }
    await chooseInitialRegistration(page, completed, payload);
    const confirmation = isPhEtravelConfirmationText(portalText);
    if (confirmation) {
      await options.onStep?.("confirmation");
      return { reachedReview: true, submitted: true, portalText, filledFields: [...completed] };
    }
    if (/enter email address|create an account|login|password/i.test(portalText) && !/travel details|travel registration/i.test(portalText)) {
      throw new PhEtravelFormFillError(
        "Official eTravel session is not authenticated before form filling.",
        "ph_etravel_form_authentication_required",
        portalText.slice(0, 700),
      );
    }

    const reviewSubmitControl = await firstVisible([
      page.getByRole("button", { name: /^submit$|submit declaration|confirm and submit|complete registration/i }),
      page.locator("button, [role='button']").filter({ hasText: /^\s*(?:submit|submit declaration|confirm and submit|complete registration)\s*$/i }),
    ]);
    // Intermediate customs pages are titled "Customs Declaration
    // Confirmation" but still contain unanswered Yes/No questions. A real
    // Review state must expose the final submission control; title text alone
    // is not success evidence.
    const review = Boolean(reviewSubmitControl) &&
      isPhEtravelReviewSummaryText(portalText);
    if (review) {
      await options.onStep?.("review");
      if (options.stopBeforeSubmit || postSignatureGuard?.status === "review_stop_only") {
        return { reachedReview: true, submitted: false, portalText, filledFields: [...completed] };
      }
      await checkReviewDeclarations(page);
      await options.beforeSubmit?.();
      if (!await clickVisibleButton(page, /^submit$|submit declaration|confirm and submit|complete registration/i)) {
        throw new PhEtravelFormFillError(
          "Official eTravel Review page did not expose an enabled Submit control.",
          "ph_etravel_submit_control_missing",
          portalText.slice(0, 700),
        );
      }
      await page.waitForTimeout(1_000);
      await clickVisibleButton(page, /^confirm$|yes,? submit|proceed/i).catch(() => false);
      await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      continue;
    }

    const newlyFilled = await fillVisibleFields(page, plan, completed);
    await closeHotelLookup(page);
    if (newlyFilled.length > 0) await options.onStep?.(`form-step-${step}`);
    const advanced = await clickVisibleButton(page, /^next$|^continue$|save and continue|proceed/i);
    if (!advanced) {
      // The customs confirmation flow uses the Yes/No answer itself as the
      // submit action and shows loading spinners instead of a separate Next
      // button. Wait for its SPA transition before classifying the page as a
      // validation failure.
      const autoAdvanced = newlyFilled.length > 0
        ? await page.waitForFunction(
            (previousText) => (document.body?.innerText ?? "").trim() !== previousText.trim(),
            portalText,
            { timeout: 20_000 },
          ).then(() => true).catch(() => false)
        : false;
      if (autoAdvanced) {
        await page.waitForTimeout(1_500);
        continue;
      }
      const errors = await page.locator("[role='alert'], .error, .invalid-feedback, .text-danger").allInnerTexts().catch(() => []);
      throw new PhEtravelFormFillError(
        newlyFilled.length === 0
          ? "Official eTravel form selectors no longer match the visible page."
          : "Official eTravel form did not enable the next step after filling visible fields.",
        newlyFilled.length === 0 ? "ph_etravel_selector_drift" : "ph_etravel_step_validation_failed",
        `${portalText}\n${errors.join(" | ")}`.slice(0, 700),
      );
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }

  portalText = await page.locator("body").innerText().catch(() => "");
  throw new PhEtravelFormFillError(
    "Official eTravel form exceeded the supported step count before Review.",
    "ph_etravel_form_step_limit_exceeded",
    portalText.slice(0, 700),
  );
}
