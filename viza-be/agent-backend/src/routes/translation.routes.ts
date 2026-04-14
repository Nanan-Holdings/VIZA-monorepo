/**
 * Application Translation Routes
 *
 * POST  /api/applications/:id/translate           — Translate Chinese fields to English via Google Cloud Translation
 * GET   /api/applications/:id/translations         — Fetch all translations for an application
 * PATCH /api/applications/:id/translations/:fieldKey — Edit a single translated field
 */

import { Router, Request, Response } from "express";
import { v2 } from "@google-cloud/translate";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const router = Router();
const logger = new Logger({ serviceName: "TranslationRoutes" });

// Chinese character detection regex (CJK Unified Ideographs + Extension A)
const HAS_CHINESE = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

// Fields to skip translation for (dates, IDs, enum values, etc.)
const SKIP_FIELDS = new Set([
  "date_of_birth",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "arrival_date",
  "departure_date",
  "email",
  "phone",
  "wechat",
  "gender",
]);

function getTranslateClient(): v2.Translate {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY or GOOGLE_TRANSLATE_API_KEY environment variable");
  }
  return new v2.Translate({ key: apiKey });
}

/**
 * Collect all translatable text fields from an application.
 * Returns a flat { field_key: source_text } object containing only fields with Chinese characters.
 */
function collectTranslatableFields(
  applicant: Record<string, unknown>,
  app: Record<string, unknown>,
  dynamicAnswers: Array<{ field_name: string; value_text: string | null }>
): Record<string, string> {
  const fields: Record<string, string> = {};

  // Profile fields
  const profileFields = [
    "full_name",
    "place_of_birth",
    "nationality",
    "occupation",
    "address",
  ];
  for (const key of profileFields) {
    const val = applicant[key];
    if (typeof val === "string" && val.trim() && HAS_CHINESE.test(val) && !SKIP_FIELDS.has(key)) {
      fields[key] = val;
    }
  }

  // Application fields
  const appFields = [
    "port_of_entry",
    "purpose",
    "accommodation_name",
    "accommodation_address",
  ];
  for (const key of appFields) {
    const val = app[key];
    if (typeof val === "string" && val.trim() && HAS_CHINESE.test(val) && !SKIP_FIELDS.has(key)) {
      fields[key] = val;
    }
  }

  // Dynamic visa form answers
  for (const answer of dynamicAnswers) {
    if (
      answer.value_text &&
      answer.value_text.trim() &&
      HAS_CHINESE.test(answer.value_text) &&
      !SKIP_FIELDS.has(answer.field_name)
    ) {
      fields[answer.field_name] = answer.value_text;
    }
  }

  return fields;
}

/**
 * POST /api/applications/:id/translate
 *
 * Gathers all application fields, filters for Chinese text, translates via Google Cloud Translation,
 * and upserts results into application_translations.
 */
router.post("/:id/translate", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: "Application ID is required" });
    return;
  }

  const supabase = getSupabaseClient();

  try {
    // Load application + profile
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("*, applicant_profiles(*)")
      .eq("id", id)
      .single();

    if (appError || !appData) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const app = appData as Record<string, unknown>;
    const applicant = (app.applicant_profiles as Record<string, unknown>) ?? {};

    // Load dynamic answers
    const { data: answers } = await supabase
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", id);

    const dynamicAnswers = (answers ?? []) as Array<{ field_name: string; value_text: string | null }>;

    // Collect fields that contain Chinese text
    const fieldsToTranslate = collectTranslatableFields(applicant, app, dynamicAnswers);

    const fieldKeys = Object.keys(fieldsToTranslate);
    if (fieldKeys.length === 0) {
      logger.info("No Chinese text fields to translate", { applicationId: id });
      res.status(200).json({ translated: true, count: 0, fields: {} });
      return;
    }

    // Translate all fields in a single batch call
    const translate = getTranslateClient();
    const textsToTranslate = fieldKeys.map((k) => fieldsToTranslate[k]);

    const [translations] = await translate.translate(textsToTranslate, {
      from: "zh",
      to: "en",
    });

    const translatedArray = Array.isArray(translations) ? translations : [translations];

    // Build result map and upsert rows
    const resultFields: Record<string, string> = {};
    const upsertRows = fieldKeys.map((key, i) => {
      const translatedText = translatedArray[i] ?? fieldsToTranslate[key];
      resultFields[key] = translatedText;
      return {
        application_id: id,
        field_key: key,
        source_text: fieldsToTranslate[key],
        translated_text: translatedText,
        source_lang: "zh",
        target_lang: "en",
        translated_by: "google",
        user_edited: false,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from("application_translations")
      .upsert(upsertRows, { onConflict: "application_id,field_key,target_lang" });

    if (upsertError) {
      logger.error("Failed to save translations", new Error(upsertError.message), { applicationId: id });
      res.status(500).json({ translated: false, error: "Failed to save translations" });
      return;
    }

    logger.info("Translation complete", { applicationId: id, fieldCount: fieldKeys.length });
    res.status(200).json({ translated: true, count: fieldKeys.length, fields: resultFields });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Translation failed", new Error(message), { applicationId: id });
    res.status(500).json({ translated: false, error: message });
  }
});

/**
 * GET /api/applications/:id/translations
 *
 * Returns all translations for an application as a map:
 * { [field_key]: { source_text, translated_text, user_edited } }
 */
router.get("/:id/translations", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("application_translations")
    .select("field_key, source_text, translated_text, user_edited")
    .eq("application_id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result: Record<string, { source_text: string; translated_text: string; user_edited: boolean }> = {};
  for (const row of (data ?? [])) {
    result[row.field_key] = {
      source_text: row.source_text,
      translated_text: row.translated_text,
      user_edited: row.user_edited,
    };
  }

  res.status(200).json(result);
});

/**
 * PATCH /api/applications/:id/translations/:fieldKey
 *
 * Update a single translation (user correction).
 * Sets user_edited = true.
 */
router.patch("/:id/translations/:fieldKey", async (req: Request, res: Response): Promise<void> => {
  const { id, fieldKey } = req.params;
  const { translated_text } = req.body as { translated_text?: string };

  if (!translated_text) {
    res.status(400).json({ error: "translated_text is required" });
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("application_translations")
    .update({
      translated_text,
      user_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("application_id", id)
    .eq("field_key", fieldKey);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ updated: true });
});

export default router;
