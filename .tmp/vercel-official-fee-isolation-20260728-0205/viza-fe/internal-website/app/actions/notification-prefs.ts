"use server";

import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

export interface NotificationPrefs {
  channel_email: boolean;
  channel_push: boolean;
  notify_runner_started: boolean;
  notify_runner_stopped_for_input: boolean;
  notify_submitted: boolean;
  notify_document_ready: boolean;
  notify_marketing: boolean;
  push_token: string | null;
  push_provider: string | null;
}

const DEFAULTS: NotificationPrefs = {
  channel_email: true,
  channel_push: false,
  notify_runner_started: true,
  notify_runner_stopped_for_input: true,
  notify_submitted: true,
  notify_document_ready: true,
  notify_marketing: false,
  push_token: null,
  push_provider: null,
};

async function callerApplicantId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return withAdmin("system", "actions/notification-prefs:caller", async (admin) => {
    const { data } = await admin
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Applicant profile not found");
    return data.id as string;
  });
}

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const applicantId = await callerApplicantId();
  return withAdmin("system", "actions/notification-prefs:get", async (admin) => {
    const { data } = await admin
      .from("notification_preferences")
      .select(
        "channel_email, channel_push, notify_runner_started, notify_runner_stopped_for_input, notify_submitted, notify_document_ready, notify_marketing, push_token, push_provider",
      )
      .eq("applicant_id", applicantId)
      .maybeSingle();
    return (data as NotificationPrefs | null) ?? DEFAULTS;
  });
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const applicantId = await callerApplicantId();
  return withAdmin("system", "actions/notification-prefs:update", async (admin) => {
    const { data: existing } = await admin
      .from("notification_preferences")
      .select(
        "channel_email, channel_push, notify_runner_started, notify_runner_stopped_for_input, notify_submitted, notify_document_ready, notify_marketing, push_token, push_provider",
      )
      .eq("applicant_id", applicantId)
      .maybeSingle();
    const next: NotificationPrefs = { ...DEFAULTS, ...(existing ?? {}), ...patch };
    const { error } = await admin
      .from("notification_preferences")
      .upsert(
        { applicant_id: applicantId, ...next, updated_at: new Date().toISOString() },
        { onConflict: "applicant_id" },
      );
    if (error) throw new Error(`prefs upsert: ${error.message}`);
    return next;
  });
}
