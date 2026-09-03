/**
 * User Package Routes
 *
 * GET  /api/user/package       — Active package for the authenticated user
 * POST /api/user/package       — Assign a package to a user (admin/service only)
 */

import { Router } from "express";
import { Logger } from "../utils/logger.js";
import { getSupabaseClient } from "../db/supabase-client.js";
import { resolveRequester, type Requester } from "../middleware/user-auth.js";

const logger = new Logger({ serviceName: "UserPackageRoutes" });

export const userPackagesRouter = Router();

/**
 * GET /api/user/package?userId=<uuid>
 *
 * Returns the active visa package for the given user, including package details.
 */
userPackagesRouter.get("/", async (req, res) => {
  try {
    // Authenticated applicants may only read their OWN active package; the
    // auth_user_id comes from the token, not the query. Service callers may
    // pass an explicit userId.
    let requester: Requester | null = null;
    try {
      requester = await resolveRequester(req);
    } catch {
      res.status(500).json({ error: true, message: "Authentication is not configured" });
      return;
    }
    if (!requester) {
      res.status(401).json({ error: true, message: "Bearer token required" });
      return;
    }

    let userId: string | undefined;
    if (requester.kind === "user") {
      userId = requester.authUserId;
    } else {
      userId = req.query.userId as string | undefined;
      if (!userId) {
        res.status(400).json({ error: true, message: "userId query param required" });
        return;
      }
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("user_packages")
      .select("*, visa_packages(*)")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("user_package_get_error", new Error(error.message), { userId });
      res.status(500).json({ error: true, message: error.message });
      return;
    }

    res.json({ error: false, data });
  } catch (error) {
    logger.error("user_package_get_error", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/user/package
 *
 * Assign or reassign a visa package to a user.
 * Body: { userId, visaPackageId, applicationId? }
 *
 * If user already has an active package, it is set to "cancelled" before assigning new.
 */
userPackagesRouter.post("/", async (req, res) => {
  try {
    // Assigning/cancelling packages is a privileged action. Authenticated
    // applicants may only (re)assign their OWN package — the target user is the
    // token's auth_user_id and any body userId is ignored. Internal service
    // callers may assign on behalf of an explicit body userId.
    let requester: Requester | null = null;
    try {
      requester = await resolveRequester(req);
    } catch {
      res.status(500).json({ error: true, message: "Authentication is not configured" });
      return;
    }
    if (!requester) {
      res.status(401).json({ error: true, message: "Bearer token required" });
      return;
    }

    const { visaPackageId, applicationId } = req.body;
    const userId =
      requester.kind === "user" ? requester.authUserId : (req.body.userId as string | undefined);

    if (!userId || !visaPackageId) {
      res.status(400).json({
        error: true,
        message: "userId and visaPackageId are required",
      });
      return;
    }

    const supabase = getSupabaseClient();

    // Cancel any existing active package for this user
    await supabase
      .from("user_packages")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("auth_user_id", userId)
      .eq("status", "active");

    // Assign new package
    const { data, error } = await supabase
      .from("user_packages")
      .insert({
        auth_user_id: userId,
        visa_package_id: visaPackageId,
        application_id: applicationId ?? null,
        status: "active",
      })
      .select("*, visa_packages(*)")
      .single();

    if (error) {
      logger.error("user_package_assign_error", new Error(error.message), { userId, visaPackageId });
      res.status(500).json({ error: true, message: error.message });
      return;
    }

    logger.info("user_package_assigned", { userId, visaPackageId, packageId: data.id });
    res.json({ error: false, data });
  } catch (error) {
    logger.error("user_package_assign_error", error as Error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default userPackagesRouter;
