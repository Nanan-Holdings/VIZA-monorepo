import { randomBytes } from "node:crypto";

export const JP_VJW_LEGACY_PORTAL_EMAIL_KEY = "japan.vjw.portal.email";
export const JP_VJW_LEGACY_PORTAL_PASSWORD_KEY = "japan.vjw.portal.password";
export const JP_VJW_LEGACY_PORTAL_REGISTRATION_STATE_KEY = "japan.vjw.portal.registration_state";

export function getJpVjwPortalCredentialKeys(applicationId: string) {
  const normalizedApplicationId = applicationId.trim();
  if (!normalizedApplicationId) {
    throw new JpVjwAccountStateError("Visit Japan Web application ID is required for credential isolation.");
  }
  const prefix = `japan.vjw.${normalizedApplicationId}.portal`;
  return {
    email: `${prefix}.email`,
    password: `${prefix}.password`,
    registrationState: `${prefix}.registration_state`,
  } as const;
}

export type JpVjwRegistrationState = "pending" | "registered";

export interface PreparedJpVjwAccount {
  email: string;
  password: string;
  registrationState: JpVjwRegistrationState;
  reuseExistingAccount: boolean;
}

export class JpVjwAccountStateError extends Error {
  readonly code = "jp_vjw_account_state_invalid";

  constructor(message: string) {
    super(message);
    this.name = "JpVjwAccountStateError";
  }
}

function randomCharacter(characters: string): string {
  return characters[randomBytes(1)[0] % characters.length];
}

export function generateJpVjwPortalPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!";
  const all = upper + lower + digits + symbols;
  const characters = [
    randomCharacter(upper),
    randomCharacter(lower),
    randomCharacter(digits),
    randomCharacter(symbols),
  ];
  while (characters.length < 16) characters.push(randomCharacter(all));
  return characters
    .map((character) => ({ character, sort: randomBytes(2).readUInt16BE(0) }))
    .sort((left, right) => left.sort - right.sort)
    .map((entry) => entry.character)
    .join("");
}

export function resolveJpVjwAccountState(input: {
  aliasEmail: string;
  storedEmail: string | null;
  storedPassword: string | null;
  storedRegistrationState: string | null;
  generatedPassword: string;
}): PreparedJpVjwAccount {
  const aliasEmail = input.aliasEmail.trim().toLowerCase();
  const storedEmail = input.storedEmail?.trim().toLowerCase() || null;
  const hasStoredEmail = Boolean(storedEmail);
  const hasStoredPassword = Boolean(input.storedPassword);
  if (hasStoredEmail !== hasStoredPassword) {
    throw new JpVjwAccountStateError("Visit Japan Web vault contains a partial credential pair.");
  }
  if (storedEmail && storedEmail !== aliasEmail) {
    throw new JpVjwAccountStateError("Visit Japan Web vault email does not match the application-scoped alias.");
  }
  if (storedEmail && input.storedPassword) {
    return {
      email: storedEmail,
      password: input.storedPassword,
      registrationState: input.storedRegistrationState === "registered" ? "registered" : "pending",
      reuseExistingAccount: true,
    };
  }
  return {
    email: aliasEmail,
    password: input.generatedPassword,
    registrationState: "pending",
    reuseExistingAccount: false,
  };
}

export async function prepareJpVjwManagedAccount(input: {
  applicantId: string;
  applicationId: string;
  aliasEmail: string;
  correlationId: string;
}): Promise<PreparedJpVjwAccount> {
  const { applicantVault } = await import("../applicant-vault.js");
  const opts = { actor: "submission-service:jp-vjw", correlationId: input.correlationId };
  const keys = getJpVjwPortalCredentialKeys(input.applicationId);
  let [storedEmail, storedPassword, storedRegistrationState] = await Promise.all([
    applicantVault.get(input.applicantId, keys.email, opts),
    applicantVault.get(input.applicantId, keys.password, opts),
    applicantVault.get(input.applicantId, keys.registrationState, opts),
  ]);

  const hasScopedCredentialData = Boolean(storedEmail || storedPassword || storedRegistrationState);
  if (!hasScopedCredentialData) {
    const [legacyEmail, legacyPassword, legacyRegistrationState] = await Promise.all([
      applicantVault.get(input.applicantId, JP_VJW_LEGACY_PORTAL_EMAIL_KEY, opts),
      applicantVault.get(input.applicantId, JP_VJW_LEGACY_PORTAL_PASSWORD_KEY, opts),
      applicantVault.get(input.applicantId, JP_VJW_LEGACY_PORTAL_REGISTRATION_STATE_KEY, opts),
    ]);
    const normalizedAlias = input.aliasEmail.trim().toLowerCase();
    const normalizedLegacyEmail = legacyEmail?.trim().toLowerCase() ?? null;
    if (legacyEmail && normalizedLegacyEmail === normalizedAlias) {
      if (!legacyPassword) {
        throw new JpVjwAccountStateError("Visit Japan Web legacy vault contains a partial credential pair.");
      }
      storedEmail = legacyEmail;
      storedPassword = legacyPassword;
      storedRegistrationState = legacyRegistrationState;
      await Promise.all([
        applicantVault.set(input.applicantId, keys.email, legacyEmail, {
          ...opts,
          note: "Migrated application-scoped Visit Japan Web managed alias",
        }),
        applicantVault.set(input.applicantId, keys.password, legacyPassword, {
          ...opts,
          note: "Migrated application-scoped Visit Japan Web portal password",
        }),
        applicantVault.set(
          input.applicantId,
          keys.registrationState,
          legacyRegistrationState === "registered" ? "registered" : "pending",
          { ...opts, note: "Migrated Visit Japan Web account registration state" },
        ),
      ]);
    }
  }
  const account = resolveJpVjwAccountState({
    aliasEmail: input.aliasEmail,
    storedEmail,
    storedPassword,
    storedRegistrationState,
    generatedPassword: generateJpVjwPortalPassword(),
  });
  if (!account.reuseExistingAccount) {
    await applicantVault.set(input.applicantId, keys.email, account.email, {
      ...opts,
      note: "Application-scoped Visit Japan Web managed alias",
    });
    await applicantVault.set(input.applicantId, keys.password, account.password, {
      ...opts,
      note: "VIZA-managed Visit Japan Web portal password",
    });
    await applicantVault.set(input.applicantId, keys.registrationState, "pending", {
      ...opts,
      note: "Visit Japan Web account registration state",
    });
  }
  return account;
}

export async function markJpVjwAccountRegistered(input: {
  applicantId: string;
  applicationId: string;
  correlationId: string;
}): Promise<void> {
  const { applicantVault } = await import("../applicant-vault.js");
  const keys = getJpVjwPortalCredentialKeys(input.applicationId);
  await applicantVault.set(input.applicantId, keys.registrationState, "registered", {
    actor: "submission-service:jp-vjw",
    correlationId: input.correlationId,
    note: "Visit Japan Web account verified by official email code",
  });
}
