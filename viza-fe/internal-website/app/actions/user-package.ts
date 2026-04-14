"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface UserVisaPackage {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
}

/**
 * Assign a visa package to a user (admin only).
 * Cancels any existing active package before assigning the new one.
 */
export async function assignUserPackage(
  userId: string,
  visaPackageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !visaPackageId) {
      return { success: false, error: "userId and visaPackageId are required" };
    }

    const adminClient = createAdminClient();

    // Cancel any existing active package for this user
    await adminClient
      .from("user_packages")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("auth_user_id", userId)
      .eq("status", "active");

    // Assign new package
    const { error } = await adminClient
      .from("user_packages")
      .insert({
        auth_user_id: userId,
        visa_package_id: visaPackageId,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("[assignUserPackage] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred",
    };
  }
}

/**
 * Get the active visa package assigned to the current user.
 * Returns null if no package is assigned.
 */
export async function getUserVisaPackage(): Promise<UserVisaPackage | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_packages")
      .select("visa_package_id, visa_packages(id, country, visa_type, name, description)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.visa_packages) return null;

    const pkg = Array.isArray(data.visa_packages)
      ? data.visa_packages[0]
      : data.visa_packages;

    if (!pkg) return null;

    return {
      id: pkg.id,
      country: pkg.country,
      visa_type: pkg.visa_type,
      name: pkg.name,
      description: pkg.description ?? null,
    };
  } catch (err) {
    console.error("[getUserVisaPackage] Error:", err);
    return null;
  }
}
