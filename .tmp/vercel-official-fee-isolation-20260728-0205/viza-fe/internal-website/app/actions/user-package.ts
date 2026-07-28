"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getPopularVisaDestination } from "@/lib/visa-destinations";
import { getClientSessionWithFallback } from "@/lib/client-session";

export interface UserVisaPackage {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
}

type VisaPackageRow = {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
};

/**
 * Assign a visa package to a user (admin only).
 * Keeps other active packages so one user can work on multiple visas.
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

    const { data: existingAssignment, error: lookupError } = await adminClient
      .from("user_packages")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("visa_package_id", visaPackageId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return { success: false, error: lookupError.message };
    }

    if (existingAssignment) {
      return { success: true };
    }

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
 * Select a self-serve destination package for the current user.
 * Creates the catalog row lazily when a popular destination has not been
 * seeded into visa_packages yet, then makes it the user's active package.
 */
export async function selectUserVisaDestination(
  destinationId: string
): Promise<{ success: boolean; error?: string; package?: UserVisaPackage }> {
  try {
    const destination = getPopularVisaDestination(destinationId);
    if (!destination) {
      return { success: false, error: "Unknown destination" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = createAdminClient();
    let authUserId = user?.id ?? null;

    if (!authUserId) {
      const session = await getClientSessionWithFallback();
      if (!session) {
        return { success: false, error: "You must be signed in to select a destination" };
      }

      const { data: profile, error: profileError } = await adminClient
        .from("applicant_profiles")
        .select("auth_user_id")
        .eq("id", session.userId)
        .maybeSingle();
      if (profileError) {
        return { success: false, error: profileError.message };
      }
      authUserId = (profile?.auth_user_id as string | null) ?? null;
      if (!authUserId) {
        return { success: false, error: "Your client profile is not linked to a login account yet" };
      }
    }

    const { data: existingPackage, error: packageLookupError } = await adminClient
      .from("visa_packages")
      .select("id, country, visa_type, name, description")
      .eq("country", destination.country)
      .eq("visa_type", destination.visaType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (packageLookupError) {
      return { success: false, error: packageLookupError.message };
    }

    let packageRow = existingPackage as VisaPackageRow | null;

    if (!packageRow) {
      const { data: insertedPackage, error: insertPackageError } = await adminClient
        .from("visa_packages")
        .insert({
          country: destination.country,
          visa_type: destination.visaType,
          name: `${destination.countryName} ${destination.visaName}`,
          description: destination.description,
          is_active: true,
          metadata: {
            destination_id: destination.id,
            support_label: destination.supportLabel,
            source: "popular_destination_catalog",
          },
        })
        .select("id, country, visa_type, name, description")
        .single();

      if (insertPackageError || !insertedPackage) {
        return {
          success: false,
          error: insertPackageError?.message ?? "Could not create destination package",
        };
      }

      packageRow = insertedPackage as VisaPackageRow;
    }

    const { data: existingAssignment, error: assignmentLookupError } = await adminClient
      .from("user_packages")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("visa_package_id", packageRow.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (assignmentLookupError) {
      return { success: false, error: assignmentLookupError.message };
    }

    if (!existingAssignment) {
      const { error: assignError } = await adminClient
        .from("user_packages")
        .insert({
          auth_user_id: authUserId,
          visa_package_id: packageRow.id,
          status: "active",
        });

      if (assignError) {
        return { success: false, error: assignError.message };
      }
    }

    revalidatePath("/client/home");
    revalidatePath("/client/application");

    return {
      success: true,
      package: {
        id: packageRow.id,
        country: packageRow.country,
        visa_type: packageRow.visa_type,
        name: packageRow.name,
        description: packageRow.description,
      },
    };
  } catch (err) {
    console.error("[selectUserVisaDestination] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred",
    };
  }
}

/**
 * Get all active visa packages assigned to the current user.
 */
export async function getUserVisaPackages(): Promise<UserVisaPackage[]> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("user_packages")
      .select("visa_package_id, visa_packages(id, country, visa_type, name, description)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false });

    if (error || !data) return [];

    return data
      .map((row) => {
        const pkg = Array.isArray(row.visa_packages)
          ? row.visa_packages[0]
          : row.visa_packages;

        if (!pkg) return null;
        return {
          id: pkg.id,
          country: pkg.country,
          visa_type: pkg.visa_type,
          name: pkg.name,
          description: pkg.description ?? null,
        } satisfies UserVisaPackage;
      })
      .filter((pkg): pkg is UserVisaPackage => Boolean(pkg));
  } catch (err) {
    console.error("[getUserVisaPackages] Error:", err);
    return [];
  }
}

/**
 * Get the latest active visa package assigned to the current user.
 * Returns null if no package is assigned.
 */
export async function getUserVisaPackage(): Promise<UserVisaPackage | null> {
  const packages = await getUserVisaPackages();
  return packages[0] ?? null;
}
