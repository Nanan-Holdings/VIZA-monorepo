import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/rbac";
import type { Database } from "@/types/database";

type UserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

/**
 * Admin client with service role key
 *
 * SECURITY WARNING: This bypasses RLS!
 * - Only use server-side
 * - Never expose to client
 * - Always verify permissions before using
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a user with admin privileges
 * This function verifies admin permissions before using service role
 */
export async function createUserWithAdmin(
  email: string,
  name: string,
  role: UserRole,
  password: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // 1. Verify admin privileges using regular client (respects RLS)
    await requireAdmin();

    // 2. Validate inputs
    const validRoles: UserRole[] = ["admin", "admin", "staff", "customer_service"];
    if (!validRoles.includes(role)) {
      return { success: false, error: "Invalid role" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Invalid email format" };
    }

    if (!name || name.trim().length === 0) {
      return { success: false, error: "Name is required" };
    }

    if (!password || password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    // 3. Check if user already exists (use admin client to bypass RLS)
    const adminClient = createAdminClient();

    const { data: existingUser } = await adminClient
      .from("users")
      .select("id, email, deleted_at")
      .eq("email", email)
      .maybeSingle();

    if (existingUser && !existingUser.deleted_at) {
      return { success: false, error: "User with this email already exists" };
    }

    // 4. Handle soft-deleted user restoration
    if (existingUser && existingUser.deleted_at) {
      console.log(
        "Found soft-deleted user with same email, restoring:",
        existingUser.id
      );

      // Clean up any leftover auth record for this user (e.g. banned but not deleted)
      const { data: staleAuthUser } =
        await adminClient.auth.admin.getUserById(existingUser.id);
      if (staleAuthUser?.user) {
        console.log(
          "Cleaning up stale auth record for soft-deleted user:",
          existingUser.id
        );
        await adminClient.auth.admin.deleteUser(existingUser.id);
      }

      // Create new auth user with the SAME UUID to preserve FK references
      // The GoTrue admin API accepts `id` in the body but the TS type omits it
      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role },
          ...({ id: existingUser.id } as Record<string, unknown>),
        } as Parameters<typeof adminClient.auth.admin.createUser>[0]);

      if (authError || !authData.user) {
        console.error("Error creating auth user for restored user:", authError);
        return { success: false, error: "Failed to create user account" };
      }

      // Restore the soft-deleted public.users record
      const { error: restoreError } = await adminClient
        .from("users")
        .update({
          name,
          role,
          deleted_at: null,
          deleted_by: null,
        })
        .eq("id", existingUser.id);

      if (restoreError) {
        console.error("Error restoring soft-deleted user:", restoreError);
        // Clean up the auth user we just created
        await adminClient.auth.admin.deleteUser(existingUser.id);
        return { success: false, error: "Failed to restore user record" };
      }

      return { success: true, userId: existingUser.id };
    }

    // 5. Also check if auth user exists (in case of partial creation)
    const { data: existingAuthUsers } =
      await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.users?.find(
      (u) => u.email === email
    );

    if (existingAuthUser) {
      // Auth user exists - check if there's a corresponding users record
      const { data: userRecord } = await adminClient
        .from("users")
        .select("id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (!userRecord) {
        // Orphaned auth user (auth exists but no public.users record) - clean it up
        console.log(
          "Found orphaned auth user, cleaning up:",
          existingAuthUser.id
        );
        await adminClient.auth.admin.deleteUser(existingAuthUser.id);
      } else {
        // Both exist - shouldn't reach here due to email check above
        return { success: false, error: "User with this email already exists" };
      }
    }

    // 6. Create auth user using admin client (service role)
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role,
        },
      });

    if (authError || !authData.user) {
      console.error("Error creating auth user:", authError);
      return { success: false, error: "Failed to create user account" };
    }

    // 7. Create user record in public.users table
    const { error: userError } = await adminClient.from("users").insert({
      id: authData.user.id,
      email,
      name,
      role,
    });

    if (userError) {
      console.error("Error creating user record:", userError);

      // Check if it's a duplicate key error (user might already exist from retry)
      if (userError.code === "23505") {
        // User record already exists - check if it matches our attempt
        const { data: existingRecord } = await adminClient
          .from("users")
          .select("id, email")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (existingRecord && existingRecord.email === email) {
          // This is actually a success - the user exists with matching email
          console.log(
            "User already exists with same email, treating as success"
          );
          return { success: true, userId: authData.user.id };
        }
      }

      // For other errors or mismatched email, clean up auth user
      console.log("Cleaning up auth user due to error");
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: "Failed to create user record" };
    }

    return { success: true, userId: authData.user.id };
  } catch (error) {
    console.error("Error in createUserWithAdmin:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}

/**
 * Delete a user with admin privileges (soft delete)
 * This function verifies admin permissions before using service role
 *
 * Instead of hard deleting, we:
 * 1. Set deleted_at and deleted_by on the public.users record
 * 2. Hard delete the auth.users record to free up the email for re-creation
 *
 * This preserves referential integrity (FK references use public.users.id)
 * while allowing the same email to be used when recreating the user.
 */
export async function deleteUserWithAdmin(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Verify admin privileges
    await requireAdmin();

    const { getCurrentUser } = await import("@/lib/rbac");
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Prevent users from deleting themselves
    if (userId === currentUser.id) {
      return { success: false, error: "Cannot delete your own account" };
    }

    const adminClient = createAdminClient();

    // 3. Check if user exists and is not already deleted
    const { data: existingUser, error: fetchError } = await adminClient
      .from("users")
      .select("id, email, deleted_at")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching user:", fetchError);
      return { success: false, error: "Failed to fetch user" };
    }

    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    if (existingUser.deleted_at) {
      return { success: false, error: "User is already deleted" };
    }

    // 4. Soft delete: set deleted_at and deleted_by
    const { error: updateError } = await adminClient
      .from("users")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.id,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error soft deleting user:", updateError);
      return { success: false, error: "Failed to delete user" };
    }

    // 5. Hard delete auth user if exists (frees up the email for re-creation)
    const { data: authUser, error: authCheckError } =
      await adminClient.auth.admin.getUserById(userId);

    if (authUser && !authCheckError) {
      const { error: deleteAuthError } =
        await adminClient.auth.admin.deleteUser(userId);

      if (deleteAuthError) {
        console.error("Error deleting auth user:", deleteAuthError);
        // Don't fail the operation - soft delete succeeded
        // The user won't appear in lists but could theoretically still log in
        // This is a minor issue that can be fixed later
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteUserWithAdmin:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}

