export type PassportOcrErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "application_not_found"
  | "document_not_found"
  | "missing_file"
  | "unsupported_file"
  | "provider_unavailable"
  | "unreadable"
  | "provider_failed";

export interface PassportOcrError {
  code: PassportOcrErrorCode;
  message: string;
  retryable?: boolean;
}

export interface PassportOcrFieldProposal {
  value: string | null;
  confidence: number | null;
}

export interface PassportOcrProposedFields {
  fullName: PassportOcrFieldProposal;
  givenNames: PassportOcrFieldProposal;
  surname: PassportOcrFieldProposal;
  passportNumber: PassportOcrFieldProposal;
  dateOfBirth: PassportOcrFieldProposal;
  placeOfBirth: PassportOcrFieldProposal;
  nationality: PassportOcrFieldProposal;
  issuingCountry: PassportOcrFieldProposal;
  issueDate: PassportOcrFieldProposal;
  expiryDate: PassportOcrFieldProposal;
  gender: PassportOcrFieldProposal;
}

export interface PassportOcrSuccessResponse {
  success: true;
  extractionId: string | null;
  applicationId: string;
  documentId: string;
  provider: string;
  confidence: number;
  proposedFields: PassportOcrProposedFields;
  needsConfirmation: true;
  warnings: string[];
}

export interface PassportOcrFailureResponse {
  success: false;
  error: PassportOcrError;
}

export type PassportOcrResponse = PassportOcrSuccessResponse | PassportOcrFailureResponse;

export type SupportedPassportMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface PassportOcrFile {
  bytes: Buffer;
  filename: string;
  mimeType: SupportedPassportMimeType;
}

export interface PassportOcrProviderResult {
  provider: string;
  confidence: number;
  isReadable: boolean;
  fields: PassportOcrProposedFields;
  warnings: string[];
}
