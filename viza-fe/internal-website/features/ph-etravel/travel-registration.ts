export const PH_ETRAVEL_ARRIVAL_FLIGHT_TYPE = "ARRIVAL" as const;
export const PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION =
  "ph_etravel_travel_registration_2026-08-15" as const;

export type PhEtravelRegistrationFor = "FOR_ME" | "FOR_OTHER";
export type PhEtravelRegistrationTransport = "AIR" | "SEA";

export type PhEtravelPrivacyAffidavitConsentInput = {
  affirmed?: boolean | null;
  acceptedAt?: string | null;
  version?: string | null;
};

export type PhEtravelPrivacyAffidavitConsentAudit = {
  kind: "privacy_and_affidavit";
  affirmed: true;
  acceptedAt: string;
  version: typeof PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION;
  scope: "viza_enqueue_gate_only";
  officialPayloadField: false;
};

export type PhEtravelTravelRegistrationInput = {
  flightType?: string | null;
  registrationFor?: string | null;
  transportType?: string | null;
  consent?: PhEtravelPrivacyAffidavitConsentInput | null;
};

export type PhEtravelTravelRegistrationAnswers = {
  flight_type: typeof PH_ETRAVEL_ARRIVAL_FLIGHT_TYPE;
  registration_for: PhEtravelRegistrationFor | "";
  transport_type: PhEtravelRegistrationTransport | "";
};

export type PhEtravelTravelRegistrationPresentation = {
  product: "PH_ETRAVEL_ARRIVAL_CARD";
  fields: [
    {
      key: "flight_type";
      label: { en: string; zh: string };
      control: "locked_value";
      value: typeof PH_ETRAVEL_ARRIVAL_FLIGHT_TYPE;
      officialLabel: "ARRIVAL — Entering the Philippines";
      exposedOptions: readonly ["ARRIVAL"];
      hiddenUnsupportedOptions: readonly ["DEPARTURE"];
    },
    {
      key: "registration_for";
      label: { en: string; zh: string };
      control: "radio";
      officialOptions: readonly [
        {
          value: "FOR_ME";
          label: { en: "FOR ME (Current User)"; zh: "本人（当前用户）" };
        },
        {
          value: "FOR_OTHER";
          label: { en: "FOR OTHER (Family Member)"; zh: "他人（家人）" };
        },
      ];
    },
    {
      key: "transport_type";
      label: { en: string; zh: string };
      control: "radio";
      officialOptions: readonly [
        { value: "AIR"; label: { en: "AIR"; zh: "航空" } },
        { value: "SEA"; label: { en: "SEA"; zh: "海运" } },
      ];
    },
    {
      key: "registration_data_privacy_affidavit_consent";
      label: { en: string; zh: string };
      control: "affirmative_consent";
      requiredForEnqueue: true;
      auditable: true;
      officialPayloadField: false;
    },
  ];
};

export type PhEtravelTravelRegistrationMissingItem = {
  key:
    | "registration.flight_type"
    | "registration.application_for"
    | "registration.transport_type"
    | "product.privacy_affidavit_consent";
  fieldName:
    | "flight_type"
    | "registration_for"
    | "transport_type"
    | "registration_data_privacy_affidavit_consent";
  label: { en: string; zh: string };
  reason: "missing" | "arrival_product_mismatch" | "consent_not_auditable";
  focusTarget: {
    stepNumber: 1;
    section: "Travel Registration";
    fieldName: string;
    anchor: string;
  };
};

export type PhEtravelTravelRegistrationNormalization = {
  answers: PhEtravelTravelRegistrationAnswers;
  consentAudit: PhEtravelPrivacyAffidavitConsentAudit | null;
  arrivalProductMismatch: boolean;
  missingItems: PhEtravelTravelRegistrationMissingItem[];
  canEnqueue: boolean;
};

const REGISTRATION_FOR_VALUES = new Set<PhEtravelRegistrationFor>([
  "FOR_ME",
  "FOR_OTHER",
]);
const TRANSPORT_VALUES = new Set<PhEtravelRegistrationTransport>([
  "AIR",
  "SEA",
]);

export const PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION: PhEtravelTravelRegistrationPresentation =
  {
    product: "PH_ETRAVEL_ARRIVAL_CARD",
    fields: [
      {
        key: "flight_type",
        label: { en: "Travel type", zh: "旅行方向" },
        control: "locked_value",
        value: "ARRIVAL",
        officialLabel: "ARRIVAL — Entering the Philippines",
        exposedOptions: ["ARRIVAL"],
        hiddenUnsupportedOptions: ["DEPARTURE"],
      },
      {
        key: "registration_for",
        label: { en: "Travel registration for", zh: "登记对象" },
        control: "radio",
        officialOptions: [
          {
            value: "FOR_ME",
            label: { en: "FOR ME (Current User)", zh: "本人（当前用户）" },
          },
          {
            value: "FOR_OTHER",
            label: { en: "FOR OTHER (Family Member)", zh: "他人（家人）" },
          },
        ],
      },
      {
        key: "transport_type",
        label: { en: "Mode of travel", zh: "交通方式" },
        control: "radio",
        officialOptions: [
          { value: "AIR", label: { en: "AIR", zh: "航空" } },
          { value: "SEA", label: { en: "SEA", zh: "海运" } },
        ],
      },
      {
        key: "registration_data_privacy_affidavit_consent",
        label: {
          en: "I have read the privacy notice and affirm the declaration.",
          zh: "我已阅读隐私说明，并确认申报内容真实无误。",
        },
        control: "affirmative_consent",
        requiredForEnqueue: true,
        auditable: true,
        officialPayloadField: false,
      },
    ],
  };

function normalizedUpper(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function parseRegistrationFor(
  value: string | null | undefined
): PhEtravelRegistrationFor | "" {
  const normalized = normalizedUpper(value) as PhEtravelRegistrationFor;
  return REGISTRATION_FOR_VALUES.has(normalized) ? normalized : "";
}

function parseTransport(
  value: string | null | undefined
): PhEtravelRegistrationTransport | "" {
  const normalized = normalizedUpper(value) as PhEtravelRegistrationTransport;
  return TRANSPORT_VALUES.has(normalized) ? normalized : "";
}

function parseConsentAudit(
  input: PhEtravelPrivacyAffidavitConsentInput | null | undefined
): PhEtravelPrivacyAffidavitConsentAudit | null {
  if (
    input?.affirmed !== true ||
    input.version !== PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION ||
    typeof input.acceptedAt !== "string"
  ) {
    return null;
  }
  const acceptedAt = input.acceptedAt.trim();
  const timestamp = Date.parse(acceptedAt);
  if (!acceptedAt || !Number.isFinite(timestamp)) return null;

  return {
    kind: "privacy_and_affidavit",
    affirmed: true,
    acceptedAt: new Date(timestamp).toISOString(),
    version: PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION,
    scope: "viza_enqueue_gate_only",
    officialPayloadField: false,
  };
}

function missingItem(
  key: PhEtravelTravelRegistrationMissingItem["key"],
  fieldName: PhEtravelTravelRegistrationMissingItem["fieldName"],
  label: PhEtravelTravelRegistrationMissingItem["label"],
  reason: PhEtravelTravelRegistrationMissingItem["reason"]
): PhEtravelTravelRegistrationMissingItem {
  return {
    key,
    fieldName,
    label,
    reason,
    focusTarget: {
      stepNumber: 1,
      section: "Travel Registration",
      fieldName,
      anchor: `field-${fieldName}`,
    },
  };
}

export function normalizePhEtravelTravelRegistration(
  input: PhEtravelTravelRegistrationInput
): PhEtravelTravelRegistrationNormalization {
  const suppliedFlightType = normalizedUpper(input.flightType);
  const arrivalProductMismatch =
    suppliedFlightType !== "" && suppliedFlightType !== "ARRIVAL";
  const answers: PhEtravelTravelRegistrationAnswers = {
    flight_type: "ARRIVAL",
    registration_for: parseRegistrationFor(input.registrationFor),
    transport_type: parseTransport(input.transportType),
  };
  const consentAudit = parseConsentAudit(input.consent);
  const missingItems: PhEtravelTravelRegistrationMissingItem[] = [];

  if (arrivalProductMismatch) {
    missingItems.push(
      missingItem(
        "registration.flight_type",
        "flight_type",
        { en: "Arrival registration", zh: "菲律宾入境申报" },
        "arrival_product_mismatch"
      )
    );
  }
  if (!answers.registration_for) {
    missingItems.push(
      missingItem(
        "registration.application_for",
        "registration_for",
        { en: "Registration for", zh: "登记对象" },
        "missing"
      )
    );
  }
  if (!answers.transport_type) {
    missingItems.push(
      missingItem(
        "registration.transport_type",
        "transport_type",
        { en: "Mode of travel", zh: "交通方式" },
        "missing"
      )
    );
  }
  if (!consentAudit) {
    missingItems.push(
      missingItem(
        "product.privacy_affidavit_consent",
        "registration_data_privacy_affidavit_consent",
        { en: "Privacy and affidavit consent", zh: "隐私与真实性确认" },
        "consent_not_auditable"
      )
    );
  }

  return {
    answers,
    consentAudit,
    arrivalProductMismatch,
    missingItems,
    canEnqueue: missingItems.length === 0,
  };
}

/** Consent is intentionally absent: it gates VIZA enqueue but is not an
 * official eTravel registration answer or payload field. */
export function createPhEtravelRegistrationAnswerProjection(
  normalized: PhEtravelTravelRegistrationNormalization
): PhEtravelTravelRegistrationAnswers {
  return { ...normalized.answers };
}
