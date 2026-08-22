import { NextResponse } from "next/server";
import { translateWithGoogleV2 } from "@/lib/translation/google-translate-v2";
import { shouldSkipTranslation as shouldSkipTranslationByRule } from "@/lib/translation/translation-field-rules";

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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusForCode(code: "invalid_request" | "provider_unavailable" | "provider_failed") {
  if (code === "invalid_request") return 400;
  if (code === "provider_unavailable") return 503;
  return 502;
}

export function shouldSkipTranslation(fieldId: string, text: string, fieldType?: string | null) {
  return shouldSkipTranslationByRule(fieldId, text, fieldType);
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
  const fieldType = readString(payload.fieldType);
  const context = readString(payload.context);

  if (!text || !targetLanguage) {
    return NextResponse.json(
      { ok: false, code: "invalid_request", error: "Missing text or target language" },
      { status: 400 },
    );
  }

  if (shouldSkipTranslation(fieldId, text, fieldType)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      translatedText: text,
      reason: "non_translatable_field",
      cached: false,
    });
  }

  const result = await translateWithGoogleV2({
    text,
    sourceLanguage,
    targetLanguage,
    fieldType: fieldId || fieldType || context || null,
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
    provider: result.provider === "google" ? "google_cloud_basic" : result.provider,
    cached: false,
  });
}
