"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientSession } from "@/lib/client-session";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function authErrorMessage(message: string, locale: InterfaceLocale): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return locale === "zh" ? "邮箱或密码不正确。" : "Invalid email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return locale === "zh" ? "请先完成邮箱验证后再登录。" : "Please confirm your email before signing in.";
  }

  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return locale === "zh" ? "尝试次数过多，请稍后再试。" : "Too many attempts. Please try again later.";
  }

  return locale === "zh" ? "登录失败，请检查账号后重试。" : message || "Sign in failed. Please try again.";
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const locale = normalizeInterfaceLocale(formData.get("locale")?.toString());
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return {
      error: locale === "zh" ? "请输入邮箱和密码。" : "Enter your email and password.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: authErrorMessage(error.message, locale) };
  }

  // Get user role to redirect appropriately
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = userData?.role;
    revalidatePath("/", "layout");

    const normalizedEmail = email.toLowerCase().trim();
    const adminClient = createAdminClient();
    const { data: applicant } = userRole === "client"
      ? { data: null }
      : await adminClient
          .from("applicant_profiles")
          .select("id, email")
          .or(`auth_user_id.eq.${user.id},email.eq.${normalizedEmail}`)
          .limit(1)
          .maybeSingle();

    if (userRole === "client" || applicant) {
      // For client users logging in with password, create the client JWT session
      // This allows bypassing OTP for test accounts that have password auth

      // Look up the applicant by email
      const applicantId = applicant?.id ?? user.id;

      // Create the client JWT session so they can access /client/* routes
      await createClientSession(applicantId, normalizedEmail);

      redirect("/client/home");
    } else {
      redirect("/admin");
    }
  }

  return {
    error: locale === "zh" ? "登录失败，请重试。" : "Authentication failed. Please try again.",
  };
}

export async function changeOwnPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Error changing own password:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in changeOwnPassword:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/client/login");
}

export async function adminSignOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/admin/login");
}
