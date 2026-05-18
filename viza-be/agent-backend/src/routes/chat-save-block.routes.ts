/**
 * Chat Save Block Routes (US-039)
 *
 * POST /api/chat/save-block
 *
 * Saves user-submitted application block data to the correct table
 * based on the saveTarget field from the ApplicationBlockPayload.
 *
 * saveTarget values:
 *   - "applicant_profile": updates applicant_profiles for the given userId
 *   - "application": updates applications for the given applicationId
 *   - "visa_application_answers": upserts dynamic form answers
 */

import { Router } from "express";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";

const logger = new Logger({ serviceName: "ChatSaveBlockRoutes" });

export const chatSaveBlockRouter = Router();

interface SaveBlockBody {
  userId: string;
  saveTarget: "applicant_profile" | "application" | "visa_application_answers";
  applicationId?: string;
  blockType: string;
  data: Record<string, string>;
}

chatSaveBlockRouter.post("/", async (req, res) => {
  const body = req.body as Partial<SaveBlockBody>;
  const { userId, saveTarget, applicationId, data } = body;

  if (!userId || !saveTarget || !data || typeof data !== "object") {
    res.status(400).json({
      error: true,
      message: "userId, saveTarget, and data are required",
    });
    return;
  }

  const supabase = getSupabaseClient();

  try {
    if (saveTarget === "applicant_profile") {
      const { error } = await supabase
        .from("applicant_profiles")
        .update(data)
        .eq("auth_user_id", userId);

      if (error) {
        logger.error("save_block_profile_error", new Error(error.message), {
          userId,
        });
        res.status(500).json({ error: true, message: error.message });
        return;
      }

      res.json({ success: true, saveTarget });
    } else if (saveTarget === "application") {
      if (!applicationId) {
        res.status(400).json({
          error: true,
          message: "applicationId is required for saveTarget=application",
        });
        return;
      }

      // Verify ownership: fetch profile id for this auth_user_id
      const { data: profile, error: profileError } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (profileError || !profile) {
        res.status(404).json({ error: true, message: "Applicant profile not found" });
        return;
      }

      const { error } = await supabase
        .from("applications")
        .update(data)
        .eq("id", applicationId)
        .eq("applicant_id", profile.id);

      if (error) {
        logger.error("save_block_application_error", new Error(error.message), {
          userId,
          applicationId,
        });
        res.status(500).json({ error: true, message: error.message });
        return;
      }

      res.json({ success: true, saveTarget });
    } else if (saveTarget === "visa_application_answers") {
      if (!applicationId) {
        res.status(400).json({
          error: true,
          message: "applicationId is required for saveTarget=visa_application_answers",
        });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (profileError || !profile) {
        res.status(404).json({ error: true, message: "Applicant profile not found" });
        return;
      }

      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .select("id")
        .eq("id", applicationId)
        .eq("applicant_id", profile.id)
        .maybeSingle();

      if (applicationError || !application) {
        res.status(404).json({ error: true, message: "Application not found" });
        return;
      }

      const answerRows = Object.entries(data)
        .filter(([, value]) => value.trim() !== "")
        .map(([fieldName, value]) => ({
          application_id: applicationId,
          field_name: fieldName,
          value_text: value,
          updated_at: new Date().toISOString(),
        }));

      if (answerRows.length > 0) {
        const { error } = await supabase
          .from("visa_application_answers")
          .upsert(answerRows, { onConflict: "application_id,field_name" });

        if (error) {
          logger.error("save_block_answers_error", new Error(error.message), {
            userId,
            applicationId,
          });
          res.status(500).json({ error: true, message: error.message });
          return;
        }
      }

      res.json({ success: true, saveTarget });
    } else {
      res.status(400).json({
        error: true,
        message: `Unknown saveTarget: ${String(saveTarget)}`,
      });
    }
  } catch (err) {
    logger.error("save_block_error", err as Error, { userId });
    res.status(500).json({
      error: true,
      message: err instanceof Error ? err.message : "Unexpected error",
    });
  }
});

export default chatSaveBlockRouter;
