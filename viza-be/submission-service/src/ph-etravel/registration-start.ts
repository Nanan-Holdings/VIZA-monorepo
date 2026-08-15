import type { PhEtravelPortalPayload } from "./normalize";

export type PhEtravelRegistrationFor = "FOR_ME" | "FOR_OTHER";

export interface PhEtravelRegistrationConsentAuthorization {
  accepted: true;
  acceptedAt: string;
  version: string;
  source: string;
}

export interface PhEtravelInitialRegistrationChoice {
  key: "registration_for" | "transport_type" | "travel_type";
  value: "FOR_ME" | "FOR_OTHER" | "AIR" | "SEA" | "ARRIVAL";
  label: RegExp;
}

export interface PhEtravelInitialRegistrationPlan {
  choices: PhEtravelInitialRegistrationChoice[];
  consent: PhEtravelRegistrationConsentAuthorization;
  continuation: "ordinary_arrival" | "for_other_action_required";
}

export class PhEtravelInitialRegistrationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PhEtravelInitialRegistrationError";
  }
}

function validConsent(
  value: PhEtravelPortalPayload["registrationConsent"],
): value is PhEtravelRegistrationConsentAuthorization {
  if (!value || value.accepted !== true || !value.version.trim() || !value.source.trim()) return false;
  if (!/privacy/i.test(value.version) || !/affidavit/i.test(value.version) || !/audit/i.test(value.source)) return false;
  const acceptedAt = Date.parse(value.acceptedAt);
  return Number.isFinite(acceptedAt);
}

export function buildPhEtravelInitialRegistrationPlan(
  payload: PhEtravelPortalPayload,
): PhEtravelInitialRegistrationPlan {
  const registrationFor = payload.registrationFor?.trim().toUpperCase();
  if (registrationFor !== "FOR_ME" && registrationFor !== "FOR_OTHER") {
    throw new PhEtravelInitialRegistrationError(
      "Philippines eTravel registration target is missing or unsupported.",
      "ph_etravel_registration_for_action_required",
    );
  }
  if (payload.visaType !== "PH_ETRAVEL_ARRIVAL_CARD" || payload.travelType !== "ARRIVAL") {
    throw new PhEtravelInitialRegistrationError(
      "Philippines arrival-card runner requires the official ARRIVAL choice.",
      "ph_etravel_arrival_choice_action_required",
    );
  }
  const transportType = payload.arrivalBranch?.transportType ?? payload.transportType;
  if (transportType !== "AIR" && transportType !== "SEA") {
    throw new PhEtravelInitialRegistrationError(
      "Philippines eTravel mode of travel must be AIR or SEA.",
      "ph_etravel_transport_choice_action_required",
    );
  }
  if (!validConsent(payload.registrationConsent)) {
    throw new PhEtravelInitialRegistrationError(
      "Auditable VIZA Data Privacy and Affidavit consent is required before official Continue.",
      "ph_etravel_registration_consent_required",
    );
  }

  return {
    choices: [
      {
        key: "registration_for",
        value: registrationFor,
        label: registrationFor === "FOR_ME" ? /^FOR\s+ME\b/i : /^FOR\s+OTHER\b/i,
      },
      { key: "transport_type", value: transportType, label: transportType === "SEA" ? /^SEA$/i : /^AIR$/i },
      { key: "travel_type", value: "ARRIVAL", label: /ARRIVAL\s*Entering the Philippines/i },
    ],
    consent: payload.registrationConsent,
    continuation: registrationFor === "FOR_OTHER" ? "for_other_action_required" : "ordinary_arrival",
  };
}
