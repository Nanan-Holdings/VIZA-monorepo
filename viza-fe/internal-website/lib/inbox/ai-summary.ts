import "server-only";

import {
  INBOX_CATEGORIES,
  isInboxCategory,
  type InboxCategory,
} from "@/lib/inbox/categorize";

/**
 * AI reading pass for a single inbound email ("VIZA read this for you").
 *
 * Same transport conventions as app/api/field-guidance/route.ts: any
 * OpenAI-compatible /responses endpoint, strict JSON-schema output, hard
 * timeout, no SDK. The result is cached on inbound_email.ai_meta by the
 * calling server action, so each message is read at most once per language.
 * Never log message bodies here — official mail carries passport numbers and
 * one-time codes.
 */

const OPENAI_BASE_URL = (
  process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
).replace(/\/+$/, "");

const OPENAI_MODEL =
  process.env.OPENAI_INBOX_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.5";

const TIMEOUT_MS = 16000;
const MAX_BODY_CHARS = 6000;

export interface InboxAiDetail {
  label: string;
  value: string;
}

export interface InboxAiMeta {
  v: 1;
  lang: string;
  model: string;
  generatedAt: string;
  summary: string;
  details: InboxAiDetail[];
  category: InboxCategory | null;
  needsAction: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese (简体中文)",
  vi: "Vietnamese (Tiếng Việt)",
  es: "Spanish (Español)",
};

export function isInboxAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

interface OpenAiResponsePayload {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ text?: unknown }> }>;
}

function extractOutputText(payload: OpenAiResponsePayload): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n") ?? ""
  );
}

function parseDetails(value: unknown): InboxAiDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { label: unknown; value: unknown } =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label.trim() : "",
      value: typeof entry.value === "string" ? entry.value.trim() : "",
    }))
    .filter((entry) => entry.label && entry.value)
    .slice(0, 4);
}

export interface GenerateInboxAiMetaInput {
  fromAddr: string;
  subject: string | null;
  bodyText: string;
  locale: string;
}

/** Returns null when the provider is unavailable or the response is unusable. */
export async function generateInboxAiMeta({
  fromAddr,
  subject,
  bodyText,
  locale,
}: GenerateInboxAiMetaInput): Promise<InboxAiMeta | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const language = LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.en;
  const body = bodyText.slice(0, MAX_BODY_CHARS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_output_tokens: 500,
        instructions:
          `You read official visa correspondence on behalf of a VIZA applicant. ` +
          `Write for a stressed non-expert. Respond in ${language}. ` +
          `summary: 1-2 plain-language sentences saying what this email means for the applicant and what to do next, ` +
          `keeping concrete deadlines, reference numbers, amounts and places. ` +
          `details: up to 4 key facts as short label/value pairs (deadline, reference, required item, amount, location). ` +
          `category: the best matching folder. needs_action: whether the applicant personally has to do something. ` +
          `Return strict JSON only.`,
        input: `From: ${fromAddr}\nSubject: ${subject ?? "(no subject)"}\n\n${body}`,
        text: {
          format: {
            type: "json_schema",
            name: "inbox_reading",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                details: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" },
                    },
                    required: ["label", "value"],
                  },
                },
                category: { type: "string", enum: [...INBOX_CATEGORIES] },
                needs_action: { type: "boolean" },
              },
              required: ["summary", "details", "category", "needs_action"],
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as OpenAiResponsePayload;
    const outputText = extractOutputText(payload).trim();
    if (!outputText) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return null;
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const summary =
      typeof record.summary === "string" ? record.summary.trim() : "";
    if (!summary) return null;

    return {
      v: 1,
      lang: locale,
      model: OPENAI_MODEL,
      generatedAt: new Date().toISOString(),
      summary,
      details: parseDetails(record.details),
      category: isInboxCategory(record.category) ? record.category : null,
      needsAction: record.needs_action === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
