import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** Legacy response shape; the ownership evaluator never emits an override. */
  paymentOverride?: {
    kind: "ds160_payment_deferred";
    scope: "ds160";
    financialStatus: "deferred";
  };
}


interface ApplicationRow { id: string; applicant_id: string; group_id: string | null; }
interface ProfileRow { id: string; auth_user_id: string | null; dependant_of_user_id: string | null; }

export interface EvaluateSubmissionAccessOptions {
  payerAuthUserId?: string | null;
  /** Legacy options are ignored; submission no longer depends on payment. */
  lockHighAccess?: boolean;
  allowDs160PaymentDefer?: boolean;
  returnTo?: string;
  checkoutUrl?: string | null;
}

/** Verifies application ownership without reading or writing financial records.
 * Fee fields remain only for older clients. They describe VIZA collection,
 * never evidence that an official portal fee has been paid.
 */
export async function evaluateSubmissionAccess(
  admin: SupabaseClient,
  applicationId: string,
  options: EvaluateSubmissionAccessOptions = {},
): Promise<SubmissionAccessDecision> {
  const returnTo = options.returnTo ?? `/client/application/long-form?applicationId=${encodeURIComponent(applicationId)}&step=review`;
  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, group_id")
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


  const noCollection: SubmissionFeeDecision = {
    status: "not_required", amountCents: 0, amountDueCents: 0, currency: "USD",
  };
  return {
    status: "ready", accessLevel: "standard",
    agencyFee: { ...noCollection }, officialFee: { ...noCollection },
    entitlementId: null, orderId: null, paymentRecordId: null,
    allocationId: null, accessGrantId: null, checkoutUrl: null,
    returnTo, reason: null,
  };
}
