import "server-only";

// eslint-disable-next-line no-restricted-imports -- The authenticated Home reader supplies the profile owner to this server-only helper.
import type { createAdminClient } from "@/lib/supabase/admin";
import { tracePortalReadStage } from "@/lib/observability/portal-read";

type QueryResult = { data: unknown; error: unknown };
type HomeOwnerReads = {
  profileResult: QueryResult;
  applicationResult: QueryResult;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** No cross-request state: the caller must freshly authenticate this profile ID. */
export async function loadHomeProfileApplications(
  client: ReturnType<typeof createAdminClient>,
  profileId: string,
  options: { profileColumns: string; applicationColumns: string; signal: AbortSignal },
): Promise<HomeOwnerReads> {
  options.signal.throwIfAborted();
  const ownerId = profileId.toLowerCase();
  const applicationColumns = options.applicationColumns.split(",").map((column) => column.trim());
  const embeddedColumns = [...new Set(["applicant_id", ...applicationColumns])].join(",");
  const projection = [
    "id",
    options.profileColumns,
    `owned_applications:applications!applications_applicant_id_fkey(${embeddedColumns})`,
  ].join(",");
  // Both logical stages share this one request. These durations overlap and
  // must not be summed; fetch instrumentation still records exactly one GET.
  const combined = await tracePortalReadStage("profile", () =>
    tracePortalReadStage("applications", () => client
      .from("applicant_profiles")
      .select(projection)
      .eq("id", ownerId)
      .eq("owned_applications.applicant_id", ownerId)
      .order("created_at", { referencedTable: "owned_applications", ascending: false })
      .maybeSingle()),
  );
  if (!combined.error) {
    // Left embedding retains a profile with no applications. With only one
    // parent, PostgREST's per-relation row cap matches the former top-level read.
    if (combined.data === null) {
      return {
        profileResult: { data: null, error: null },
        applicationResult: { data: [], error: null },
      };
    }
    const parent = record(combined.data);
    if (parent?.id === ownerId && Array.isArray(parent.owned_applications)) {
      const applications = parent.owned_applications.map(record);
      if (applications.every((row) => row !== null && row.applicant_id === ownerId && typeof row.id === "string")) {
        const profile = Object.fromEntries(options.profileColumns.split(",").map((column) => {
          const key = column.trim();
          return [key, parent[key]];
        }));
        return {
          profileResult: { data: profile, error: null },
          applicationResult: {
            data: applications.map((row) => Object.fromEntries(
              applicationColumns.map((column) => [column, row?.[column]]),
            )),
            error: null,
          },
        };
      }
    }
  }

  // One compatibility fallback preserves the old profile/application error
  // precedence and partial profile result if a relation or child read fails.
  // Never start additional work after the shared Home budget has expired.
  options.signal.throwIfAborted();
  const [profileResult, applicationResult] = await Promise.all([
    tracePortalReadStage("profile", () => client.from("applicant_profiles")
      .select(options.profileColumns).eq("id", ownerId).maybeSingle()),
    tracePortalReadStage("applications", () => client.from("applications")
      .select(options.applicationColumns).eq("applicant_id", ownerId)
      .order("created_at", { ascending: false })),
  ]);
  return { profileResult, applicationResult };
}
