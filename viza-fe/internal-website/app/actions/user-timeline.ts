"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/auth/get-authenticated-user";

// ============================================================
// Types
// ============================================================

export type TaskStatus = "pending" | "locked" | "done";

export type TimelineTaskId =
  | "complete_questionnaire"
  | "measure_profile_data"
  | "book_first_blood_panel"
  | "review_lab_results"
  | "read_action_plan"
  | "book_second_blood_panel";

export interface TimelineTask {
  id: TimelineTaskId;
  status: TaskStatus;
  metadata?: {
    skipped?: boolean;
    bookingDate?: string;
    actionPlanDate?: string;
  };
}

export interface UserTimelineStatus {
  tasks: TimelineTask[];
}

// ============================================================
// Main action
// ============================================================

export async function getUserTimelineStatus(): Promise<{
  success: boolean;
  data?: UserTimelineStatus;
  error?: string;
}> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  try {
    // Run all queries in parallel
    const [
      questionnaireResult,
      shenaiResult,
      labOrdersResult,
      labResultsResult,
      actionPlansResult,
    ] = await Promise.all([
      // 1. Questionnaire: check for completed or skipped form request
      (adminClient as any)
        .from("user_form_requests")
        .select("status")
        .eq("user_id", userId)
        .eq("form_type", "about_me")
        .order("created_at", { ascending: false })
        .limit(1),

      // 2. ShenAI profile_data: check for shenai metric in profile_data table (stub)
      (adminClient as any)
        .from("profile_data")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("metric", "shenai"),

      // 3. Lab orders: count actual bookings (with appointment dates) for first/second
      (adminClient as any)
        .from("lab_orders")
        .select("id, created_at, appointment_date, booking_status")
        .eq("user_id", userId)
        .in("booking_status", ["PENDING", "CONFIRMED", "COMPLETED"])
        .not("appointment_date", "is", null)
        .order("created_at", { ascending: true })
        .limit(2),

      // 4. Lab results: fetch completed lab orders (for count + date fallback)
      (adminClient as any)
        .from("lab_orders")
        .select("id, completed_at, appointment_date, created_at", { count: "exact" })
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .order("created_at", { ascending: true })
        .limit(2),

      // 5. Action plans: check if any plan exists
      (adminClient as any)
        .from("action_plans")
        .select("id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (questionnaireResult.error) {
      console.error("[getUserTimelineStatus] questionnaire query error:", questionnaireResult.error.message);
    }
    if (shenaiResult.error) {
      console.error("[getUserTimelineStatus] shenai profile_data query error:", shenaiResult.error.message);
    }
    if (labOrdersResult.error) {
      console.error("[getUserTimelineStatus] lab orders query error:", labOrdersResult.error.message);
    }
    if (labResultsResult.error) {
      console.error("[getUserTimelineStatus] lab results query error:", labResultsResult.error.message);
    }
    if (actionPlansResult.error) {
      console.error("[getUserTimelineStatus] action plans query error:", actionPlansResult.error.message);
    }

    // ---- Derive task statuses ----

    // 1. Questionnaire
    const latestFormRequest = questionnaireResult.data?.[0];
    const questionnaireSkipped = latestFormRequest?.status === "skipped";
    const questionnaireCompleted = latestFormRequest?.status === "completed";

    // 2. ShenAI (stub — always pending until integration lands)
    const shenaiCompleted = (shenaiResult.count ?? 0) > 0;

    // 3. First blood panel: any booked lab_order
    const labOrders = labOrdersResult.data ?? [];

    // 4. Lab results: any completed lab order (also used to infer blood panel was done)
    const completedLabOrders = labResultsResult.data ?? [];
    const labResultsDone = (labResultsResult.count ?? 0) > 0;

    // If the user already has completed lab results, they necessarily had a blood panel done —
    // even if there's no matching lab_order booking record with an appointment_date.
    const firstPanelDone = labOrders.length >= 1 || labResultsDone;
    const secondPanelDone = labOrders.length >= 2 || completedLabOrders.length >= 2;
    const firstBookingDate =
      labOrders[0]?.appointment_date ??
      labOrders[0]?.created_at ??
      completedLabOrders[0]?.appointment_date ??
      completedLabOrders[0]?.completed_at ??
      null;
    const secondBookingDate =
      labOrders[1]?.appointment_date ??
      labOrders[1]?.created_at ??
      completedLabOrders[1]?.appointment_date ??
      completedLabOrders[1]?.completed_at ??
      null;

    // 5. Action plan: any action_plans record
    const actionPlan = actionPlansResult.data?.[0] ?? null;
    const actionPlanDone = actionPlan !== null;

    // ---- Build task list ----
    const tasks: TimelineTask[] = [];

    // Always visible tasks
    tasks.push({
      id: "complete_questionnaire",
      status: questionnaireCompleted ? "done" : "pending",
      metadata: { skipped: questionnaireSkipped },
    });

    tasks.push({
      id: "measure_profile_data",
      status: shenaiCompleted ? "done" : "pending",
    });

    tasks.push({
      id: "book_first_blood_panel",
      status: firstPanelDone ? "done" : "pending",
      metadata: firstBookingDate ? { bookingDate: firstBookingDate } : undefined,
    });

    // Visible only after first panel is booked
    if (firstPanelDone) {
      tasks.push({
        id: "review_lab_results",
        status: labResultsDone ? "done" : "locked",
      });

      tasks.push({
        id: "read_action_plan",
        status: actionPlanDone ? "done" : "locked",
        metadata: actionPlan ? { actionPlanDate: actionPlan.created_at } : undefined,
      });
    }

    // Visible only after lab results exist
    if (labResultsDone) {
      tasks.push({
        id: "book_second_blood_panel",
        status: secondPanelDone ? "done" : "pending",
        metadata: secondBookingDate ? { bookingDate: secondBookingDate } : undefined,
      });
    }

    return { success: true, data: { tasks } };
  } catch (err) {
    console.error("[getUserTimelineStatus] unexpected error:", err instanceof Error ? err.message : String(err));
    return { success: false, error: "Failed to load timeline status" };
  }
}
