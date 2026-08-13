/**
 * Simplified -> Traditional Chinese conversion, used for Taiwan's
 * `name_chinese` field: the real government form requires the applicant's
 * Chinese name in Traditional characters, but mainland Chinese applicants
 * naturally type in Simplified. This lazily loads the (relatively large,
 * ~1MB) opencc-js conversion dictionary only when actually needed, so it
 * never bloats the initial bundle for the many other countries/fields that
 * don't use it.
 *
 * Character-level conversion (not OpenCC's phrase-aware "tw2sp"-style
 * config) is intentional here: this is a name field, not idiomatic prose,
 * so there are no country/place-name-style phrases to disambiguate.
 */
let converterPromise: Promise<(text: string) => string> | null = null;

function getConverter(): Promise<(text: string) => string> {
  if (!converterPromise) {
    converterPromise = import("opencc-js/cn2t").then((OpenCC) =>
      OpenCC.Converter({ from: "cn", to: "tw" }),
    );
  }
  return converterPromise;
}

/** Converts Simplified Chinese text to Traditional Chinese. Returns the
 * original text unchanged if conversion fails for any reason. */
export async function convertSimplifiedToTraditional(text: string): Promise<string> {
  if (!text) return text;
  try {
    const converter = await getConverter();
    return converter(text);
  } catch {
    return text;
  }
}
