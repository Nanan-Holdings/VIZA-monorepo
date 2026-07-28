import type { GenericSubmissionResult } from "../submission-result";

export type ImplementationStatus =
  | "implemented"
  | "sandbox_only"
  | "dry_run_only"
  | "partial"
  | "not_started"
  | "blocked";

export type FieldCategory =
  | "personal"
  | "passport"
  | "contact"
  | "trip"
  | "security"
  | "metadata"
  | "country_specific";

export interface FieldRequirement {
  key: string;
  label: string;
  category: FieldCategory;
  required: boolean;
  condition?: {
    key: string;
    equals?: string | boolean;
    notEquals?: string | boolean;
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
  category: FieldCategory;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  missingRequiredFields: string[];
}

export interface CountrySubmissionProfile {
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  passportIssuingCountry?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  employerOrSchool?: string | null;
}

export interface CountrySubmissionTrip {
  destinationCountry?: string | null;
  destinationCity?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  purpose?: string | null;
  accommodationName?: string | null;
  accommodationAddress?: string | null;
  funding?: string | null;
  budget?: string | null;
}

export interface CountrySubmissionApplication {
  applicationId: string;
  userId?: string | null;
  applicantId?: string | null;
  countryCode: string;
  visaType: string;
  profile: CountrySubmissionProfile;
  trip: CountrySubmissionTrip;
  answers?: Record<string, string | boolean | number | null | undefined>;
  metadata?: Record<string, unknown>;
}

export interface SubmissionPayload {
  payloadVersion: string;
  countryCode: string;
  visaType: string;
  applicationId: string;
  dryRun: boolean;
  idempotencyKey: string;
  personal: CountrySubmissionProfile;
  trip: CountrySubmissionTrip;
  countrySpecific: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface SubmitOptions {
  dryRun: boolean;
  idempotencyKey?: string;
}

export interface CountrySubmissionProvider {
  countryCode: string;
  displayName: string;
  supportedVisaTypes: string[];
  requiredFields: FieldRequirement[];
  schemaVersion: string;
  implementationStatus: ImplementationStatus;
  dryRunAvailable: boolean;
  sandboxAvailable: boolean;
  realSubmitAvailable: boolean;
  routeStatus:
    | "submission_queue_dispatched"
    | "frontend_only"
    | "package_catalog_only"
    | "module_only"
    | "not_registered";
  serviceFiles: string[];
  schemaFiles: string[];
  mapperFiles: string[];
  automationFiles: string[];
  notes: string;
  validate(application: CountrySubmissionApplication): ValidationResult;
  mapToSubmissionPayload(
    application: CountrySubmissionApplication,
    options?: SubmitOptions,
  ): SubmissionPayload;
  submit(
    payload: SubmissionPayload,
    options: SubmitOptions,
  ): Promise<GenericSubmissionResult>;
}
