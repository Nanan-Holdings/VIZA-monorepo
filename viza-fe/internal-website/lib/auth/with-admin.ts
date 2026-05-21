import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Funnel every server-side privilege escalation through this helper
 * (SECRETS-005). The closure receives a service-role client; the caller
 * provides an `actor` string identifying the code path so the elevation
 * is traceable in logs even when the inner action does not write to the
 * vault audit log.
 *
 * Two modes:
 *   - `withAdmin('admin', actor, fn)` — requires the caller to be an
 *     authenticated admin (per `getCurrentUser().role`). Throws otherwise.
 *   - `withAdmin('system', actor, fn)` — bypass the role check. Use only
 *     for trusted server-only callers (e.g. the impersonation token
 *     callback that runs before any session exists, or a webhook handler
 *     that authenticates the request via a signed secret).
 *
 * Frontend modules (anything under `app/client/**` or `components/**`)
 * MUST NOT import this helper directly. The lint rule in eslint.config.mjs
 * enforces that `@/lib/supabase/admin` and `@/lib/auth/with-admin` are
 * unreachable from client code.
 *
 * Audit doc: `docs/service-role-audit.md`.
 */

type Mode = "admin" | "system";

export class ServiceRoleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceRoleAuthError";
  }
}

export async function withAdmin<T>(
  mode: Mode,
  actor: string,
  fn: (admin: SupabaseClient) => Promise<T>,
): Promise<T> {
  if (mode === "admin") {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new ServiceRoleAuthError(
        `withAdmin('admin', '${actor}') called without an admin session`,
      );
    }
  }
  // system mode runs without a role check — caller is responsible for
  // having validated the request through some other channel (webhook
  // signature, signed token, etc.). Document the channel in the audit doc.
  const admin = createAdminClient() as unknown as SupabaseClient;
  return fn(admin);
}
