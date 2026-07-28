"use server";

import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Applicant ↔ staff chat thread + message helpers (CS-001).
 *
 * - openOrResumeApplicantThread(applicationId?) — applicant calls
 *   from the chat widget to open a thread.
 * - postApplicantMessage(threadId, body) — applicant side.
 * - postStaffMessage(threadId, body) — staff side, admin-gated.
 * - listQueuedThreads() — staff queue (admin).
 * - getThreadContext(threadId) — last runner step + application
 *   status + applicant info, for the staff member opening the
 *   conversation.
 */

interface ProfileLite {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
}

async function loadCallerProfile(): Promise<{
  userId: string;
  profile: ProfileLite;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return withAdmin("system", "actions/staff-chat:caller", async (admin) => {
    const { data } = await admin
      .from("applicant_profiles")
      .select("id, auth_user_id, full_name, email")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Applicant profile not found");
    return { userId: user.id, profile: data as ProfileLite };
  });
}

export async function openOrResumeApplicantThread(
  applicationId?: string,
): Promise<{ threadId: string; created: boolean }> {
  const { profile } = await loadCallerProfile();
  return withAdmin("system", "actions/staff-chat:open", async (admin) => {
    const { data: existing } = await admin
      .from("staff_chat_thread")
      .select("id")
      .eq("applicant_id", profile.id)
      .in("status", ["queued", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { threadId: existing.id as string, created: false };

    const { data, error } = await admin
      .from("staff_chat_thread")
      .insert({
        applicant_id: profile.id,
        application_id: applicationId ?? null,
        status: "queued",
        applicant_context:
          `${profile.full_name ?? ""} (${profile.email ?? ""})`.trim(),
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`thread insert: ${error?.message}`);
    }
    return { threadId: data.id as string, created: true };
  });
}

async function bumpThread(threadId: string): Promise<void> {
  await withAdmin("system", "actions/staff-chat:bump", async (admin) => {
    await admin
      .from("staff_chat_thread")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  });
}

export async function postApplicantMessage(
  threadId: string,
  body: string,
): Promise<{ ok: true }> {
  const { userId, profile } = await loadCallerProfile();
  if (body.trim().length === 0) throw new Error("Empty message");
  return withAdmin("system", "actions/staff-chat:post-applicant", async (admin) => {
    const { data: thread } = await admin
      .from("staff_chat_thread")
      .select("id, applicant_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!thread || thread.applicant_id !== profile.id) {
      throw new Error("Thread not found or unauthorized");
    }
    const { error } = await admin.from("staff_chat_message").insert({
      thread_id: threadId,
      sender_role: "applicant",
      sender_user_id: userId,
      body: body.slice(0, 4000),
    });
    if (error) throw new Error(`message insert: ${error.message}`);
    await bumpThread(threadId);
    return { ok: true as const };
  });
}

export async function postStaffMessage(
  threadId: string,
  body: string,
): Promise<{ ok: true }> {
  return withAdmin("admin", "actions/staff-chat:post-staff", async (admin) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await admin.from("staff_chat_message").insert({
      thread_id: threadId,
      sender_role: "staff",
      sender_user_id: user.id,
      body: body.slice(0, 4000),
    });
    if (error) throw new Error(`message insert: ${error.message}`);
    await admin
      .from("staff_chat_thread")
      .update({
        status: "active",
        assigned_to: user.id,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
    return { ok: true as const };
  });
}

export interface QueuedThreadRow {
  id: string;
  applicantId: string;
  applicationId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  applicationStatus: string | null;
  lastRunnerStep: string | null;
  lastMessageAt: string;
  status: string;
}

export async function listStaffQueuedThreads(): Promise<QueuedThreadRow[]> {
  return withAdmin("admin", "actions/staff-chat:queue", async (admin) => {
    const { data } = await admin
      .from("staff_chat_thread")
      .select(
        "id, applicant_id, application_id, status, last_message_at",
      )
      .in("status", ["queued", "active"])
      .order("last_message_at", { ascending: false })
      .limit(100);
    const threads = data ?? [];
    if (threads.length === 0) return [];

    const applicantIds = Array.from(
      new Set(threads.map((t) => t.applicant_id as string)),
    );
    const applicationIds = threads
      .map((t) => t.application_id as string | null)
      .filter((x): x is string => Boolean(x));

    const [{ data: profiles }, { data: apps }, { data: lastSteps }] =
      await Promise.all([
        admin
          .from("applicant_profiles")
          .select("id, full_name, email")
          .in("id", applicantIds),
        applicationIds.length === 0
          ? Promise.resolve({ data: [] })
          : admin
              .from("applications")
              .select("id, status")
              .in("id", applicationIds),
        applicationIds.length === 0
          ? Promise.resolve({ data: [] })
          : admin
              .from("runner_step_log")
              .select("application_id, name, status, started_at")
              .in("application_id", applicationIds)
              .order("started_at", { ascending: false }),
      ]);
    const profileById = new Map<string, { full_name: string | null; email: string | null }>();
    for (const p of profiles ?? []) profileById.set(p.id, p);
    const appById = new Map<string, { status: string }>();
    for (const a of apps ?? []) appById.set(a.id, { status: a.status });
    const lastByApp = new Map<string, string>();
    for (const s of lastSteps ?? []) {
      const k = s.application_id as string;
      if (!lastByApp.has(k)) lastByApp.set(k, `${s.name} (${s.status})`);
    }

    return threads.map((t): QueuedThreadRow => {
      const p = profileById.get(t.applicant_id as string);
      return {
        id: t.id as string,
        applicantId: t.applicant_id as string,
        applicationId: (t.application_id as string | null) ?? null,
        applicantName: p?.full_name ?? null,
        applicantEmail: p?.email ?? null,
        applicationStatus: t.application_id
          ? (appById.get(t.application_id as string)?.status ?? null)
          : null,
        lastRunnerStep: t.application_id
          ? (lastByApp.get(t.application_id as string) ?? null)
          : null,
        lastMessageAt: t.last_message_at as string,
        status: t.status as string,
      };
    });
  });
}
