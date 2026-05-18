/**
 * Telegram Webhook Handler
 * Handles callback_query from inline keyboard buttons sent by news-monitor.
 *
 * Buttons:
 *   approve_{id} → set knowledge_base_updates.status = 'approved' + trigger re-ingest
 *   dismiss_{id} → set knowledge_base_updates.status = 'dismissed'
 *
 * Register with: POST /webhook/telegram
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "TelegramWebhook" });
const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  if (!BOT_TOKEN || BOT_TOKEN === "your_telegram_bot_token_here") return;
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown Telegram API error";
    logger.error("Failed to answer callback query", new Error("Failed to answer callback query"), { error: message });
  }
}

async function triggerReingest(articleId: string): Promise<void> {
  // TODO: implement actual re-scrape + re-ingest pipeline
  // This could call the knowledge-base ingest scripts or queue a job
  logger.info("Re-ingest triggered (stub)", { articleId });
}

/**
 * POST /webhook/telegram
 * Telegram sends update objects here when users click inline buttons.
 */
router.post("/", async (req: Request, res: Response) => {
  // Always return 200 immediately to Telegram
  res.status(200).json({ ok: true });

  const update = req.body;
  if (!update?.callback_query) return;

  const { id: callbackQueryId, data: callbackData, from } = update.callback_query;
  if (!callbackData) return;

  logger.info("Telegram callback received", { callbackData, from: from?.username });

  const supabase = getSupabaseClient();

  if (callbackData.startsWith("approve_")) {
    const articleId = callbackData.replace("approve_", "");

    const { error } = await supabase
      .from("knowledge_base_updates")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    if (error) {
      logger.error("Failed to approve article", new Error("Failed to approve article"), { articleId, error: error.message });
      await answerCallbackQuery(callbackQueryId, "❌ Failed to approve");
      return;
    }

    await triggerReingest(articleId);
    await answerCallbackQuery(callbackQueryId, "✅ Approved! Re-ingest triggered.");
    logger.info("Article approved", { articleId });

  } else if (callbackData.startsWith("dismiss_")) {
    const articleId = callbackData.replace("dismiss_", "");

    const { error } = await supabase
      .from("knowledge_base_updates")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", articleId);

    if (error) {
      logger.error("Failed to dismiss article", new Error("Failed to dismiss article"), { articleId, error: error.message });
      await answerCallbackQuery(callbackQueryId, "❌ Failed to dismiss");
      return;
    }

    await answerCallbackQuery(callbackQueryId, "🗑️ Dismissed.");
    logger.info("Article dismissed", { articleId });

  } else {
    logger.warn("Unknown callback data: " + callbackData);
    await answerCallbackQuery(callbackQueryId, "Unknown action");
  }
});

export default router;
