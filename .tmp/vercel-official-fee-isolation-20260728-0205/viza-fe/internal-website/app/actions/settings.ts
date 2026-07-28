"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

// =============================================================================
// Types (Copied from user-profile.ts)
// =============================================================================

export interface UserProfileData {
  height: { value: number; unit: string; recordedAt: string } | null;
  weight: { value: number; unit: string; recordedAt: string } | null;
  waistCircumference: { value: number; unit: string; recordedAt: string } | null;
}

export interface UserLifestyleData {
  id: string;
  smokingStatus: string | null;
  alcoholConsumption: string | null;
  exerciseHoursPerWeek: number | null;
  dietType: string | null;
  stressLevel: number | null;
  sleepHoursPerNight: string | null;
  recordedAt: string;
  consultationId: string | null;
  serviceId: string | null;
}

export interface UserAboutData {
  // From users table
  dateOfBirth: string | null;

  // From profile_data table (latest values)
  profile_data: UserProfileData;

  // From user_lifestyle table (latest record)
  lifestyle: Omit<UserLifestyleData, "id"> | null;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get user about data (combines users + profile_data + lifestyle)
 * Used by Settings: About You tab
 */
export async function getClientAboutData(): Promise<{
  success: boolean;
  data?: UserAboutData;
  error?: string;
}> {
  const session = await getImpersonationSession();

  if (!session?.userId) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Fetch all data in parallel
  const [userResult, profile_dataResult, lifestyleResult] =
    await Promise.all([
      // Get user basic info
      adminClient
        .from("users")
        .select("date_of_birth")
        .eq("id", session.userId)
        .single(),

      // Get latest profile_data (height, weight, waist)
      adminClient
        .from("profile_data")
        .select("metric, value, unit, recorded_at, meta")
        .eq("user_id", session.userId)
        .in("metric", ["weight", "waist", "height", "other"])
        .order("recorded_at", { ascending: false })
        .limit(20),

      // Get latest lifestyle record
      adminClient
        .from("user_lifestyle")
        .select("*")
        .eq("user_id", session.userId)
        .order("recorded_at", { ascending: false })
        .limit(1),
    ]);

  if (userResult.error) {
    return { success: false, error: "User not found" };
  }

  const user = userResult.data;
  const profile_data = profile_dataResult.data || [];
  const lifestyle = lifestyleResult.data?.[0];

  // Process profile_data - find latest for each metric type
  const weightVital = profile_data.find((v) => v.metric === "weight");
  const heightVital = profile_data.find((v) => {
    if (v.metric === "height") return true;
    if (v.metric === "other") {
      const meta = v.meta as { type?: string } | null;
      return meta?.type === "height";
    }
    return false;
  });
  const waistVital = profile_data.find((v) => v.metric === "waist");

  const aboutData: UserAboutData = {
    dateOfBirth: user.date_of_birth,

    profile_data: {
      height: heightVital
        ? {
            value: heightVital.value,
            unit: heightVital.unit || "cm",
            recordedAt: heightVital.recorded_at || new Date().toISOString(),
          }
        : null,
      weight: weightVital
        ? {
            value: weightVital.value,
            unit: weightVital.unit || "kg",
            recordedAt: weightVital.recorded_at || new Date().toISOString(),
          }
        : null,
      waistCircumference: waistVital
        ? {
            value: waistVital.value,
            unit: waistVital.unit || "cm",
            recordedAt: waistVital.recorded_at || new Date().toISOString(),
          }
        : null,
    },

    lifestyle: lifestyle
      ? {
          smokingStatus: lifestyle.smoking_status,
          alcoholConsumption: lifestyle.alcohol_consumption,
          exerciseHoursPerWeek: lifestyle.exercise_hours_per_week,
          dietType: lifestyle.diet_type,
          stressLevel: lifestyle.stress_level,
          sleepHoursPerNight: lifestyle.sleep_hours_per_night,
          recordedAt: lifestyle.recorded_at || new Date().toISOString(),
          consultationId: lifestyle.consultation_id,
          serviceId: lifestyle.service_id,
        }
      : null,
  };

  return { success: true, data: aboutData };
}

// =============================================================================
// Mock Data (for Profile and Billing tabs during FE development)
// =============================================================================

/**
 * @TODO - Backend Integration Required
 * Get client profile data (name, email, phone, address, bio)
 */
export async function getClientProfileData(): Promise<{
  success: boolean;
  data?: {
    personalInfo: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      bio: string;
    };
    contact: {
      email: string;
      phone: string;
      address: string;
      isDefaultAddress: boolean;
    };
  };
  error?: string;
}> {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();
  const { data: user, error } = await adminClient
    .from("users")
    .select("name, email, phone, address, notes, date_of_birth")
    .eq("id", authenticatedUser.id)
    .single();

  if (error || !user) {
    return { success: false, error: "Failed to load profile data" };
  }

  const [firstName = "", ...lastNameParts] = user.name.trim().split(/\s+/);

  return {
    success: true,
    data: {
      personalInfo: {
        firstName,
        lastName: lastNameParts.join(" "),
        dateOfBirth: user.date_of_birth ?? "",
        bio: user.notes ?? "",
      },
      contact: {
        email: user.email,
        phone: user.phone ?? "",
        address: user.address ?? "",
        isDefaultAddress: Boolean(user.address),
      },
    },
  };
}

export async function updateClientAddress(
  address: string
): Promise<{ success: boolean; address?: string; error?: string }> {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    return { success: false, error: "Unauthorized" };
  }

  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return { success: false, error: "Address is required" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("users")
    .update({ address: normalizedAddress })
    .eq("id", authenticatedUser.id);

  if (error) {
    return { success: false, error: "Failed to update address" };
  }

  return { success: true, address: normalizedAddress };
}
