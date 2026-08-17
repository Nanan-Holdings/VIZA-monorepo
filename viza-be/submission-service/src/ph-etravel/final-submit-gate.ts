export const PH_ETRAVEL_FINAL_SUBMIT_ENABLED = false;

export interface PhEtravelFinalSubmitAuthorization {
  scope: "PH_ETRAVEL_ARRIVAL_CARD";
  authorizationId: string;
  singleUse: true;
}

export type PhEtravelFinalSubmitGate =
  | { status: "authorized" }
  | { status: "blocked"; code: string };

const consumedAuthorizations = new WeakSet<PhEtravelFinalSubmitAuthorization>();

function isSafeAuthorizationId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._:-]{7,159}$/i.test(value);
}

/**
 * The live runner passes the static false flag. The override exists solely for
 * focused contract tests of the single-use boundary; it is not a runtime flag.
 */
export function consumePhEtravelFinalSubmitAuthorization(input: {
  finalSubmitEnabled: boolean;
  authorization?: PhEtravelFinalSubmitAuthorization;
}): PhEtravelFinalSubmitGate {
  if (!input.finalSubmitEnabled) {
    return { status: "blocked", code: "ph_etravel_final_submit_disabled" };
  }
  const authorization = input.authorization;
  if (!authorization || authorization.scope !== "PH_ETRAVEL_ARRIVAL_CARD" || authorization.singleUse !== true ||
    !isSafeAuthorizationId(authorization.authorizationId)) {
    return { status: "blocked", code: "ph_etravel_final_submit_authorization_required" };
  }
  if (consumedAuthorizations.has(authorization)) {
    return { status: "blocked", code: "ph_etravel_final_submit_authorization_consumed" };
  }
  consumedAuthorizations.add(authorization);
  return { status: "authorized" };
}
