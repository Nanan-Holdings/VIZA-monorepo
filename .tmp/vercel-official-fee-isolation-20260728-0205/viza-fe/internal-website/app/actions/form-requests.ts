"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/auth/get-authenticated-user";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types
// =============================================================================

export type FormType = "about_me";
export type TriggerSource = "system" | "admin" | "scheduled";
export type FormRequestStatus = "pending" | "completed" | "skipped";

export interface UserFormRequest {
  id: string;
  user_id: string;
  form_type: FormType;
  triggered_by: TriggerSource;
  triggered_by_user_id: string | null;
  status: FormRequestStatus;
  created_at: string;
  completed_at: string | null;
  skipped_at: string | null;
  due_date: string | null;
  notes: string | null;
}

// =============================================================================
// Client-facing actions (for user portal)
// =============================================================================

/**
 * Get pending form requests for the currently authenticated user
 * Used by the client layout to check for redirect
 */
export async function getPendingFormRequests(): Promise<{
  success: boolean;
  data?: UserFormRequest[];
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from("user_form_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

/**
 * Mark a form request as completed
 * Called when the user finishes the about-me-form
 */
export async function completeFormRequest(requestId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Verify the request belongs to this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: request, error: fetchError } = await (adminClient as any)
    .from("user_form_requests")
    .select("id, user_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Form request not found" };
  }

  if (request.user_id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Update the request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (adminClient as any)
    .from("user_form_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/client");
  return { success: true };
}

/**
 * Mark a form request as skipped
 * Called when the user clicks "Skip for now"
 */
export async function skipFormRequest(requestId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Verify the request belongs to this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: request, error: fetchError } = await (adminClient as any)
    .from("user_form_requests")
    .select("id, user_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Form request not found" };
  }

  if (request.user_id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Update the request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (adminClient as any)
    .from("user_form_requests")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/client");
  return { success: true };
}

// =============================================================================
// Admin/Admin actions
// =============================================================================

/**
 * Create a form request for a user (triggered by admin/system)
 */
export async function createFormRequest(
  userId: string,
  options: {
    formType?: FormType;
    triggeredBy: TriggerSource;
    triggeredByUserId?: string;
    dueDate?: string;
    notes?: string;
  }
): Promise<{
  success: boolean;
  data?: UserFormRequest;
  error?: string;
}> {
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from("user_form_requests")
    .insert({
      user_id: userId,
      form_type: options.formType || "about_me",
      triggered_by: options.triggeredBy,
      triggered_by_user_id: options.triggeredByUserId || null,
      due_date: options.dueDate || null,
      notes: options.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Check if user has any pending form requests
 * Used internally to determine if we should create a new request
 */
export async function hasPendingFormRequest(
  userId: string,
  formType: FormType = "about_me"
): Promise<boolean> {
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (adminClient as any)
    .from("user_form_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("form_type", formType)
    .eq("status", "pending");

  if (error) {
    console.error("Error checking pending form requests:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Check if user has ever completed the form
 * Used to determine if this is a "first login" scenario
 */
export async function hasCompletedForm(
  userId: string,
  formType: FormType = "about_me"
): Promise<boolean> {
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (adminClient as any)
    .from("user_form_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("form_type", formType)
    .eq("status", "completed");

  if (error) {
    console.error("Error checking completed form requests:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Create a first-login form request if user hasn't filled the form before
 * Called when user logs in for the first time or after a long time
 */
export async function createFirstLoginFormRequestIfNeeded(
  userId: string
): Promise<{
  success: boolean;
  created: boolean;
  requestId?: string;
  error?: string;
}> {
  // Check if there's already a pending request
  const hasPending = await hasPendingFormRequest(userId, "about_me");
  if (hasPending) {
    return { success: true, created: false };
  }

  // Check if user has ever completed the form
  const hasCompleted = await hasCompletedForm(userId, "about_me");
  if (hasCompleted) {
    // User has filled the form before, no need for first-login request
    return { success: true, created: false };
  }

  // Create a system-triggered form request
  const result = await createFormRequest(userId, {
    formType: "about_me",
    triggeredBy: "system",
    notes: "First login - please complete your profile",
  });

  if (!result.success) {
    return { success: false, created: false, error: result.error };
  }

  return { success: true, created: true, requestId: result.data?.id };
}

/**
 * Mark the about-me questionnaire as completed for the current user.
 * Works whether or not a requestId is available:
 * - If requestId is given and belongs to the user, marks that record completed.
 * - Otherwise, marks the latest pending about_me request completed, or inserts a
 *   new completed record if none exists.
 *
 * Called unconditionally at the end of the about-me-form so the timeline card
 * always reflects completion regardless of how the user accessed the form.
 */
export async function markQuestionnaireCompleted(requestId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "Unauthorized" };

  const adminClient = createAdminClient();
  const now = new Date().toISOString();

  // Try to update the specific request first
  if (requestId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error: fetchError } = await (adminClient as any)
      .from("user_form_requests")
      .select("id, user_id")
      .eq("id", requestId)
      .single();

    if (!fetchError && request && request.user_id === userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (adminClient as any)
        .from("user_form_requests")
        .update({ status: "completed", completed_at: now })
        .eq("id", requestId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      revalidatePath("/client");
      return { success: true };
    }
  }

  // No requestId or request not found — find any pending about_me request to complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingRequest } = await (adminClient as any)
    .from("user_form_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("form_type", "about_me")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (adminClient as any)
      .from("user_form_requests")
      .update({ status: "completed", completed_at: now })
      .eq("id", pendingRequest.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  } else {
    // No pending request exists — insert a new completed record so the timeline
    // correctly reflects that the user has filled in their profile.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminClient as any)
      .from("user_form_requests")
      .insert({
        user_id: userId,
        form_type: "about_me",
        triggered_by: "system",
        status: "completed",
        completed_at: now,
      });

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/client");
  return { success: true };
}

/**
 * Get all form requests for a user (for admin/admin view)
 */
export async function getUserFormRequests(userId: string): Promise<{
  success: boolean;
  data?: UserFormRequest[];
  error?: string;
}> {
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from("user_form_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}
