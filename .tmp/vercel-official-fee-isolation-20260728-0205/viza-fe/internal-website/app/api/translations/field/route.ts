import { NextResponse } from "next/server";
import { translateWithGoogleV2 } from "@/lib/translation/google-translate-v2";

interface FieldTranslationRequest {
  text?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
  fieldType?: unknown;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusForCode(code: "invalid_request" | "provider_unavailable" | "provider_failed") {
  if (code === "invalid_request") return 400;
  if (code === "provider_unavailable") return 503;
  return 502;
}

export async function POST(request: Request) {
  let payload: FieldTranslationRequest;
  try {
    payload = (await request.json()) as FieldTranslationRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_request", error: "Invalid JSON" }, { status: 400 });
  }

  const text = readString(payload.text);
  const targetLanguage = readString(payload.targetLanguage);
  if (!text || !targetLanguage) {
    return NextResponse.json(
      { ok: false, code: "invalid_request", error: "Missing text or target language" },
      { status: 400 },
    );
  }

  const result = await translateWithGoogleV2({
    text,
    sourceLanguage: readString(payload.sourceLanguage) || null,
    targetLanguage,
    fieldType: readString(payload.fieldType) || null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.error },
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
