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
import { timingSafeEqual } from "crypto";
import axios from "axios";
import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "TelegramWebhook" });
const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Verify Telegram's secret token header. Telegram echoes the secret configured
 * via setWebhook back in `X-Telegram-Bot-Api-Secret-Token` on every callback.
 * We reject the request unless TELEGRAM_WEBHOOK_SECRET is configured AND the
 * header matches it (constant-time). An unset secret rejects everything — fail
 * closed — so the approval webhook can never be driven by an anonymous caller.
 */
function hasValidTelegramSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.header("X-Telegram-Bot-Api-Secret-Token");
  if (!provided) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

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
  // Reject any caller that cannot present the configured secret token before
  // touching the database or Telegram API.
  if (!hasValidTelegramSecret(req)) {
    logger.warn("telegram_webhook_rejected_invalid_secret");
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  // Return 200 immediately to Telegram once the caller is verified.
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
