"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(email: string) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return { error: "Please enter a valid email address" };
  }

  const normalizedEmail = email.toLowerCase().trim();

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    console.error("Failed to create admin client:", err);
    // Fail closed - don't send email if we can't verify
    return { success: true };
  }

  // SECURITY: Only allow password reset for staff users in public.users table
  // Users use OTP authentication only and should never have passwords
  const { data: staffUser, error: queryError } = await adminClient
    .from("users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (queryError) {
    console.error("Error checking staff user:", queryError.message);
    // Fail closed - don't send email if we can't verify
    return { success: true };
  }

  // If email not found in public.users, return error
  if (!staffUser) {
    console.log(`Password reset blocked: ${normalizedEmail} not found in public.users`);
    return { error: "No staff account found with this email address" };
  }

  console.log(`Password reset allowed: ${normalizedEmail} found in public.users`);

  // Only send reset email if user exists in public.users (staff/admin/admin)
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/auth/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("Password reset error:", error.message);
  }

  // Always return success to prevent email enumeration
  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
