type FvAccountRow = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

export interface FranceVisasAccountBrowserProjection {
  /** Always null: the login is encrypted with a key this app does not hold. */
  email: null;
  configured: true;
  verificationStatus: "unknown";
  portalUrl: string;
  updatedAt: string | null;
}

export const FRANCE_VISAS_PORTAL_URL = "https://application-form.france-visas.gouv.fr/fv-fo-dde/";

export function toBrowserSafeFranceVisasAccount(
  account: FvAccountRow,
): FranceVisasAccountBrowserProjection {
  return {
    email: null,
    configured: true,
    // fv_accounts has no persisted email-verification state. Keep this
    // explicitly unknown instead of presenting account existence as verified.
    verificationStatus: "unknown",
    portalUrl: FRANCE_VISAS_PORTAL_URL,
    updatedAt: account.updated_at ?? account.created_at ?? null,
  };
}
