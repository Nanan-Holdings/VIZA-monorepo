const GOOGLE_TRANSLATE_V2_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

export interface FieldTranslationInput {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage: string;
  fieldType?: string | null;
}

export type FieldTranslationResult =
  | {
      ok: true;
      translatedText: string;
      detectedSourceLanguage?: string | null;
      provider: "google";
    }
  | {
      ok: false;
      code: "invalid_request" | "provider_unavailable" | "provider_failed";
      error: string;
      provider: "google";
    };

interface GoogleTranslateV2Response {
  data?: {
    translations?: Array<{
      translatedText?: string;
      detectedSourceLanguage?: string;
    }>;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function getMaxChars() {
  const configured = Number.parseInt(process.env.TRANSLATION_MAX_CHARS_PER_REQUEST ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

function getApiKey() {
  return (
    clean(process.env.GOOGLE_TRANSLATE_API_KEY)
    || clean(process.env.CLOUD_TRANSLATE_API_KEY)
    || clean(process.env.GCP_TRANSLATE_API_KEY)
  );
}

function isGoogleTranslateEnabled() {
  const value = clean(process.env.GOOGLE_TRANSLATE_ENABLED).toLowerCase();
  return !["0", "false", "no", "off"].includes(value);
}

function getConfiguredProvider() {
  return clean(process.env.GOOGLE_TRANSLATE_PROVIDER) || clean(process.env.TRANSLATION_PROVIDER);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function readJson(response: Response): Promise<GoogleTranslateV2Response> {
  try {
    const value = await response.json();
    return typeof value === "object" && value !== null ? (value as GoogleTranslateV2Response) : {};
  } catch {
    return {};
  }
}

export async function translateWithGoogleV2(input: FieldTranslationInput): Promise<FieldTranslationResult> {
  const text = clean(input.text);
  const targetLanguage = clean(input.targetLanguage);
  const sourceLanguage = clean(input.sourceLanguage);

  if (!text || !targetLanguage) {
    return { ok: false, code: "invalid_request", error: "Missing text or target language", provider: "google" };
  }

  if (text.length > getMaxChars()) {
    return { ok: false, code: "invalid_request", error: "Translation text is too long", provider: "google" };
  }

  if (!isGoogleTranslateEnabled()) {
    return { ok: false, code: "provider_unavailable", error: "Google Translate is disabled", provider: "google" };
  }

  const configuredProvider = getConfiguredProvider().toLowerCase();
  const allowedProviders = new Set(["google", "google_cloud_basic", "google_translate_v2", "google_v2"]);
  if (configuredProvider && !allowedProviders.has(configuredProvider)) {
    return { ok: false, code: "provider_unavailable", error: "Translation provider is not Google", provider: "google" };
  }

  const apiVersion = clean(process.env.GOOGLE_TRANSLATE_API_VERSION).toLowerCase() || "v2";
  if (apiVersion !== "v2") {
    return { ok: false, code: "provider_unavailable", error: "Only Google Translate Basic v2 is configured", provider: "google" };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, code: "provider_unavailable", error: "Google Translate API key is not configured", provider: "google" };
  }

  const endpoint = new URL(GOOGLE_TRANSLATE_V2_ENDPOINT);
  endpoint.searchParams.set("key", apiKey);

  const body: Record<string, string> = {
    q: text,
    target: targetLanguage,
    format: "text",
  };
  if (sourceLanguage) body.source = sourceLanguage;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    return {
      ok: false,
      code: "provider_failed",
      error: payload.error?.message ?? "Google Translate request failed",
      provider: "google",
    };
  }

  const translation = payload.data?.translations?.[0];
  const translatedText = clean(decodeHtmlEntities(translation?.translatedText ?? ""));
  if (!translatedText) {
    return { ok: false, code: "provider_failed", error: "Google Translate returned an empty translation", provider: "google" };
  }

  return {
    ok: true,
    translatedText,
    detectedSourceLanguage: translation?.detectedSourceLanguage ?? null,
    provider: "google",
  };
}
