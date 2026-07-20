export interface VnPrearrivalTripTransitionFailure {
  code: string;
  message: string;
  portalSummary: string;
}

export function classifyVietnamPrearrivalTripTransitionFailure(
  bodyText: string,
): VnPrearrivalTripTransitionFailure {
  if (/invalid visa number/i.test(bodyText)) {
    return {
      code: "vn_prearrival_invalid_evisa_number",
      message:
        "Vietnam Pre-Arrival rejected the E-Visa number. Enter the exact 9-digit numeric value from the “Số / No.” line.",
      portalSummary:
        "The official portal rejected the E-Visa number before opening Trip Information. No submission was attempted.",
    };
  }

  return {
    code: "vn_prearrival_trip_information_form_not_ready",
    message:
      "Vietnam Pre-Arrival did not open Trip Information after validating the passenger details.",
    portalSummary:
      "The official portal remained on Passenger Information after Continue. Review the visible official validation message before retrying.",
  };
}
