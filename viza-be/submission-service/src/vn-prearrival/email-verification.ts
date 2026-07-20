export type VnPrearrivalEmailVerificationState =
  | "pending"
  | "accepted"
  | "rejected";

export function classifyVnPrearrivalEmailVerificationText(
  text: string,
): VnPrearrivalEmailVerificationState {
  if (
    /submission is successful|submission processing progress|finalizing/i.test(text)
  ) {
    return "accepted";
  }
  if (
    /invalid|incorrect|expired|wrong code|verification failed|try again/i.test(text)
  ) {
    return "rejected";
  }
  return "pending";
}
