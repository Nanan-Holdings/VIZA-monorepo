"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientSession } from "@/lib/client-session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
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

    if (userRole === "client") {
      // For client users logging in with password, create the client JWT session
      // This allows bypassing OTP for test accounts that have password auth
      const normalizedEmail = email.toLowerCase().trim();
      const adminClient = createAdminClient();

      // Look up the applicant by email
      const { data: applicant } = await adminClient
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (applicant) {
        // Create the client JWT session so they can access /client/* routes
        await createClientSession(applicant.id, normalizedEmail);
      }

      redirect("/client/home");
    } else {
      redirect("/admin");
    }
  }

  return { error: "Authentication failed" };
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
