import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  getPublicPortalStatus,
  runPortalHealthProbes,
} from "../services/portal-health.service.js";
import { Logger } from "../utils/logger.js";

export const publicStatusRouter = Router();
export const statusOperationsRouter = Router();
const logger = new Logger({ serviceName: "PublicStatusRoutes" });

function safeSecretMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

function requireStatusCronSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.STATUS_CRON_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ ok: false, error: "status_probe_not_configured" });
    return;
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!safeSecretMatch(provided, expected)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  next();
}

publicStatusRouter.get("/", async (_req, res) => {
  try {
    const snapshot = await getPublicPortalStatus();
    res
      .set({
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        "Content-Type": "application/json; charset=utf-8",
      })
      .status(200)
      .json(snapshot);
  } catch (error) {
    logger.error(
      "public_status_snapshot_failed",
      error instanceof Error ? error : new Error("Unknown public status error"),
    );
    res
      .set("Cache-Control", "no-store")
      .status(503)
      .json({ ok: false, error: "status_snapshot_unavailable" });
  }
});

statusOperationsRouter.post("/probe", requireStatusCronSecret, async (_req, res) => {
  try {
    const summary = await runPortalHealthProbes();
    res.status(summary.persistenceFailures === 0 ? 200 : 503).json({
      ok: summary.persistenceFailures === 0,
      ...summary,
    });
  } catch (error) {
    logger.error(
      "portal_health_probe_failed",
      error instanceof Error ? error : new Error("Unknown portal probe error"),
    );
    res.status(503).json({ ok: false, error: "status_probe_failed" });
  }
});
