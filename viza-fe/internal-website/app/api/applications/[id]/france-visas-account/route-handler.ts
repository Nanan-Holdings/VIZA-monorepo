type FvAccountRow = {
  id: string;
  applicant_id?: string | null;
  email?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export interface FranceVisasAccountBrowserProjection {
  email: string | null;
  configured: true;
  verificationStatus: "unknown";
  portalUrl: string;
  updatedAt: string | null;
}

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [localPart, domain] = value.split("@", 2);
  if (!localPart || !domain) return "••••";
  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  return `${visible}•••@${domain}`;
}

export function toBrowserSafeFranceVisasAccount(
  account: FvAccountRow,
): FranceVisasAccountBrowserProjection {
  return {
    email: maskEmail(account.email),
    configured: true,
    // fv_accounts has no persisted email-verification state. Keep this
    // explicitly unknown instead of presenting account existence as verified.
    verificationStatus: "unknown",
    portalUrl: "https://application-form.france-visas.gouv.fr/fv-fo-dde/",
    updatedAt: account.updated_at ?? account.created_at ?? null,
  };
}
