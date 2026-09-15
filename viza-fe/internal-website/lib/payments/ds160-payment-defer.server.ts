import "server-only";

import { isDs160VisaType } from "@/lib/submission-queue";
import type { SubmissionAccessDecision } from "@/lib/payments/submission-access";

/**
 * Local-only escape hatch for one explicitly selected DS-160 test application.
 *
 * The value is an application id rather than a boolean so accidentally
 * enabling this process-wide cannot release another applicant's submission.
 * Keep this variable server-only and unset by default. Production is always
 * denied, even when a stale environment value is present.
 */
export const DS160_PAYMENT_DEFER_APPLICATION_ID_ENV =
  "DS160_LOCAL_PAYMENT_DEFER_APPLICATION_ID" as const;

export const DS160_PAYMENT_DEFERRED_REASON = "payment_deferred_test_override" as const;

export interface Ds160PaymentDeferTarget {
  applicationId: string;
  country: string | null | undefined;
  visaType: string | null | undefined;
}

export interface Ds160PaymentDeferMetadata {
  kind: "ds160_payment_deferred";
  scope: "ds160";
  financialStatus: "deferred";
}

type Ds160PaymentDeferEnvironment = Partial<
  Record<"NODE_ENV" | typeof DS160_PAYMENT_DEFER_APPLICATION_ID_ENV, string>
>;

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isUnitedStatesCountry(country: string | null | undefined): boolean {
  return new Set([
    "UNITED_STATES",
    "UNITED_STATES_OF_AMERICA",
    "US",
    "USA",
  ]).has(normalizeKey(country));
}

export function isDs160PaymentDeferEnabled(
  target: Ds160PaymentDeferTarget,
  environment: Ds160PaymentDeferEnvironment = process.env,
): boolean {
  if ((environment.NODE_ENV ?? "").trim().toLowerCase() === "production") return false;

  const configuredApplicationId = environment[DS160_PAYMENT_DEFER_APPLICATION_ID_ENV]
    ?.trim()
    .toLowerCase();
  if (!configuredApplicationId) return false;

  return configuredApplicationId === target.applicationId.trim().toLowerCase()
    && isUnitedStatesCountry(target.country)
    && isDs160VisaType(target.visaType);
}

/**
 * Applies a narrowly scoped local payment deferral to an already authorized
 * submission decision. The fee decisions remain unchanged and required; only
 * the access status is made ready for the caller's one test run. Review or
 * otherwise non-payment decisions cannot be overridden.
 */
export function applyDs160PaymentDeferOverride(
  decision: SubmissionAccessDecision,
  target: Ds160PaymentDeferTarget,
  environment?: Ds160PaymentDeferEnvironment,
): SubmissionAccessDecision {
  if (!isDs160PaymentDeferEnabled(target, environment)) return decision;
  if (decision.status !== "payment_required") return decision;

  const paymentOverride: Ds160PaymentDeferMetadata = {
    kind: "ds160_payment_deferred",
    scope: "ds160",
    financialStatus: "deferred",
  };

  return {
    ...decision,
    status: "ready",
    reason: DS160_PAYMENT_DEFERRED_REASON,
    paymentOverride,
  };
}
