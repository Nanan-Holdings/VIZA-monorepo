/**
 * Small, dependency-free membership lookup shared by the Supabase session
 * boundary and server-side admin actions. The generated Database type will be
 * updated with the membership migration; until then this module keeps the
 * narrow dynamic cast in one place.
 */
type MembershipQueryResponse = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
};

type MembershipQuery = {
  select(columns: string): MembershipQuery;
  eq(column: string, value: string): MembershipQuery;
  is(column: string, value: null): MembershipQuery;
  maybeSingle(): Promise<MembershipQueryResponse>;
};

type MembershipClient = {
  from(table: string): MembershipQuery;
};

function asMembershipClient(client: unknown): MembershipClient {
  return client as MembershipClient;
}

/**
 * A membership is active only when both the status and revocation marker say
 * so. Missing tables or query errors intentionally fail closed.
 */
export async function hasActiveAdminMembership(client: unknown, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await asMembershipClient(client)
    .from("admin_memberships")
    .select("id, status, revoked_at")
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();
  return !error && Boolean(data);
}
