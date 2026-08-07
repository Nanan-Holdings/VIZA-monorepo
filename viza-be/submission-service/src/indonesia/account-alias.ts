import { randomBytes } from "node:crypto";
import { applicantVault } from "../applicant-vault.js";
import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { assertInboxAliasDomainRoutable } from "../inbox/wait-for-message.js";

const INDONESIA_ALIAS_VERSION = "v2";
const CURRENT_EMAIL_KEY = "indonesia.portal.email";
const CURRENT_PASSWORD_KEY = "indonesia.portal.password";
const ALIAS_VERSION_KEY = "indonesia.portal.alias_version";
const LEGACY_EMAIL_KEY = "indonesia.portal.legacy.email";
const LEGACY_PASSWORD_KEY = "indonesia.portal.legacy.password";

export function generateIndonesiaPortalPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$*?";
  const all = upper + lower + digits + symbols;
  const characters = [
    upper[randomBytes(1)[0] % upper.length],
    lower[randomBytes(1)[0] % lower.length],
    digits[randomBytes(1)[0] % digits.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];
  while (characters.length < 12) {
    characters.push(all[randomBytes(1)[0] % all.length]);
  }
  return characters
    .map((character) => ({ character, sort: randomBytes(2).readUInt16BE(0) }))
    .sort((left, right) => left.sort - right.sort)
    .map((entry) => entry.character)
    .join("");
}

export class IndonesiaAliasPreflightError extends Error {
  constructor(
    readonly code:
      | "indonesia_alias_unavailable"
      | "indonesia_alias_forwarding_consent_required",
    message: string,
  ) {
    super(message);
    this.name = "IndonesiaAliasPreflightError";
  }
}

export interface PreparedIndonesiaAliasAccount {
  email: string;
  password: string;
  reuseExistingAccount: boolean;
  migrated: boolean;
}

export function resolveIndonesiaAliasMigration(input: {
  canonicalAlias: string;
  currentEmail: string | null;
  currentPassword: string | null;
  currentAliasVersion: string | null;
  generatedPassword: string;
}): Pick<
  PreparedIndonesiaAliasAccount,
  "email" | "password" | "reuseExistingAccount" | "migrated"
> {
  const email = input.canonicalAlias.trim().toLowerCase();
  const currentEmail = input.currentEmail?.trim().toLowerCase() || null;
  const reuseExistingAccount =
    input.currentAliasVersion === INDONESIA_ALIAS_VERSION &&
    currentEmail === email &&
    Boolean(input.currentPassword);
  return {
    email,
    password: reuseExistingAccount
      ? input.currentPassword!
      : input.generatedPassword,
    reuseExistingAccount,
    migrated:
      currentEmail !== email ||
      input.currentAliasVersion !== INDONESIA_ALIAS_VERSION,
  };
}

export async function prepareIndonesiaCanonicalAliasAccount(input: {
  applicantId: string;
  currentEmail: string | null;
  currentPassword: string | null;
  currentAliasVersion: string | null;
  generatedPassword: string;
  correlationId: string;
}): Promise<PreparedIndonesiaAliasAccount> {
  const vaultOpts = {
    actor: "submission-service:indonesia",
    correlationId: input.correlationId,
  };

  let canonicalAlias: string;
  try {
    const alias = await ensureApplicantInboxAlias(input.applicantId);
    canonicalAlias = alias.alias.trim().toLowerCase();
    await assertInboxAliasDomainRoutable(canonicalAlias);
  } catch (error) {
    throw new IndonesiaAliasPreflightError(
      "indonesia_alias_unavailable",
      `Indonesia official account alias is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let hasForwardingConsent: boolean;
  try {
    hasForwardingConsent = await hasAliasEmailForwardingConsent(input.applicantId);
  } catch (error) {
    throw new IndonesiaAliasPreflightError(
      "indonesia_alias_unavailable",
      `Indonesia alias forwarding authorization could not be verified: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!hasForwardingConsent) {
    throw new IndonesiaAliasPreflightError(
      "indonesia_alias_forwarding_consent_required",
      "Official email forwarding authorization is required before Indonesia B1/C1 can start.",
    );
  }

  const decision = resolveIndonesiaAliasMigration({
    canonicalAlias,
    currentEmail: input.currentEmail,
    currentPassword: input.currentPassword,
    currentAliasVersion: input.currentAliasVersion,
    generatedPassword: input.generatedPassword,
  });
  const currentEmail = input.currentEmail?.trim().toLowerCase() || null;

  if (decision.migrated && currentEmail) {
    await applicantVault.set(input.applicantId, LEGACY_EMAIL_KEY, currentEmail, {
      ...vaultOpts,
      note: "Read-only archive of the pre-v2 Indonesia portal account email",
    });
    if (input.currentPassword) {
      await applicantVault.set(
        input.applicantId,
        LEGACY_PASSWORD_KEY,
        input.currentPassword,
        {
          ...vaultOpts,
          note: "Read-only archive of the pre-v2 Indonesia portal account password",
        },
      );
    }
  }

  await applicantVault.set(input.applicantId, CURRENT_EMAIL_KEY, canonicalAlias, {
    ...vaultOpts,
    note: "Canonical v2 VIZA alias for the Indonesia eVisa portal",
  });
  await applicantVault.set(input.applicantId, CURRENT_PASSWORD_KEY, decision.password, {
    ...vaultOpts,
    note: "VIZA-managed Indonesia eVisa portal password",
  });
  await applicantVault.set(input.applicantId, ALIAS_VERSION_KEY, INDONESIA_ALIAS_VERSION, {
    ...vaultOpts,
    note: "Indonesia portal alias contract version",
  });

  return {
    ...decision,
  };
}
