import { NextResponse } from "next/server";
import { translateWithGoogleV2 } from "@/lib/translation/google-translate-v2";

interface TranslateRequest {
  text?: unknown;
  source?: unknown;
  sourceLanguage?: unknown;
  target?: unknown;
  targetLanguage?: unknown;
  fieldId?: unknown;
  fieldType?: unknown;
  context?: unknown;
}

const NON_TRANSLATABLE_FIELD_PATTERNS = [
  /(?:^|_)(passport|document|confirmation|application)_?(?:no|num|number|id|code)(?:_|$)/i,
  /(?:^|_)(date|dob|expiry|expiration|issued_at|issue_date)(?:_|$)/i,
  /(?:^|_)(email|phone|telephone|mobile|wechat|url)(?:_|$)/i,
  /(?:^|_)(country_code|iso|iata|icao|currency|amount|price|fee)(?:_|$)/i,
];

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusForCode(code: "invalid_request" | "provider_unavailable" | "provider_failed") {
  if (code === "invalid_request") return 400;
  if (code === "provider_unavailable") return 503;
  return 502;
}

export function shouldSkipTranslation(fieldId: string, text: string) {
  const normalizedFieldId = fieldId.trim();
  if (normalizedFieldId && NON_TRANSLATABLE_FIELD_PATTERNS.some((pattern) => pattern.test(normalizedFieldId))) {
    return true;
  }

  const normalizedText = text.trim();
  if (!normalizedText) return true;
  return /^[\d\s+().,/-]+$/.test(normalizedText) || /^[A-Z]{2,3}$/.test(normalizedText);
}

export async function POST(request: Request) {
  let payload: TranslateRequest;
  try {
    payload = (await request.json()) as TranslateRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_request", error: "Invalid JSON" }, { status: 400 });
  }

  const text = readString(payload.text);
  const sourceLanguage = readString(payload.source) || readString(payload.sourceLanguage) || null;
  const targetLanguage = readString(payload.target) || readString(payload.targetLanguage);
  const fieldId = readString(payload.fieldId) || readString(payload.fieldType);
  const context = readString(payload.context);

  if (!text || !targetLanguage) {
    return NextResponse.json(
      { ok: false, code: "invalid_request", error: "Missing text or target language" },
      { status: 400 },
    );
  }

  if (shouldSkipTranslation(fieldId, text)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      translatedText: text,
      reason: "non_translatable_field",
    });
  }

  const result = await translateWithGoogleV2({
    text,
    sourceLanguage,
    targetLanguage,
    fieldType: fieldId || context || null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.error, debugId: crypto.randomUUID() },
      { status: statusForCode(result.code) },
    );
  }

  return NextResponse.json({
    ok: true,
    translatedText: result.translatedText,
    detectedSourceLanguage: result.detectedSourceLanguage ?? null,
    provider: result.provider,
  });
}
