const BYTE_ORDER_MARK = "\uFEFF";

/**
 * Environment files edited by some Windows tools can leave a Unicode BOM at
 * the edge of a value. Supabase copies the API key into an HTTP Authorization
 * header, where that character is invalid and otherwise causes an opaque
 * ByteString conversion error before the auth request is sent.
 */
export function normalizeSupabaseEnvValue(
  value: string | undefined,
  name: string
): string {
  const normalized = value?.replace(/^\uFEFF+|\uFEFF+$/g, "").trim();

  if (!normalized) {
    throw new Error(`Missing ${name}`);
  }

  if (normalized.includes(BYTE_ORDER_MARK)) {
    throw new Error(`${name} contains an unexpected Unicode BOM`);
  }

  return normalized;
}
