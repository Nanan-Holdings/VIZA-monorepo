"use server";

import { createClient } from "@/lib/supabase/server";

export interface UserVisaPackage {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
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
