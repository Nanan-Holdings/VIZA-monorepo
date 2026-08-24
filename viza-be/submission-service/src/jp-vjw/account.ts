import { randomBytes } from "node:crypto";

export const JP_VJW_PORTAL_EMAIL_KEY = "japan.vjw.portal.email";
export const JP_VJW_PORTAL_PASSWORD_KEY = "japan.vjw.portal.password";
export const JP_VJW_PORTAL_REGISTRATION_STATE_KEY = "japan.vjw.portal.registration_state";

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
  aliasEmail: string;
  correlationId: string;
}): Promise<PreparedJpVjwAccount> {
  const { applicantVault } = await import("../applicant-vault.js");
  const opts = { actor: "submission-service:jp-vjw", correlationId: input.correlationId };
  const [storedEmail, storedPassword, storedRegistrationState] = await Promise.all([
    applicantVault.get(input.applicantId, JP_VJW_PORTAL_EMAIL_KEY, opts),
    applicantVault.get(input.applicantId, JP_VJW_PORTAL_PASSWORD_KEY, opts),
    applicantVault.get(input.applicantId, JP_VJW_PORTAL_REGISTRATION_STATE_KEY, opts),
  ]);
  const account = resolveJpVjwAccountState({
    aliasEmail: input.aliasEmail,
    storedEmail,
    storedPassword,
    storedRegistrationState,
    generatedPassword: generateJpVjwPortalPassword(),
  });
  if (!account.reuseExistingAccount) {
    await applicantVault.set(input.applicantId, JP_VJW_PORTAL_EMAIL_KEY, account.email, {
      ...opts,
      note: "Application-scoped Visit Japan Web managed alias",
    });
    await applicantVault.set(input.applicantId, JP_VJW_PORTAL_PASSWORD_KEY, account.password, {
      ...opts,
      note: "VIZA-managed Visit Japan Web portal password",
    });
    await applicantVault.set(input.applicantId, JP_VJW_PORTAL_REGISTRATION_STATE_KEY, "pending", {
      ...opts,
      note: "Visit Japan Web account registration state",
    });
  }
  return account;
}

export async function markJpVjwAccountRegistered(input: {
  applicantId: string;
  correlationId: string;
}): Promise<void> {
  const { applicantVault } = await import("../applicant-vault.js");
  await applicantVault.set(input.applicantId, JP_VJW_PORTAL_REGISTRATION_STATE_KEY, "registered", {
    actor: "submission-service:jp-vjw",
    correlationId: input.correlationId,
    note: "Visit Japan Web account verified by official email code",
  });
}
