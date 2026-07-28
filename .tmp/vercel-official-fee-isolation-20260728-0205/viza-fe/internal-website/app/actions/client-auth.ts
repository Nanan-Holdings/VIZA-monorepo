"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clearClientSession,
  getUserFromSupabaseSession,
} from "@/lib/client-session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";

export async function prepareAuthEmailLocale(
  email: string,
  locale: string
): Promise<{ success: boolean }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { success: false };
    }

    const authEmailLocale = normalizeAuthEmailLocale(locale);
    const adminClient = createAdminClient();

    // Resolve the auth user through applicant_profiles instead of paging
    // the full auth user list — this runs on the login critical path, so
    // it must stay O(1) as the user base grows. The locale stamp is a
    // nice-to-have: bail out after 3s rather than gate login on it.
    const { data: profiles, error: profileError } = await adminClient
      .from("applicant_profiles")
      .select("auth_user_id")
      .ilike("email", normalizedEmail)
      .not("auth_user_id", "is", null)
      .limit(2)
      .abortSignal(AbortSignal.timeout(3000));

    if (profileError) {
      console.error("Error preparing auth email locale:", profileError);
      return { success: false };
    }

    // No linked profile (first-time signup, or ambiguous email match):
    // skip silently — signInWithOtp's options.data carries the locale for
    // newly created users.
    if (!profiles || profiles.length !== 1 || !profiles[0].auth_user_id) {
      return { success: true };
    }

    const authUserId = profiles[0].auth_user_id;
    const { data: userData, error: getUserError } =
      await adminClient.auth.admin.getUserById(authUserId);

    if (getUserError || !userData?.user) {
      console.error("Error loading auth user for email locale:", getUserError);
      return { success: false };
    }

    const existingMetadata =
      typeof userData.user.user_metadata === "object" &&
      userData.user.user_metadata !== null &&
      !Array.isArray(userData.user.user_metadata)
        ? userData.user.user_metadata
        : {};

    if (
      existingMetadata.locale === authEmailLocale &&
      existingMetadata.language === authEmailLocale &&
      existingMetadata.preferred_language === authEmailLocale
    ) {
      return { success: true };
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      authUserId,
      {
        user_metadata: {
          ...existingMetadata,
          locale: authEmailLocale,
          language: authEmailLocale,
          preferred_language: authEmailLocale,
        },
      }
    );

    if (updateError) {
      console.error("Error updating auth email locale:", updateError);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error("Unexpected error in prepareAuthEmailLocale:", err);
    return { success: false };
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

  const adminClient = createAdminClient();
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

