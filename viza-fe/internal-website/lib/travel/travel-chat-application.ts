import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getLatestTravelApplicationIdForApplicant(
  applicantId: string,
): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("applications")
    .select("id")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[travel-chat] Failed to load latest application id.", error.message);
    return null;
  }

  return data?.id ?? null;
}
