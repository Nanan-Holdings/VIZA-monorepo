"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";

type PasswordResetResult = {
  success?: boolean;
  error?: string;
  errorCode?: "invalid_email" | "send_failed";
};

/**
 * Resolve the auth user id for an email via a bounded, indexed lookup instead
 * of paging through the entire auth user list. Returns null when no account
 * matches — callers must keep the response identical whether or not an
 * account exists (no user enumeration).
 */
async function resolveAuthUserIdByEmail(
  adminClient: ReturnType<typeof createAdminClient>,
  normalizedEmail: string,
): Promise<string | null> {
  const { data: applicantRows } = await adminClient
    .from("applicant_profiles")
    .select("auth_user_id, email")
    .ilike("email", normalizedEmail)
    .limit(5);
  const applicantMatch = (applicantRows ?? []).find(
    (row) => (row.email as string | null)?.toLowerCase() === normalizedEmail && row.auth_user_id,
  );
  if (applicantMatch?.auth_user_id) return applicantMatch.auth_user_id as string;

  const { data: staffRows } = await adminClient
    .from("users")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .limit(5);
  const staffMatch = (staffRows ?? []).find(
    (row) => (row.email as string | null)?.toLowerCase() === normalizedEmail && row.id,
  );
  return staffMatch?.id ? (staffMatch.id as string) : null;
}

export async function requestPasswordReset(
  email: string,
  locale?: string
): Promise<PasswordResetResult> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return { errorCode: "invalid_email" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const authEmailLocale = normalizeAuthEmailLocale(locale);

  let adminClient: ReturnType<typeof createAdminClient> | null = null;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    console.error("Failed to create admin client:", err);
  }

  if (adminClient) {
    try {
      // Resolve the single auth user id for this email without enumerating the
      // entire auth user list (which the paged listUsers loop did on every
      // call). Applicant accounts carry the auth id on applicant_profiles;
      // staff/admin accounts on the users table. We fetch a small bounded set
      // via a case-insensitive match, then confirm exact (lower-cased)
      // equality in JS so ILIKE wildcard characters (`_`, `%`) in the email
      // cannot select an unintended row.
      const authUserId = await resolveAuthUserIdByEmail(adminClient, normalizedEmail);

      if (authUserId) {
        const { data: authData, error: getError } =
          await adminClient.auth.admin.getUserById(authUserId);
        if (getError) {
          console.error("Error preparing password reset locale:", getError);
        } else if (authData?.user) {
          const existingMetadata =
            typeof authData.user.user_metadata === "object" &&
            authData.user.user_metadata !== null &&
            !Array.isArray(authData.user.user_metadata)
              ? authData.user.user_metadata
              : {};

          const { error: updateError } =
            await adminClient.auth.admin.updateUserById(authUserId, {
              user_metadata: {
                ...existingMetadata,
                locale: authEmailLocale,
                language: authEmailLocale,
                preferred_language: authEmailLocale,
              },
            });

          if (updateError) {
            console.error("Error updating password reset locale:", updateError);
          }
        }
      }
    } catch (err) {
      console.error("Error preparing password reset locale:", err);
    }
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/forgot-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    console.error("Password reset error:", error.message);
    return { errorCode: "send_failed", error: error.message };
  }

  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    const normalizedMessage = error.message.toLowerCase();

    if (
      normalizedMessage.includes("compromised") ||
      normalizedMessage.includes("list of passwords commonly used") ||
      normalizedMessage.includes("found in data breaches")
    ) {
      return {
        error:
          "Password may be compromised. Password is in a list of passwords commonly used on other websites.",
      };
    }

    return { error: error.message };
  }
  return { success: true };
}
