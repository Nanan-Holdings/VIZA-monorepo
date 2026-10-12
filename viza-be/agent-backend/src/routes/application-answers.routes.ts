/**
 * Application Answers Routes
 *
 * GET  /api/applications/:id/answers  — All answers for an application as flat map
 * POST /api/applications/:id/answers  — Upsert answers for an application
 */

import { Router } from "express";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "ApplicationAnswersRoutes" });

export const applicationAnswersRouter = Router();

/**
 * GET /api/applications/:id/answers
 *
 * Returns all answers for the application as a flat { field_name: value } map.
 * Uses value_json if present, otherwise value_text.
 */
applicationAnswersRouter.get("/:id/answers", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("visa_application_answers")
      .select("field_name, value_text, value_json")
      .eq("application_id", id);

    if (error) {
      logger.error("answers_get_error", new Error(error.message), { applicationId: id });
      res.status(500).json({ error: true, message: error.message });
      return;
    }

    // Build flat map: field_name → value
    const answers: Record<string, unknown> = {};
    for (const row of data ?? []) {
      answers[row.field_name] = row.value_json ?? row.value_text;
    }

    res.json({ error: false, data: answers });
  } catch (error) {
    logger.error("answers_get_error", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/applications/:id/answers
 *
 * Upsert answers for an application.
 * Body: { answers: { [field_name]: value } }
 * String values go to value_text; objects go to value_json.
 */
applicationAnswersRouter.post("/:id/answers", async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;

    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: true, message: "answers object required" });
      return;
    }

    const supabase = getSupabaseClient();

    const rows = Object.entries(answers).map(([fieldName, value]) => ({
      application_id: id,
      field_name: fieldName,
      value_text: typeof value === "string" ? value : null,
      value_json: typeof value === "object" && value !== null ? value : null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("visa_application_answers")
      .upsert(rows, { onConflict: "application_id,field_name" })
      .select("field_name");

    if (error) {
      logger.error("answers_upsert_error", new Error(error.message), { applicationId: id });
      res.status(500).json({ error: true, message: error.message });
      return;
    }

    logger.info("answers_upserted", { applicationId: id, count: data?.length ?? 0 });
    res.json({ error: false, upserted: data?.length ?? 0 });
  } catch (error) {
    logger.error("answers_upsert_error", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default applicationAnswersRouter;
