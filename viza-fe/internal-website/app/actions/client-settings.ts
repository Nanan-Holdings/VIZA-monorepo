"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import {
  FREQUENT_TRAVELER_PROFILE_SELECT,
  isMissingOptionalFrequentTravelerColumnError,
  normalizeFrequentTravelerInput,
  stripOptionalFrequentTravelerProfileColumns,
  toFrequentTravelerSummary,
  type FrequentTravelerInput,
  type FrequentTravelerProfileRow,
  type FrequentTravelerSummary,
} from "@/lib/frequent-traveler-profile";

export type { FrequentTravelerInput, FrequentTravelerSummary } from "@/lib/frequent-traveler-profile";

export type PrivacyRequestType = "export" | "deletion";

export interface DataPrivacyRequestSummary {
  id: string;
  requestType: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  fulfilledAt: string | null;
}

type DataPrivacyRequestRow = {
  id: string;
  request_type: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  fulfilled_at: string | null;
};

type PrivacyRequestResult =
  | {
      success: true;
      requests: DataPrivacyRequestSummary[];
    }
  | {
      success: false;
      error: string;
    };

type CreatePrivacyRequestResult =
  | {
      success: true;
      request: DataPrivacyRequestSummary;
      alreadyPending: boolean;
    }
  | {
      success: false;
      error: string;
    };

type FrequentTravelerListResult =
  | {
      success: true;
      travelers: FrequentTravelerSummary[];
    }
  | {
      success: false;
      error: string;
    };

type FrequentTravelerMutationResult =
  | {
      success: true;
      traveler: FrequentTravelerSummary;
    }
  | {
      success: false;
      error: string;
    };

type DeleteFrequentTravelerResult =
  | {
      success: true;
      id: string;
    }
  | {
      success: false;
      error: string;
    };

const ACTIVE_REQUEST_STATUSES = new Set([
  "requested",
  "pending",
  "queued",
  "reviewing",
  "in_review",
  "processing",
  "in_progress",
]);

const REQUEST_TYPE_ALIASES = {
  export: ["export", "data_export", "personal_data_export"],
  deletion: ["deletion", "delete", "data_deletion"],
} satisfies Record<PrivacyRequestType, string[]>;

function toSummary(row: DataPrivacyRequestRow): DataPrivacyRequestSummary {
  return {
    id: row.id,
    requestType: row.request_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fulfilledAt: row.fulfilled_at,
  };
}

async function getAuthenticatedAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function getApplicantId(): Promise<string | null> {
  const session = await getUserFromSupabaseSession();
  return session?.userId ?? null;
}

export async function getDataPrivacyRequests(): Promise<PrivacyRequestResult> {
  const applicantId = await getApplicantId();

  if (!applicantId) {
    return { success: false, error: "Please sign in again to view privacy requests." };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("data_privacy_requests")
      .select("id, request_type, status, created_at, updated_at, fulfilled_at")
      .eq("applicant_id", applicantId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("Failed to load data privacy requests:", error);
      return {
        success: false,
        error: "We could not load your privacy request history right now.",
      };
    }

    return {
      success: true,
      requests: ((data ?? []) as DataPrivacyRequestRow[]).map(toSummary),
    };
  } catch (error) {
    console.error("Unexpected privacy request history error:", error);
    return {
      success: false,
      error: "We could not load your privacy request history right now.",
    };
  }
}

export async function createDataPrivacyRequest(
  requestType: PrivacyRequestType
): Promise<CreatePrivacyRequestResult> {
  const aliases = REQUEST_TYPE_ALIASES[requestType];
  if (!aliases) {
    return { success: false, error: "Unsupported privacy request type." };
  }

  const applicantId = await getApplicantId();

  if (!applicantId) {
    return { success: false, error: "Please sign in again to submit this request." };
  }

  try {
    const adminClient = createAdminClient();

    const { data: existingRequests, error: existingError } = await adminClient
      .from("data_privacy_requests")
      .select("id, request_type, status, created_at, updated_at, fulfilled_at")
      .eq("applicant_id", applicantId)
      .in("request_type", [...aliases])
      .order("created_at", { ascending: false })
      .limit(10);

    if (existingError) {
      console.error("Failed to check pending data privacy requests:", existingError);
      return {
        success: false,
        error: "We could not submit this request right now.",
      };
    }

    const activeRequest = ((existingRequests ?? []) as DataPrivacyRequestRow[]).find(
      (request) => ACTIVE_REQUEST_STATUSES.has(request.status.toLowerCase())
    );

    if (activeRequest) {
      return {
        success: true,
        request: toSummary(activeRequest),
        alreadyPending: true,
      };
    }

    const { data, error } = await adminClient
      .from("data_privacy_requests")
      .insert({
        applicant_id: applicantId,
        request_type: requestType,
        status: "requested",
      })
      .select("id, request_type, status, created_at, updated_at, fulfilled_at")
      .single();

    if (error || !data) {
      console.error("Failed to create data privacy request:", error);
      return {
        success: false,
        error: "We could not submit this request right now.",
      };
    }

    revalidatePath("/client/settings");

    return {
      success: true,
      request: toSummary(data as DataPrivacyRequestRow),
      alreadyPending: false,
    };
  } catch (error) {
    console.error("Unexpected privacy request create error:", error);
    return {
      success: false,
      error: "We could not submit this request right now.",
    };
  }
}

export async function getFrequentTravelers(): Promise<FrequentTravelerListResult> {
  const user = await getAuthenticatedAuthUser();

  if (!user) {
    return { success: false, error: "Please sign in again to view travelers." };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("applicant_profiles")
      .select(FREQUENT_TRAVELER_PROFILE_SELECT)
      .eq("dependant_of_user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to load frequent travelers:", error);
      return { success: false, error: "We could not load your travelers right now." };
    }

    return {
      success: true,
      travelers: ((data ?? []) as FrequentTravelerProfileRow[]).map(toFrequentTravelerSummary),
    };
  } catch (error) {
    console.error("Unexpected frequent traveler list error:", error);
    return { success: false, error: "We could not load your travelers right now." };
  }
}

export async function createFrequentTraveler(
  input: FrequentTravelerInput
): Promise<FrequentTravelerMutationResult> {
  const user = await getAuthenticatedAuthUser();

  if (!user) {
    return { success: false, error: "Please sign in again to add a traveler." };
  }

  const normalized = normalizeFrequentTravelerInput(input);
  if ("error" in normalized) {
    return { success: false, error: normalized.error };
  }

  try {
    const adminClient = createAdminClient();
    const payload = {
      ...normalized.value,
      dependant_of_user_id: user.id,
      auth_user_id: null,
      language_pref: "zh",
      onboarding_done: true,
    };
    let { data, error } = await adminClient
      .from("applicant_profiles")
      .insert(payload)
      .select(FREQUENT_TRAVELER_PROFILE_SELECT)
      .single();

    if (error && isMissingOptionalFrequentTravelerColumnError(error.message)) {
      const fallback = await adminClient
        .from("applicant_profiles")
        .insert(stripOptionalFrequentTravelerProfileColumns(payload))
        .select(FREQUENT_TRAVELER_PROFILE_SELECT)
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      console.error("Failed to create frequent traveler:", error);
      return { success: false, error: "We could not save this traveler right now." };
    }

    revalidatePath("/client/settings");

    return {
      success: true,
      traveler: toFrequentTravelerSummary(data as FrequentTravelerProfileRow),
    };
  } catch (error) {
    console.error("Unexpected frequent traveler create error:", error);
    return { success: false, error: "We could not save this traveler right now." };
  }
}

export async function updateFrequentTraveler(
  id: string,
  input: FrequentTravelerInput
): Promise<FrequentTravelerMutationResult> {
  const user = await getAuthenticatedAuthUser();

  if (!user) {
    return { success: false, error: "Please sign in again to update a traveler." };
  }

  const normalized = normalizeFrequentTravelerInput(input);
  if ("error" in normalized) {
    return { success: false, error: normalized.error };
  }

  try {
    const adminClient = createAdminClient();
    let { data, error } = await adminClient
      .from("applicant_profiles")
      .update(normalized.value)
      .eq("id", id)
      .eq("dependant_of_user_id", user.id)
      .is("deleted_at", null)
      .select(FREQUENT_TRAVELER_PROFILE_SELECT)
      .single();

    if (error && isMissingOptionalFrequentTravelerColumnError(error.message)) {
      const fallback = await adminClient
        .from("applicant_profiles")
        .update(stripOptionalFrequentTravelerProfileColumns(normalized.value))
        .eq("id", id)
        .eq("dependant_of_user_id", user.id)
        .is("deleted_at", null)
        .select(FREQUENT_TRAVELER_PROFILE_SELECT)
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      console.error("Failed to update frequent traveler:", error);
      return { success: false, error: "We could not update this traveler right now." };
    }

    revalidatePath("/client/settings");

    return {
      success: true,
      traveler: toFrequentTravelerSummary(data as FrequentTravelerProfileRow),
    };
  } catch (error) {
    console.error("Unexpected frequent traveler update error:", error);
    return { success: false, error: "We could not update this traveler right now." };
  }
}

export async function deleteFrequentTraveler(
  id: string
): Promise<DeleteFrequentTravelerResult> {
  const user = await getAuthenticatedAuthUser();

  if (!user) {
    return { success: false, error: "Please sign in again to delete a traveler." };
  }

  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("applicant_profiles")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("dependant_of_user_id", user.id);

    if (error) {
      console.error("Failed to delete frequent traveler:", error);
      return { success: false, error: "We could not delete this traveler right now." };
    }

    revalidatePath("/client/settings");

    return { success: true, id };
  } catch (error) {
    console.error("Unexpected frequent traveler delete error:", error);
    return { success: false, error: "We could not delete this traveler right now." };
  }
}
