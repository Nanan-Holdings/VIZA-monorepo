/**
 * Cron Routes
 *
 * Manual trigger and status endpoints for the cron system.
 * Protected by service role key — not accessible to regular users.
 *
 * POST /api/v1/cron/process-jobs  — manually trigger queue processing
 * GET  /api/v1/cron/status        — view queue metrics
 */

import { Router, Request, Response, NextFunction } from "express";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "CronRoutes" });

/**
 * Simple auth middleware: checks for the service role key in the Authorization header.
 * This prevents regular users from triggering cron jobs or viewing internal status.
 */
function requireServiceRole(req: Request, res: Response, next: NextFunction): void {
	const authHeader = req.headers.authorization;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!serviceKey) {
		res.status(500).json({ error: "Service role key not configured" });
		return;
	}

	if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
		res.status(401).json({ error: "Unauthorized — service role key required" });
		return;
	}

	next();
}

export function createCronRouter(): Router {
	const router = Router();

	// All cron routes require service role auth
	router.use(requireServiceRole);

	/**
	 * POST /process-jobs
	 * Manually trigger the queue worker to process pending jobs.
	 * Useful for testing without waiting for the polling interval.
	 */
	router.post("/process-jobs", async (_req: Request, res: Response) => {
		try {
			logger.info("cron_manual_trigger", { endpoint: "process-jobs" });
			// Job processing logic to be implemented
			res.json({ success: true, message: "Job processing not yet implemented" });
		} catch (err) {
			logger.error("cron_manual_trigger_error", err as Error);
			res.status(500).json({
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		}
	});

	/**
	 * GET /status
	 * Returns queue metrics and status.
	 */
	router.get("/status", async (_req: Request, res: Response) => {
		try {
			res.json({
				success: true,
				status: "ok",
			});
		} catch (err) {
			logger.error("cron_status_error", err as Error);
			res.status(500).json({
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		}
	});

	return router;
}
