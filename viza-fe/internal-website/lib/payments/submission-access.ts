import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureGovernmentFeeAllocation } from "@/lib/checkout/payment-provisioning";
import { officialFeeCatalogFor } from "@/lib/payments/official-fee-catalog";
import { pricingFor } from "@/lib/pricing";

export const APPLICATION_PAYMENT_REQUIRED = "application_payment_required";

export type SubmissionAccessStatus =
  | "ready"
  | "payment_required"
  | "review_required";

export type SubmissionAccessLevel = "standard" | "high";

export type SubmissionFeeStatus =
  | "required"
  | "paid"
  | "waived"
  | "not_required"
  | "offline"
  | "review_required";

export interface SubmissionFeeDecision {
  status: SubmissionFeeStatus;
  amountCents: number;
  amountDueCents: number;
  currency: string;
}

export interface SubmissionAccessDecision {
  status: SubmissionAccessStatus;
  accessLevel: SubmissionAccessLevel;
  agencyFee: SubmissionFeeDecision;
  officialFee: SubmissionFeeDecision;
  entitlementId: string | null;
  orderId: string | null;
  paymentRecordId: string | null;
  allocationId: string | null;
  accessGrantId: string | null;
  checkoutUrl: string | null;
  returnTo: string;
  reason: string | null;
}

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  purpose: string | null;
  visa_package_id: string | null;
  group_id: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
}

interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  dependant_of_user_id: string | null;
}

interface AccessGrantRow {
  id: string;
  auth_user_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
}

interface EntitlementRow {
  application_id: string;
  payer_auth_user_id: string;
  access_level: SubmissionAccessLevel;
  access_grant_id: string | null;
  grant_locked_at: string | null;
  agency_fee_status: SubmissionFeeStatus;
  agency_fee_amount_cents: number;
  official_fee_status: SubmissionFeeStatus;
  official_fee_amount_cents: number;
  currency: string;
  order_id: string | null;
  payment_record_id: string | null;
  government_fee_allocation_id: string | null;
  decision_status: SubmissionAccessStatus;
  decision_reason: string | null;
  locked_at: string | null;
}

interface OrderRow {
  id: string;
  status: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  created_at: string;
}

interface PaymentRecordRow {
  id: string;
  order_id: string | null;
  status: string;
  fee_type: string;
  amount_cents: number;
  currency: string;
  updated_at: string;
}

interface AllocationRow {
  id: string;
  order_id: string;
  order_line_id: string | null;
  amount_cents: number;
  currency: string;
  state: string;
  created_at: string;
}

interface VisaPackageRow {
  id: string;
  price_cents: number | null;
  currency: string | null;
}

export interface EvaluateSubmissionAccessOptions {
  payerAuthUserId?: string | null;
  /** Final-review evaluation locks a currently valid high-access grant. */
  lockHighAccess?: boolean;
  returnTo?: string;
  checkoutUrl?: string | null;
}

const PAID_ORDER_STATUSES = new Set(["paid", "submitted", "completed"]);
const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "success", "complete", "completed"]);
const REVIEW_ORDER_STATUSES = new Set(["refunded", "disputed", "chargeback"]);
const REVIEW_PAYMENT_STATUSES = new Set([
  "refunded",
  "partially_refunded",
  "disputed",
  "chargeback",
]);
const ELIGIBLE_ALLOCATION_STATES = new Set([
  "reserved_pending_treasury",
  "reserved",
  "issuable",
  "card_issued",
  "portal_processing",
  "consumed",
]);

function canonicalPricing(country: string, visaType: string) {
  return pricingFor(
    country,
    visaType.trim().toUpperCase() === "B211A" ? "ID_C1_TOURIST" : visaType,
  );
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = (value ?? "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function validGrantAt(grant: AccessGrantRow, now: Date): boolean {
  if (grant.status !== "active") return false;
  if (grant.starts_at && new Date(grant.starts_at) > now) return false;
  return !grant.expires_at || new Date(grant.expires_at) > now;
}

function fee(
  status: SubmissionFeeStatus,
  amountCents: number,
  currency: string,
): SubmissionFeeDecision {
  return {
    status,
    amountCents,
    amountDueCents: status === "required" ? amountCents : 0,
    currency,
  };
}

function decisionStatus(
  agency: SubmissionFeeDecision,
  official: SubmissionFeeDecision,
): SubmissionAccessStatus {
  if (agency.status === "review_required" || official.status === "review_required") {
    return "review_required";
  }
  if (agency.status === "required" || official.status === "required") {
    return "payment_required";
  }
  return "ready";
}

function decisionReason(
  status: SubmissionAccessStatus,
  agency: SubmissionFeeDecision,
  official: SubmissionFeeDecision,
): string | null {
  if (status === "ready") return null;
  if (status === "review_required") {
    return agency.status === "review_required"
      ? "agency_payment_review_required"
      : "official_fee_review_required";
  }
  if (agency.status === "required" && official.status === "required") {
    return "agency_and_official_fee_required";
  }
  return agency.status === "required" ? "agency_fee_required" : "official_fee_required";
}

async function loadEntitlement(
  admin: SupabaseClient,
  applicationId: string,
): Promise<EntitlementRow | null> {
  const { data, error } = await admin
    .from("application_submission_entitlements")
    .select(
      "application_id, payer_auth_user_id, access_level, access_grant_id, grant_locked_at, agency_fee_status, agency_fee_amount_cents, official_fee_status, official_fee_amount_cents, currency, order_id, payment_record_id, government_fee_allocation_id, decision_status, decision_reason, locked_at",
    )
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`submission entitlement lookup: ${error.message}`);
  return (data as EntitlementRow | null) ?? null;
}

async function activeGrantFor(
  admin: SupabaseClient,
  authUserId: string,
  now: Date,
): Promise<AccessGrantRow | null> {
  const { error: expiryError } = await admin.rpc("expire_applicant_access_grants", {
    p_auth_user_id: authUserId,
  });
  if (expiryError) throw new Error(`high-access expiry reconciliation: ${expiryError.message}`);
  const { data, error } = await admin
    .from("applicant_access_grants")
    .select("id, auth_user_id, status, starts_at, expires_at")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`high-access lookup: ${error.message}`);
  return ((data as AccessGrantRow[] | null) ?? []).find((grant) => validGrantAt(grant, now)) ?? null;
}

async function applicationOrders(
  admin: SupabaseClient,
  applicationId: string,
): Promise<OrderRow[]> {
  const { data, error } = await admin
    .from("order")
    .select("id, status, agency_fee_cents, govt_fee_cents, currency, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`submission order lookup: ${error.message}`);
  return (data as OrderRow[] | null) ?? [];
}

async function applicationPayments(
  admin: SupabaseClient,
  applicationId: string,
): Promise<PaymentRecordRow[]> {
  const { data, error } = await admin
    .from("payment_records")
    .select("id, order_id, status, fee_type, amount_cents, currency, updated_at")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`submission payment lookup: ${error.message}`);
  return (data as PaymentRecordRow[] | null) ?? [];
}

async function applicationAllocations(
  admin: SupabaseClient,
  applicationId: string,
): Promise<AllocationRow[]> {
  const { data, error } = await admin
    .from("government_fee_allocations")
    .select("id, order_id, order_line_id, amount_cents, currency, state, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`government-fee allocation lookup: ${error.message}`);
  return (data as AllocationRow[] | null) ?? [];
}

async function persistDecision(
  admin: SupabaseClient,
  params: {
    application: ApplicationRow;
    payerAuthUserId: string;
    existing: EntitlementRow | null;
    accessLevel: SubmissionAccessLevel;
    accessGrantId: string | null;
    agency: SubmissionFeeDecision;
    official: SubmissionFeeDecision;
    orderId: string | null;
    paymentRecordId: string | null;
    allocationId: string | null;
    status: SubmissionAccessStatus;
    reason: string | null;
    lockHighAccess: boolean;
  },
): Promise<string> {
  const now = new Date().toISOString();
  const grantLockedAt = params.existing?.grant_locked_at
    ?? (params.lockHighAccess && params.accessLevel === "high" ? now : null);
  const payload = {
    application_id: params.application.id,
    payer_auth_user_id: params.payerAuthUserId,
    access_level: params.accessLevel,
    access_grant_id: params.accessGrantId,
    grant_locked_at: grantLockedAt,
    agency_fee_status: params.agency.status,
    agency_fee_amount_cents: params.agency.amountCents,
    official_fee_status: params.official.status,
    official_fee_amount_cents: params.official.amountCents,
    currency: params.agency.currency,
    order_id: params.orderId,
    payment_record_id: params.paymentRecordId,
    government_fee_allocation_id: params.allocationId,
    decision_status: params.status,
    decision_reason: params.reason ?? "ready",
    locked_at: params.existing?.locked_at ?? (params.status === "ready" ? now : null),
    updated_at: now,
  };
  const { data, error } = await admin
    .from("application_submission_entitlements")
    .upsert(payload, { onConflict: "application_id" })
    .select("application_id")
    .single();
  if (error || !data) {
    throw new Error(`submission entitlement persist: ${error?.message ?? "no row"}`);
  }
  return String(data.application_id);
}

/**
 * Canonical server-side evaluator for the final submission boundary.
 *
 * It recognizes application-scoped legacy payments, locks a currently valid
 * high-access waiver on first final-review evaluation, and persists one
 * entitlement snapshot. It never accepts a payment from another application.
 */
export async function evaluateSubmissionAccess(
  admin: SupabaseClient,
  applicationId: string,
  options: EvaluateSubmissionAccessOptions = {},
): Promise<SubmissionAccessDecision> {
  const returnTo = options.returnTo ?? `/client/application/long-form?applicationId=${encodeURIComponent(applicationId)}&step=review`;
  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, purpose, visa_package_id, group_id, government_fee_cents, government_fee_currency")
    .eq("id", applicationId)
    .single();
  if (applicationError || !applicationData) {
    throw new Error(`submission application lookup: ${applicationError?.message ?? "not found"}`);
  }
  const application = applicationData as ApplicationRow;

  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id, dependant_of_user_id")
    .eq("id", application.applicant_id)
    .single();
  if (profileError || !profileData) {
    throw new Error(`submission payer lookup: ${profileError?.message ?? "not found"}`);
  }
  const profile = profileData as ProfileRow;
  let groupPayerAuthUserId: string | null = null;
  if (application.group_id) {
    const { data: group, error: groupError } = await admin
      .from("application_group")
      .select("payer_user_id")
      .eq("id", application.group_id)
      .maybeSingle();
    if (groupError || !group?.payer_user_id) {
      throw new Error(`submission group payer lookup: ${groupError?.message ?? "not found"}`);
    }
    groupPayerAuthUserId = String(group.payer_user_id);
  }
  const authoritativePayer = groupPayerAuthUserId
    ?? profile.auth_user_id
    ?? profile.dependant_of_user_id;
  if (options.payerAuthUserId && options.payerAuthUserId !== authoritativePayer) {
    throw new Error("submission payer does not own this application");
  }
  const payerAuthUserId = options.payerAuthUserId ?? authoritativePayer;
  if (!payerAuthUserId) throw new Error("submission payer is not linked to an auth account");

  const pricing = canonicalPricing(application.country, application.visa_type);
  const catalog = officialFeeCatalogFor(application.country, application.visa_type);
  let packageRow: VisaPackageRow | null = null;
  if (application.visa_package_id) {
    const { data: packageData, error: packageError } = await admin
      .from("visa_packages")
      .select("id, price_cents, currency")
      .eq("id", application.visa_package_id)
      .maybeSingle();
    if (packageError) throw new Error(`submission package lookup: ${packageError.message}`);
    packageRow = (packageData as VisaPackageRow | null) ?? null;
  }
  const currency = normalizeCurrency(
    pricing?.currency ?? application.government_fee_currency ?? packageRow?.currency,
  );
  const now = new Date();

  const [existing, orders, payments] = await Promise.all([
    loadEntitlement(admin, applicationId),
    applicationOrders(admin, applicationId),
    applicationPayments(admin, applicationId),
  ]);
  const lockedHighAccess = existing?.access_level === "high" && Boolean(existing.grant_locked_at);
  const activeGrant = lockedHighAccess
    ? null
    : await activeGrantFor(admin, payerAuthUserId, now);
  const accessLevel: SubmissionAccessLevel = lockedHighAccess || activeGrant ? "high" : "standard";
  const accessGrantId = lockedHighAccess
    ? existing?.access_grant_id ?? null
    : activeGrant?.id ?? null;

  const hasReviewOrder = orders.some((order) => REVIEW_ORDER_STATUSES.has(order.status));
  const hasReviewPayment = payments.some((payment) => REVIEW_PAYMENT_STATUSES.has(payment.status));
  const paidOrders = orders.filter(
    (order) => PAID_ORDER_STATUSES.has(order.status) && normalizeCurrency(order.currency) === currency,
  );
  const paidAgencyRecord = payments.find(
    (payment) =>
      PAID_PAYMENT_STATUSES.has(payment.status)
      && payment.fee_type === "agency_fee"
      && normalizeCurrency(payment.currency) === currency,
  ) ?? null;

  const agencyAmount = Math.max(
    0,
    pricing?.agencyFeeCents ?? packageRow?.price_cents ?? 0,
  );
  const paidAgencyOrder = paidOrders.find(
    (order) => Number(order.agency_fee_cents) >= agencyAmount,
  ) ?? null;
  let agency: SubmissionFeeDecision;
  if (hasReviewOrder || hasReviewPayment) {
    agency = fee("review_required", agencyAmount, currency);
  } else if (accessLevel === "high") {
    agency = fee("waived", agencyAmount, currency);
  } else if (
    paidAgencyOrder
    || (paidAgencyRecord && Number(paidAgencyRecord.amount_cents) >= agencyAmount)
  ) {
    agency = fee("paid", agencyAmount, currency);
  } else if ((!pricing && !packageRow) || agencyAmount <= 0) {
    agency = fee("review_required", agencyAmount, currency);
  } else {
    agency = fee("required", agencyAmount, currency);
  }

  let allocations = await applicationAllocations(admin, applicationId);
  const officialAmount = Math.max(
    0,
    application.government_fee_cents ?? pricing?.govtFeeCents ?? 0,
  );
  const paidOfficialOrder = paidOrders.find(
    (order) => Number(order.govt_fee_cents) === officialAmount,
  ) ?? null;
  if (
    paidOfficialOrder
    && catalog?.fundingClass === "viza_managed_card"
    && officialAmount > 0
    && !allocations.some((allocation) => allocation.order_id === paidOfficialOrder.id)
  ) {
    try {
      await ensureGovernmentFeeAllocation(admin, paidOfficialOrder.id);
      allocations = await applicationAllocations(admin, applicationId);
    } catch {
      // The mismatch is converted to a review-required decision below.
    }
  }

  const matchingAllocation = allocations.find(
    (allocation) =>
      Number(allocation.amount_cents) === officialAmount
      && normalizeCurrency(allocation.currency) === currency
      && ELIGIBLE_ALLOCATION_STATES.has(allocation.state),
  ) ?? null;
  const mismatchedAllocation = allocations.some(
    (allocation) =>
      allocation.state === "review_required"
      || (allocation.state !== "released"
        && (Number(allocation.amount_cents) !== officialAmount
        || normalizeCurrency(allocation.currency) !== currency
        || !ELIGIBLE_ALLOCATION_STATES.has(allocation.state))),
  );
  const releasedWithoutReplacement =
    !matchingAllocation && allocations.some((allocation) => allocation.state === "released");

  let official: SubmissionFeeDecision;
  if (!catalog) {
    official = fee("review_required", officialAmount, currency);
  } else if (catalog.fundingClass === "free") {
    official = fee("not_required", 0, currency);
  } else if (catalog.fundingClass === "offline") {
    official = fee("offline", officialAmount, currency);
  } else if (officialAmount <= 0 || mismatchedAllocation || releasedWithoutReplacement) {
    official = fee("review_required", officialAmount, currency);
  } else if (matchingAllocation) {
    official = fee("paid", officialAmount, currency);
  } else {
    official = fee("required", officialAmount, currency);
  }

  const status = decisionStatus(agency, official);
  const reason = decisionReason(status, agency, official);
  const orderId = matchingAllocation?.order_id
    ?? paidOfficialOrder?.id
    ?? paidAgencyOrder?.id
    ?? existing?.order_id
    ?? null;
  const paymentRecordId = paidAgencyRecord?.id ?? existing?.payment_record_id ?? null;
  const entitlementId = await persistDecision(admin, {
    application,
    payerAuthUserId,
    existing,
    accessLevel,
    accessGrantId,
    agency,
    official,
    orderId,
    paymentRecordId,
    allocationId: matchingAllocation?.id ?? null,
    status,
    reason,
    lockHighAccess: options.lockHighAccess !== false,
  });

  return {
    status,
    accessLevel,
    agencyFee: agency,
    officialFee: official,
    entitlementId,
    orderId,
    paymentRecordId,
    allocationId: matchingAllocation?.id ?? null,
    accessGrantId,
    checkoutUrl: options.checkoutUrl ?? null,
    returnTo,
    reason,
  };
}

export function submissionAccessHttpBody(decision: SubmissionAccessDecision) {
  return {
    error: decision.status === "review_required"
      ? "Payment evidence requires manual review before this application can be submitted."
      : "Payment is required before this application can be submitted.",
    code: APPLICATION_PAYMENT_REQUIRED,
    decision,
    quote: {
      agencyFee: decision.agencyFee,
      officialFee: decision.officialFee,
    },
    checkoutUrl: decision.checkoutUrl,
    returnTo: decision.returnTo,
  };
}
