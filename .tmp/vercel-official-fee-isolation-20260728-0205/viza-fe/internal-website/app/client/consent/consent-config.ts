export const CONSENT_DOCUMENTS = [
  {
    consentType: "terms_of_service",
    title: "Terms of Service",
    shortTitle: "ToS",
    version: "2026-05-19",
    href: "/terms",
    documentHash:
      "sha256:f77f54b9367ddafb8ab66018e3ed07f82dfc2b269a27280e92f8fb0990a3ab57",
    summary:
      "Platform terms covering VIZA account use, service boundaries, applicant responsibilities, fees, and liability limits.",
  },
  {
    consentType: "privacy_policy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    version: "2026-05-19",
    href: "/privacy",
    documentHash:
      "sha256:e79ff0eaf46afc3afa2be2691e82a2f7f6c9ec54e36fb851373310233b36e41e",
    summary:
      "Data handling notice for applicant information, documents, processing, sharing, retention, and privacy rights.",
  },
  {
    consentType: "agency_authorisation",
    title: "Agency Authorisation",
    shortTitle: "Authorisation",
    version: "2026-05-19",
    href: null,
    documentHash:
      "sha256:13833f3c1a57eb894da05efb96819d2d4232abb9d48949829134d9f3e36d6c9f",
    summary:
      "Mandate allowing VIZA staff and systems to prepare application materials, coordinate document review, and package handoff steps for this application.",
  },
  {
    consentType: "alias_email_forwarding",
    title: "Official Email Forwarding / 官方邮件转发授权",
    shortTitle: "Email forwarding / 邮件转发",
    version: "2026-07-22",
    href: null,
    documentHash:
      "sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212",
    summary:
      "Authorises VIZA to forward copies of official visa emails received at your dedicated VIZA alias to your profile email. Messages may contain verification codes, status notices, QR codes, PDFs, and attachments. Mailbox ownership verification may also be required before forwarding becomes active.",
  },
] as const;

export const AGENCY_AUTHORISATION_DOCUMENT = CONSENT_DOCUMENTS[2];
export const AGENCY_SIGNATURE_TYPE = "agency_authorisation";

export type ConsentType = (typeof CONSENT_DOCUMENTS)[number]["consentType"];
export type SignatureMode = "typed" | "drawn";

export interface ConsentApplication {
  id: string;
  country: string;
  visaType: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
  packetStatus: string | null;
  externalStatus: string | null;
  countryName: string;
  countryNameZh: string;
  countryFlag: string;
  visaTypeLabel: string;
  visaTypeLabelZh: string;
}

export interface ConsentDocumentStatus {
  consentType: ConsentType;
  title: string;
  shortTitle: string;
  version: string;
  href: string | null;
  documentHash: string;
  summary: string;
  accepted: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  currentVersionAccepted: boolean;
}

export interface ConsentHistoryEvent {
  id: string;
  consentType: ConsentType;
  title: string;
  version: string;
  acceptedAt: string | null;
  documentHash: string | null;
}

export interface SignatureStatus {
  currentVersionSigned: boolean;
  signerName: string | null;
  signedAt: string | null;
  documentHash: string | null;
  signatureMode: SignatureMode | "unknown" | null;
}

export interface ConsentDocumentCounts {
  total: number;
  ready: number;
  missing: number;
  rejected: number;
}

export interface ConsentProgressCounts {
  answerCount: number;
  hasPhoto: boolean;
  documents: ConsentDocumentCounts;
}

export interface NextConsentStep {
  key:
    | "start_application"
    | "complete_consent"
    | "sign_authorisation"
    | "fill_application"
    | "upload_documents"
    | "view_status";
  href: string;
  label: string;
  reason: string;
}

export interface ConsentSubmissionInput {
  applicationId: string;
  acceptedConsentTypes: ConsentType[];
  signature?: {
    signerName: string;
    signatureText: string;
    mode: SignatureMode;
  };
}

export interface ConsentSubmissionResult {
  success: boolean;
  error?: string;
  nextHref?: string;
}
