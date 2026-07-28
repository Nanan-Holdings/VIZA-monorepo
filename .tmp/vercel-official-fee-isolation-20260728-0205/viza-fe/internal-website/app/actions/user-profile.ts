// @ts-nocheck - needs refactoring after domain migration

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types
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

// Input types for creating/updating records
export interface UserProfileInput {
  dateOfBirth?: string | null; // ISO date string (YYYY-MM-DD)
}

export interface UserLifestyleInput {
  smokingStatus?: string | null;
  alcoholConsumption?: string | null;
  exerciseHoursPerWeek?: number | null;
  dietType?: string | null;
  stressLevel?: number | null;
  sleepHoursPerNight?: string | null;
}

export interface UserContext {
  consultationId?: string;
  serviceId?: string;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get user about data (combines users + profile_data + lifestyle)
 */
export async function getUserAboutData(userId: string): Promise<{
  success: boolean;
  data?: UserAboutData;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
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
        .eq("id", userId)
        .single(),

      // Get latest profile_data (height, weight, waist)
      adminClient
        .from("profile_data")
        .select("metric, value, unit, recorded_at, meta")
        .eq("user_id", userId)
        .in("metric", ["weight", "waist", "height", "other"])
        .order("recorded_at", { ascending: false })
        .limit(20),

      // Get latest lifestyle record
      adminClient
        .from("user_lifestyle")
        .select("*")
        .eq("user_id", userId)
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
// Write Operations
// =============================================================================

/**
 * Create a new lifestyle record (adds to timeline)
 */
export async function createUserLifestyle(
  userId: string,
  data: UserLifestyleInput,
  context?: UserContext
): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.from("user_lifestyle").insert({
    user_id: userId,
    consultation_id: context?.consultationId || null,
    service_id: context?.serviceId || null,
    smoking_status: data.smokingStatus || null,
    alcohol_consumption: data.alcoholConsumption || null,
    exercise_hours_per_week: data.exerciseHoursPerWeek || null,
    diet_type: data.dietType || null,
    stress_level: data.stressLevel || null,
    sleep_hours_per_night: data.sleepHoursPerNight || null,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating lifestyle record:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// Client-Facing Operations (for /client/* pages)
// =============================================================================

/**
 * Get the authenticated user from the current session.
 * Looks up the user record by auth_user_id.
 */
async function getAuthenticatedUser(): Promise<{
  id: string;
  name: string;
  email: string;
  dateOfBirth: string | null;
  isImpersonation?: boolean;
} | null> {
  // 1. Check for impersonation session first
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    const adminClient = createAdminClient();
    const { data: user, error } = await adminClient
      .from("users")
      .select("id, name, email, date_of_birth")
      .eq("id", impersonation.userId)
      .single();

    if (error || !user) {
      console.error("[getAuthenticatedUser] Impersonation user not found:", impersonation.userId);
      return null;
    }

    return {
      id: authUser.id,
      name: user.name,
      email: authUser.email,
      dateOfBirth: user.date_of_birth,
      isImpersonation: true,
    };
  }

  // 2. Fall back to normal Supabase auth session
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data: user, error } = await adminClient
    .from("users")
    .select("id, name, email, date_of_birth")
    .eq("auth_user_id", authUser.id)
    .single();

  if (error || !user) {
    return null;
  }

  return {
    id: authUser.id,
    name: user.name,
    email: authUser.email,
    dateOfBirth: user.date_of_birth,
  };
}

/**
 * Get the current authenticated user's about data
 * Used by client-facing /client/settings page
 */
export async function getClientAboutData(): Promise<{
  success: boolean;
  data?: UserAboutData;
  error?: string;
}> {
  const user = await getAuthenticatedUser();

  if (!authUser) {
    return { success: false, error: "Not authenticated or no user linked" };
  }

  return getUserAboutData(authUser.id);
}

/**
 * Update the current authenticated user's lifestyle data
 * Creates a new timeline record
 */
export async function updateClientLifestyle(
  data: UserLifestyleInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getAuthenticatedUser();

  if (!authUser) {
    return { success: false, error: "Not authenticated or no user linked" };
  }

  const result = await createUserLifestyle(authUser.id, data);

  if (result.success) {
    revalidatePath("/client/settings");
  }

  return result;
}

/**
 * Update the current authenticated user's profile (date of birth)
 * Updates the users table directly (not timeline-based)
 */
export async function updateClientProfile(
  data: UserProfileInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getAuthenticatedUser();

  if (!authUser) {
    return { success: false, error: "Not authenticated or no user linked" };
  }

  const adminClient = createAdminClient();

  const updateData: { date_of_birth?: string | null } = {};

  if (data.dateOfBirth !== undefined) {
    updateData.date_of_birth = data.dateOfBirth;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true }; // Nothing to update
  }

  const { error } = await adminClient
    .from("users")
    .update(updateData)
    .eq("id", authUser.id);

  if (error) {
    console.error("Error updating user profile:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/client/settings");
  return { success: true };
}
