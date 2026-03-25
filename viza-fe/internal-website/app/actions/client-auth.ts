"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clearClientSession,
  getUserFromSupabaseSession,
} from "@/lib/client-session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Validate that an email is acceptable for OTP login.
 * VIZA allows any valid email - new users are created on first login.
 */
export async function validateUserEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { success: false, error: "Please enter a valid email address" };
    }
    return { success: true };
  } catch (err) {
    console.error("Unexpected error in validateUserEmail:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export interface UserSession {
  userId: string;
  email: string;
  name?: string;
  isImpersonation?: boolean;
}

/**
 * Get the current applicant session from Supabase auth
 */
export async function getUserSession(): Promise<UserSession | null> {
  const session = await getUserFromSupabaseSession();
  if (!session) return null;

  const adminClient = createAdminClient() as any;
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("full_name")
    .eq("id", session.userId)
    .maybeSingle();

  return {
    userId: session.userId,
    email: session.email,
    name: profile?.full_name ?? undefined,
  };
}

export async function checkClientSession(): Promise<{
  valid: boolean;
  userId?: string;
}> {
  const session = await getUserFromSupabaseSession();
  if (session) return { valid: true, userId: session.userId };
  return { valid: false };
}

/**
 * Sign out the applicant
 */
export async function userSignOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Error signing out:", error);
  }
  await clearClientSession();
  revalidatePath("/", "layout");
  redirect("/client/login");
}

export async function endImpersonationSession(): Promise<boolean> {
  return true;
}

