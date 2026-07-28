import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "staff" | "customer_service";

/**
 * RBAC Helper Functions
 *
 * Philosophy: Rely primarily on Supabase RLS for actual authorization.
 * These helpers are for:
 * 1. UI/UX - Show/hide elements based on role
 * 2. Early validation - Provide better error messages
 * 3. Convenience - Easier than fetching user in every component
 *
 * IMPORTANT: These are NOT a security boundary. RLS policies in the database
 * are the real security layer. Never rely solely on these checks.
 */

/**
 * Get the current authenticated user with role
 * Use this for UI display and basic permission checks
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, name, role, created_at")
    .eq("id", user.id)
    .is("deleted_at", null) // Ensure deleted users cannot authenticate
    .single();

  if (userError || !userData) {
    return null;
  }

  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role as UserRole,
    created_at: userData.created_at,
  };
}

/**
 * Check if user has a specific role (for UI purposes)
 * Note: RLS policies are the actual security boundary
 */
export async function hasRole(role: UserRole | UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}

/**
 * Check if user is admin (for UI purposes)
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole("admin");
}

/**
 * Check if user is staff (for UI purposes)
 */
export async function isStaff(): Promise<boolean> {
  return hasRole("staff");
}

/**
 * Check if user is customer service (for UI purposes)
 */
export async function isCustomerService(): Promise<boolean> {
  return hasRole("customer_service");
}

/**
 * Require admin role - provides clear error message
 * Note: RLS will also block at DB level even if this is bypassed
 */
export async function requireAdmin() {
  const admin = await isAdmin();

  if (!admin) {
    throw new Error("Admin privileges required");
  }
}

/**
 * Require the current user to have one of the specified roles.
 * Throws if unauthenticated OR if role doesn't match.
 * Use in server actions to enforce authorization.
 */
export async function requireRole(...roles: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required");
  if (!roles.includes(user.role)) throw new Error(`Requires one of: ${roles.join(", ")}`);
  return user;
}

/**
 * Require authenticated user
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}

/**
 * Require non-staff role (admin only)
 * Staff users are restricted from certain administrative actions
 * Note: RLS will also block at DB level even if this is bypassed
 */
export async function requireNonStaffRole(): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  if (user.role === "staff" || user.role === "customer_service") {
    throw new Error("Staff cannot perform this action");
  }
}
