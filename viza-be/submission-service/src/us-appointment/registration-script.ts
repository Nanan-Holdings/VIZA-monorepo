import type { EnsureApplicantInboxAliasResult } from "../inbox/alias";
import { randomBytes } from "node:crypto";

type EnsureAlias = (applicantId: string) => Promise<EnsureApplicantInboxAliasResult>;

export interface ResolveUSAppointmentAccountEmailInput {
  explicitEmail?: string;
  applicantId?: string;
  ensureAlias: EnsureAlias;
}

export interface ResolvedUSAppointmentAccountEmail {
  email: string;
  source: "explicit" | "applicant_inbox_alias";
  aliasCreated: boolean;
}

export async function resolveUSAppointmentAccountEmail(
  input: ResolveUSAppointmentAccountEmailInput,
): Promise<ResolvedUSAppointmentAccountEmail> {
  const explicitEmail = input.explicitEmail?.trim();
  if (explicitEmail) {
    return {
      email: explicitEmail,
      source: "explicit",
      aliasCreated: false,
    };
  }

  const applicantId = input.applicantId?.trim();
  if (!applicantId) {
    throw new Error(
      "US appointment account email is required unless --applicant-id is provided for Email Worker alias registration.",
    );
  }

  const alias = await input.ensureAlias(applicantId);
  return {
    email: alias.alias.toLowerCase(),
    source: "applicant_inbox_alias",
    aliasCreated: alias.created,
  };
}

export function assertUSAppointmentAutoVerificationConfig(input: {
  autoVerifyEmail: boolean;
  applicantId?: string;
}): void {
  if (input.autoVerifyEmail && !input.applicantId?.trim()) {
    throw new Error(
      "Automatic US appointment email verification requires --applicant-id so VIZA can read the Email Worker inbound_email row.",
    );
  }
}

export function generateUSAppointmentAccountPassword(
  randomSource: (size: number) => Buffer = randomBytes,
): string {
  const token = randomSource(24)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6);
  return `VizaUS-${token}9!`;
}
