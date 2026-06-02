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

    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        console.error("Error preparing auth email locale:", error);
        return { success: false };
      }

      const authUser = data.users.find(
        (user) => user.email?.toLowerCase() === normalizedEmail
      );

      if (authUser) {
        const existingMetadata =
          typeof authUser.user_metadata === "object" &&
          authUser.user_metadata !== null &&
          !Array.isArray(authUser.user_metadata)
            ? authUser.user_metadata
            : {};

        const { error: updateError } =
          await adminClient.auth.admin.updateUserById(authUser.id, {
            user_metadata: {
              ...existingMetadata,
              locale: authEmailLocale,
              language: authEmailLocale,
              preferred_language: authEmailLocale,
            },
          });

        if (updateError) {
          console.error("Error updating auth email locale:", updateError);
          return { success: false };
        }

        return { success: true };
      }

      if (data.users.length < 1000) break;
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

