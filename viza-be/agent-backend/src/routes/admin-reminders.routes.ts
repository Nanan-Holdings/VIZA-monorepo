/**
 * Admin Reminders Routes
 *
 * Testing endpoints for custom reminders (dev/staging only)
 */

import { Router } from "express";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "AdminRemindersRoutes" });

export const adminRemindersRouter = Router();

/**
 * POST /api/admin/reminders/:reminderId/trigger
 *
 * Manually trigger a reminder by enqueuing it immediately.
 * Useful for testing without waiting for scheduled time.
 *
 * Security: This should be protected by service role auth in production.
 */
adminRemindersRouter.post("/:reminderId/trigger", async (req, res) => {
	try {
		const { reminderId } = req.params;

		logger.info("admin_reminder_trigger_requested", { reminderId });

		// Reminder triggering logic to be implemented
		res.status(501).json({
			error: false,
			message: "Reminder trigger not yet implemented",
			reminderId,
		});
	} catch (error) {
		logger.error("admin_reminder_trigger_error", error as Error, {
			reminderId: req.params.reminderId,
		});

		res.status(500).json({
			error: true,
			message: "Failed to trigger reminder",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

/**
 * GET /api/admin/reminders/:reminderId
 *
 * Get reminder details for debugging
 */
adminRemindersRouter.get("/:reminderId", async (req, res) => {
	try {
		const { reminderId } = req.params;

		logger.info("admin_reminder_get_requested", { reminderId });

		// Reminder fetch logic to be implemented
		res.status(501).json({
			error: false,
			message: "Reminder fetch not yet implemented",
			reminderId,
		});
	} catch (error) {
		logger.error("admin_reminder_get_error", error as Error, {
			reminderId: req.params.reminderId,
		});

		res.status(500).json({
			error: true,
			message: "Failed to get reminder",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

export default adminRemindersRouter;
