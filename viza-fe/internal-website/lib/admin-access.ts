const PRODUCTION_ADMIN_EMAILS = [
  "czz19974931995@gmail.com",
  "edward.zehua.zhang@gmail.com",
  "fionatsui2017@gmail.com",
  "junjieran05@gmail.com",
  "e1484122@u.nus.edu",
  "nanan.viza2016@gmail.com",
] as const;

const PRODUCTION_ADMIN_EMAIL_SET = new Set<string>(PRODUCTION_ADMIN_EMAILS);
const LOCAL_TEST_ADMIN_EMAIL = "admin@viza.test";

export function normalizeAdminEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isAdminEmailAllowed(
  email: string | null | undefined,
  options: { allowLocalTestAdmin?: boolean } = {},
): boolean {
  const normalizedEmail = normalizeAdminEmail(email);
  const allowLocalTestAdmin =
    options.allowLocalTestAdmin ?? process.env.NODE_ENV !== "production";

  return (
    PRODUCTION_ADMIN_EMAIL_SET.has(normalizedEmail) ||
    (allowLocalTestAdmin && normalizedEmail === LOCAL_TEST_ADMIN_EMAIL)
  );
}

export const ADMIN_EMAIL_ALLOWLIST = PRODUCTION_ADMIN_EMAILS;
