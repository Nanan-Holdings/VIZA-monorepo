export interface StatusApplicantProfile {
  id: string;
  email: string | null;
  auth_user_id: string | null;
}

export interface StatusProfileReadResult {
  rows: StatusApplicantProfile[];
  failed: boolean;
}

export type StatusProfileLookupColumn = "id" | "auth_user_id" | "email";

interface StatusProfileLookupInput {
  sessionProfileId: string | null;
  authUserId: string;
  authEmail: string | null;
  read: (
    column: StatusProfileLookupColumn,
    value: string,
  ) => Promise<StatusProfileReadResult>;
}

export interface StatusProfileLookupResult {
  profiles: StatusApplicantProfile[];
  failed: boolean;
  queryCount: number;
}

function dedupeProfiles(rows: StatusApplicantProfile[]): StatusApplicantProfile[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

/**
 * A signed client session contains the applicant profile ID. Use that indexed
 * identity as the normal one-query path, while retaining auth/email fallbacks
 * for older sessions and legacy profile ownership rows.
 */
export async function loadStatusApplicantProfiles({
  sessionProfileId,
  authUserId,
  authEmail,
  read,
}: StatusProfileLookupInput): Promise<StatusProfileLookupResult> {
  let queryCount = 0;
  const runRead = async (
    column: StatusProfileLookupColumn,
    value: string,
  ): Promise<StatusProfileReadResult> => {
    queryCount += 1;
    return read(column, value);
  };

  const primary = sessionProfileId
    ? await runRead("id", sessionProfileId)
    : null;

  if (primary && !primary.failed && primary.rows.length > 0) {
    return {
      profiles: dedupeProfiles(primary.rows),
      failed: false,
      queryCount,
    };
  }

  const fallbackReads: Array<Promise<StatusProfileReadResult>> = [
    runRead("auth_user_id", authUserId),
  ];
  if (!sessionProfileId) {
    fallbackReads.push(runRead("id", authUserId));
  }
  if (authEmail) {
    fallbackReads.push(runRead("email", authEmail));
  }

  const fallback = await Promise.all(fallbackReads);
  return {
    profiles: dedupeProfiles([
      ...(primary?.rows ?? []),
      ...fallback.flatMap((result) => result.rows),
    ]),
    failed: Boolean(primary?.failed) || fallback.some((result) => result.failed),
    queryCount,
  };
}
