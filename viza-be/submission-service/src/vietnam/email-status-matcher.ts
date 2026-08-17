import type { supabase } from "../supabase.js";

export type ParsedVietnamStatusEmail = {
  emailId: string;
  normalizedReference: string | null;
};

export type VietnamEmailMatchCounts = {
  queued: number;
  ambiguous: number;
  unmatched: number;
  duplicates: number;
};

type CountKey = keyof VietnamEmailMatchCounts;

const COUNT_KEYS: readonly CountKey[] = [
  "queued",
  "ambiguous",
  "unmatched",
  "duplicates",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCounts(data: unknown): VietnamEmailMatchCounts {
  const payload = Array.isArray(data)
    ? data.length === 1
      ? data[0]
      : null
    : data;
  if (!isRecord(payload)) {
    throw new Error("Invalid Vietnam email matcher counts");
  }

  const counts = {} as VietnamEmailMatchCounts;
  for (const key of COUNT_KEYS) {
    const value = payload[key];
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error("Invalid Vietnam email matcher counts");
    }
    counts[key] = value as number;
  }
  return counts;
}

export async function enqueueMatchedVietnamStatusEmails(
  client: Pick<typeof supabase, "rpc">,
  emails: readonly ParsedVietnamStatusEmail[],
): Promise<VietnamEmailMatchCounts> {
  if (emails.length === 0) {
    return { queued: 0, ambiguous: 0, unmatched: 0, duplicates: 0 };
  }

  const { data, error } = await client.rpc(
    "enqueue_vn_email_triggered_status_checks",
    { p_emails: emails.slice(0, 100) },
  );
  if (error) {
    throw new Error(
      `Failed to enqueue Vietnam email status checks: ${error.message}`,
    );
  }
  return parseCounts(data);
}
