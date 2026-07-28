"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthEmailLocale } from "@/lib/i18n/locale";

type PasswordResetResult = {
  success?: boolean;
  error?: string;
  errorCode?: "invalid_email" | "send_failed";
};

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
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        console.error("Error preparing password reset locale:", error);
        break;
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
          console.error("Error updating password reset locale:", updateError);
        }

        break;
      }

      if (data.users.length < 1000) break;
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
