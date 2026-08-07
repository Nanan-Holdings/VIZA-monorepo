import { NextRequest, NextResponse } from "next/server";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeFormAssistantRateLimit } from "@/lib/form-assistant/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "gpt-4o-mini-transcribe";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 60_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
};

const SUPPORTED_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/wave",
  "audio/x-m4a",
  "audio/x-wav",
]);

type ApplicationRow = {
  id: string;
  applicant_id: string;
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function extensionForFilename(filename: string): string {
  const lower = filename.trim().toLowerCase();
  const lastDot = lower.lastIndexOf(".");
  return lastDot >= 0 ? lower.slice(lastDot) : "";
}

function normalizedAudioMime(file: File): string | null {
  const directMime = file.type.trim().toLowerCase();
  const baseMime = directMime.split(";", 1)[0]?.trim() ?? directMime;
  if (SUPPORTED_MIME_TYPES.has(baseMime)) {
    // OpenAI accepts these aliases, but normalizing them keeps the multipart
    // payload predictable across browsers.
    if (baseMime === "audio/m4a" || baseMime === "audio/x-m4a") return "audio/mp4";
    if (baseMime === "audio/wave" || baseMime === "audio/x-wav") return "audio/wav";
    return baseMime;
  }

  // Some browsers provide application/octet-stream (or no type) for a local
  // recording. Only use the filename in that case; never turn an explicitly
  // unsupported audio MIME into an accepted format.
  if (directMime && directMime !== "application/octet-stream") return null;
  return MIME_BY_EXTENSION[extensionForFilename(file.name)] ?? null;
}

function safeFilename(filename: string, mimeType: string): string {
  const extension = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0] ?? ".webm";
  const basename = filename.split(/[\\/]/).at(-1)?.trim() ?? "";
  return basename && basename.includes(".") ? basename : `voice${extension}`;
}

function languageCode(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  if (/^[a-z]{2,3}$/.test(normalized)) return normalized;
  return null;
}

async function loadOwnedApplication(applicationId: string, applicantId: string): Promise<ApplicationRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .eq("applicant_id", applicantId)
    .maybeSingle();
  return (data as ApplicationRow | null) ?? null;
}

async function transcribeAudio(file: File, language: string | null): Promise<{
  transcript: string;
  detectedLanguage?: string;
  durationMs?: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    throw new TranscriptionError("provider_unavailable", "Voice transcription is temporarily unavailable.", 503);
  }

  const mimeType = normalizedAudioMime(file);
  if (!mimeType) {
    throw new TranscriptionError("unsupported_file", "Unsupported audio format.", 415);
  }

  const bytes = await file.arrayBuffer();
  // Check the bytes as well as File.size. This protects the upstream request
  // when a test/client supplies a File with an inaccurate size value.
  if (bytes.byteLength === 0) {
    throw new TranscriptionError("empty_file", "The audio recording is empty.", 422);
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new TranscriptionError("file_too_large", "Audio files must be 10 MB or smaller.", 413);
  }

  const openAiBody = new FormData();
  openAiBody.append("file", new Blob([bytes], { type: mimeType }), safeFilename(file.name, mimeType));
  openAiBody.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_MODEL);
  openAiBody.append("response_format", "json");
  if (language) openAiBody.append("language", language);

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
  try {
    response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openAiBody,
      signal: controller.signal,
    });
  } catch {
    throw new TranscriptionError("provider_unavailable", "Voice transcription is temporarily unavailable.", 503);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Do not relay the provider response: it can contain request metadata and
    // is not useful to applicants. Keep the route's error contract stable.
    throw new TranscriptionError("provider_failed", "Voice transcription failed.", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TranscriptionError("provider_failed", "Voice transcription failed.", 502);
  }

  if (!isRecord(payload) || typeof payload.text !== "string" || !payload.text.trim()) {
    throw new TranscriptionError("provider_failed", "Voice transcription failed.", 502);
  }

  const detectedLanguage = typeof payload.language === "string" && payload.language.trim()
    ? payload.language.trim()
    : undefined;
  const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) && payload.duration >= 0
    ? Math.round(payload.duration * 1000)
    : undefined;

  return {
    transcript: payload.text.trim(),
    ...(detectedLanguage ? { detectedLanguage } : {}),
    ...(duration !== undefined ? { durationMs: duration } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

class TranscriptionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "TranscriptionError";
    this.code = code;
    this.status = status;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getUserFromSupabaseSession();
  if (!session?.userId) {
    return jsonError("Sign in before using voice transcription.", 401);
  }
  if (!consumeFormAssistantRateLimit(`transcribe:${session.userId}`, { limit: 12, windowMs: 60_000 })) {
    return jsonError("Too many transcription requests. Please try again shortly.", 429);
  }

  const { id: applicationId } = await context.params;
  if (!applicationId?.trim()) {
    return jsonError("Application id is required.", 400);
  }

  const application = await loadOwnedApplication(applicationId, session.userId);
  if (!application) {
    return jsonError("Forbidden.", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Request must be multipart form data.", 400);
  }

  const entry = formData.get("audio") ?? formData.get("file") ?? formData.get("audioFile");
  if (!isAudioFile(entry)) {
    return jsonError("An audio file is required.", 400);
  }

  if (entry.size > MAX_AUDIO_BYTES) {
    return jsonError("Audio files must be 10 MB or smaller.", 413);
  }

  if (!normalizedAudioMime(entry)) {
    return jsonError("Unsupported audio format. Use WebM, MP4, OGG, M4A, or WAV.", 415);
  }

  try {
    const result = await transcribeAudio(entry, languageCode(formData.get("language")));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TranscriptionError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Voice transcription failed.", 502);
  }
}
