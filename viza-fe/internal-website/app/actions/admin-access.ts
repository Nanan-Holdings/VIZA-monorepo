"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireAdmin } from "@/lib/rbac";
import { hasActiveAdminMembership as lookupActiveAdminMembership } from "@/lib/admin-membership";
import { hashAdminInviteToken } from "@/lib/admin-invite-token";

/** Keep the narrow dynamic query surface server-only and out of client code. */
type Row = Record<string, unknown>;
type QueryResponse<T extends Row = Row> = {
  data: T | T[] | null;
  error: { code?: string; message: string } | null;
};
type QueryResult<T extends Row = Row> = Promise<QueryResponse<T>>;
type QueryBuilder<T extends Row = Row> = PromiseLike<QueryResponse<T>> & {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  is(column: string, value: null): QueryBuilder<T>;
  in(column: string, values: readonly unknown[]): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  maybeSingle(): QueryResult<T>;
  single(): QueryResult<T>;
  insert(values: Row | Row[]): QueryBuilder<T>;
  update(values: Row): QueryBuilder<T>;
  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): QueryBuilder<T>;
};
type DynamicClient = {
  from(table: string): QueryBuilder;
  rpc<T extends Row = Row>(name: string, args?: Row): QueryResult<T>;
};

function dynamicClient(client: unknown): DynamicClient {
  return client as DynamicClient;
}

export type HighAccessStatus = "active" | "revoked" | "expired";
export type InviteStatus = "pending" | "claimed" | "accepted" | "revoked" | "expired";

export interface HighAccessGrant {
  id: string;
  userId: string;
  status: HighAccessStatus;
  startsAt: string;
  expiresAt: string | null;
  isPermanent: boolean;
  reason: string | null;
  grantedBy: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminRegistrationInvite {
  id: string;
  status: InviteStatus;
  expiresAt: string;
  claimedEmail: string | null;
  claimedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export type AdminActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export type InviteClaimResult =
  | { success: true; status: "ready"; message: string }
  | { success: false; error: string };

export type InviteAcceptResult =
  | { success: true; message: string }
  | { success: false; error: string };

const GENERIC_INVITE_ERROR =
  "This invitation is invalid, expired, revoked, or already used.";
const GENERIC_INVITE_ERROR_ZH = "注册链接无效、已过期、已撤销或已使用。";

function genericInviteError(locale?: string): string {
  return locale === "zh" ? GENERIC_INVITE_ERROR_ZH : GENERIC_INVITE_ERROR;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table/i.test(error.message ?? "");
}

function rowValue<T>(row: Row | null | undefined, key: string, fallback: T): T {
  const value = row?.[key];
  return value === undefined || value === null ? fallback : (value as T);
}

function firstRow(data: Row | Row[] | null): Row | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function toHighAccessGrant(row: Row): HighAccessGrant {
  const status = rowValue<string>(row, "status", "active");
  const expiresAt = rowValue<string | null>(row, "expires_at", null);
  const isExpired = status === "active" && expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
  return {
    id: rowValue<string>(row, "id", ""),
    userId: rowValue<string>(row, "auth_user_id", rowValue<string>(row, "user_id", "")),
    status: status === "revoked"
      ? "revoked"
      : status === "expired" || isExpired
        ? "expired"
        : "active",
    startsAt: rowValue<string>(row, "starts_at", rowValue<string>(row, "created_at", "")),
    expiresAt,
    isPermanent: rowValue<boolean>(row, "is_permanent", rowValue<string | null>(row, "expires_at", null) === null),
    reason: rowValue<string | null>(row, "reason", null),
    grantedBy: rowValue<string | null>(row, "granted_by_admin_id", rowValue<string | null>(row, "granted_by", rowValue<string | null>(row, "created_by", null))),
    revokedBy: rowValue<string | null>(row, "revoked_by_admin_id", rowValue<string | null>(row, "revoked_by", null)),
    revokedAt: rowValue<string | null>(row, "revoked_at", null),
    createdAt: rowValue<string>(row, "created_at", ""),
  };
}

function toInvite(row: Row): AdminRegistrationInvite {
  const status = rowValue<string>(row, "status", "pending");
  const expiresAt = rowValue<string>(row, "expires_at", "");
  const isExpired = (status === "pending" || status === "claimed") && expiresAt !== "" && new Date(expiresAt).getTime() <= Date.now();
  return {
    id: rowValue<string>(row, "id", ""),
    status: status === "claimed" || status === "accepted" || status === "revoked" || status === "expired" || isExpired ? (isExpired ? "expired" : status) : "pending",
    expiresAt,
    claimedEmail: rowValue<string | null>(row, "claimed_email", null),
    claimedAt: rowValue<string | null>(row, "claimed_at", null),
    createdAt: rowValue<string>(row, "created_at", ""),
    createdBy: rowValue<string | null>(row, "created_by_admin_id", rowValue<string | null>(row, "created_by", null)),
  };
}

async function recordAdminCommand(
  actorId: string,
  command: string,
  targetType: string,
  targetId: string,
  reason: string,
  beforeState: Row,
  afterState: Row,
): Promise<{ ok: boolean; error?: string }> {
  const admin = dynamicClient(createAdminClient());
  const { error } = await admin.from("admin_command_events").insert({
    actor_user_id: actorId,
    command,
    target_type: targetType,
    target_id: targetId,
    reason,
    before_state: beforeState,
    after_state: afterState,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function requireAdminActor() {
  await requireAdmin();
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "admin") throw new Error("Admin privileges required");
  return actor;
}

async function buildInviteUrl(token: string): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const origin = configuredOrigin || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "http://127.0.0.1:3000");
  return `${origin}/admin/register?token=${encodeURIComponent(token)}`;
}

/** Return whether the current account has an active database-backed membership. */
export async function hasActiveAdminMembership(userId: string): Promise<boolean> {
  return lookupActiveAdminMembership(createAdminClient(), userId);
}

/** Read the current account's active or historical high-access grants. */
export async function listHighAccessGrants(userId: string): Promise<HighAccessGrant[]> {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") return [];
  const admin = dynamicClient(createAdminClient());
  const expiry = await admin.rpc("expire_applicant_access_grants", {
    p_auth_user_id: userId,
  });
  if (expiry.error) return [];
  const result = await admin
    .from("applicant_access_grants")
    .select("id, auth_user_id, status, starts_at, expires_at, granted_by_admin_id, revoked_by_admin_id, revoked_at, reason, created_at")
    .eq("auth_user_id", userId)
    .order("created_at", { ascending: false });
  if (result.error || !result.data) return [];
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  return rows.map(toHighAccessGrant);
}

/** Grant or extend the account-wide high-access entitlement. */
export async function grantHighAccess(input: {
  userId: string;
  duration?: "year" | "permanent";
  expiresAt?: string | null;
  reason: string;
}): Promise<AdminActionResult> {
  try {
    const actor = await requireAdminActor();
    const userId = input.userId.trim();
    const reason = input.reason.trim();
    if (!userId || reason.length < 3) {
      return { success: false, error: "A target account and a short reason are required." };
    }
    const duration = input.duration === "permanent" ? "permanent" : "year";
    const now = new Date();

    const admin = dynamicClient(createAdminClient());
    const existingResult = await admin
      .from("applicant_access_grants")
      .select("*")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (existingResult.error && !isSchemaMissing(existingResult.error)) {
      return { success: false, error: "Unable to load the current access grant." };
    }

    const before = existingResult.data && !Array.isArray(existingResult.data) ? existingResult.data : {};
    const existingExpiry = rowValue<string | null>(before, "expires_at", null);
    const existingGrantId = rowValue<string>(before, "id", "");
    const existingIsLive = Boolean(existingGrantId) && (existingExpiry === null || new Date(existingExpiry).getTime() > now.getTime());
    const baseTime = existingExpiry && new Date(existingExpiry).getTime() > now.getTime()
      ? new Date(existingExpiry).getTime()
      : now.getTime();
    const expiresAt = duration === "permanent" || (existingIsLive && existingExpiry === null)
      ? null
      : input.expiresAt && !Number.isNaN(Date.parse(input.expiresAt))
        ? new Date(input.expiresAt).toISOString()
        : new Date(baseTime + 365 * 24 * 60 * 60 * 1000).toISOString();

    const mutation = await admin.rpc("grant_applicant_high_access", {
      p_auth_user_id: userId,
      p_admin_id: actor.id,
      p_expires_at: expiresAt,
      p_reason: reason,
      p_metadata: { source: "admin_portal", action: existingIsLive ? "extended" : "granted" },
    });
    const mutationData = firstRow(mutation.data);
    const grantId = rowValue<string>(mutationData, "id", "");
    if (mutation.error || !grantId) {
      return { success: false, error: "Unable to save high access. Please try again." };
    }

    const audit = await recordAdminCommand(actor.id, existingIsLive ? "applicant_access.extend" : "applicant_access.grant", "applicant_access_grants", grantId, reason, before, {
      auth_user_id: userId,
      status: "active",
      expires_at: expiresAt,
      permanent: duration === "permanent",
    });
    if (!audit.ok) console.error("Additional high-access audit failed after mutation", audit.error);
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");
    return { success: true, message: duration === "permanent" ? "Permanent high access granted." : "High access granted for one year." };
  } catch (error) {
    console.error("grantHighAccess failed", error);
    return { success: false, error: "Unable to change high access." };
  }
}

/** Revoke the active account-wide high-access entitlement. */
export async function revokeHighAccess(input: { userId: string; reason: string }): Promise<AdminActionResult> {
  try {
    const actor = await requireAdminActor();
    const userId = input.userId.trim();
    const reason = input.reason.trim();
    if (!userId || reason.length < 3) {
      return { success: false, error: "A target account and a short reason are required." };
    }
    const admin = dynamicClient(createAdminClient());
    const existing = await admin.from("applicant_access_grants").select("*").eq("auth_user_id", userId).eq("status", "active").maybeSingle();
    if (existing.error || !existing.data || Array.isArray(existing.data)) {
      return { success: false, error: "No active high access grant was found." };
    }
    const grantId = rowValue<string>(existing.data, "id", "");
    const mutation = await admin.rpc("revoke_applicant_high_access", {
      p_grant_id: grantId,
      p_admin_id: actor.id,
      p_reason: reason,
    });
    const now = new Date().toISOString();
    const updated = firstRow(mutation.data);
    if (mutation.error || !updated) {
      return { success: false, error: "Unable to revoke high access." };
    }
    const audit = await recordAdminCommand(actor.id, "applicant_access.revoke", "applicant_access_grants", grantId, reason, existing.data, { status: "revoked", revoked_at: now });
    if (!audit.ok) console.error("Additional high-access audit failed after revocation", audit.error);
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");
    return { success: true, message: "High access revoked." };
  } catch (error) {
    console.error("revokeHighAccess failed", error);
    return { success: false, error: "Unable to revoke high access." };
  }
}

/** Create a 24-hour, one-use admin registration invitation. */
export async function createAdminRegistrationInvite(input?: { reason?: string }): Promise<
  | { success: true; inviteUrl: string; expiresAt: string }
  | { success: false; error: string }
> {
  try {
    const actor = await requireAdminActor();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashAdminInviteToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const admin = dynamicClient(createAdminClient());
    const inserted = await admin.rpc("create_admin_registration_invite", {
      p_token_digest: tokenHash,
      p_admin_id: actor.id,
      p_metadata: { reason: input?.reason?.trim() || "Admin registration invitation" },
    });
    const insertedRow = firstRow(inserted.data);
    if (inserted.error || !insertedRow) {
      console.error("createAdminRegistrationInvite RPC failed", inserted.error);
      return { success: false, error: "Unable to create the registration link." };
    }
    const inviteId = rowValue<string>(insertedRow, "id", "");
    const persistedExpiry = rowValue<string>(insertedRow, "expires_at", expiresAt);
    const audit = await recordAdminCommand(actor.id, "admin_invite.create", "admin_registration_invites", inviteId, input?.reason?.trim() || "Admin registration invitation", {}, { status: "pending", expires_at: persistedExpiry });
    if (!audit.ok) console.error("Additional admin invite audit failed after creation", audit.error);
    revalidatePath("/admin/team");
    return { success: true, inviteUrl: await buildInviteUrl(token), expiresAt: persistedExpiry };
  } catch (error) {
    console.error("createAdminRegistrationInvite failed", error);
    return { success: false, error: "Unable to create the registration link." };
  }
}

/** List recent invitations for the Team page. The raw token is never returned. */
export async function listAdminRegistrationInvites(): Promise<AdminRegistrationInvite[]> {
  const adminUser = await getCurrentUser();
  if (!adminUser || adminUser.role !== "admin") return [];
  const admin = dynamicClient(createAdminClient());
  const expiry = await admin.rpc("expire_admin_registration_invites");
  if (expiry.error) return [];
  const result = await admin.from("admin_registration_invites").select("id, status, expires_at, claimed_email, claimed_at, created_at, created_by_admin_id").order("created_at", { ascending: false }).limit(50);
  if (result.error || !result.data) return [];
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  return rows.map(toInvite);
}

/** Revoke an unused or claimed invitation. */
export async function revokeAdminRegistrationInvite(input: { inviteId: string; reason: string }): Promise<AdminActionResult> {
  try {
    const actor = await requireAdminActor();
    const inviteId = input.inviteId.trim();
    const reason = input.reason.trim();
    if (!inviteId || reason.length < 3) return { success: false, error: "An invitation and a short reason are required." };
    const admin = dynamicClient(createAdminClient());
    const existing = await admin.from("admin_registration_invites").select("*").eq("id", inviteId).maybeSingle();
    if (existing.error || !existing.data || Array.isArray(existing.data)) return { success: false, error: "Invitation not found." };
    const status = rowValue<string>(existing.data, "status", "pending");
    if (status === "accepted" || status === "revoked" || status === "expired") return { success: false, error: "This invitation can no longer be revoked." };
    const updated = await admin.rpc("revoke_admin_registration_invite", {
      p_invite_id: inviteId,
      p_admin_id: actor.id,
      p_reason: reason,
    });
    const updatedRow = firstRow(updated.data);
    if (updated.error || !updatedRow) return { success: false, error: "Unable to revoke the invitation." };
    const revokedAt = rowValue<string | null>(updatedRow, "revoked_at", null);
    const audit = await recordAdminCommand(actor.id, "admin_invite.revoke", "admin_registration_invites", inviteId, reason, existing.data, { status: "revoked", revoked_at: revokedAt });
    if (!audit.ok) console.error("Additional admin invite audit failed after revocation", audit.error);
    revalidatePath("/admin/team");
    return { success: true, message: "Invitation revoked." };
  } catch (error) {
    console.error("revokeAdminRegistrationInvite failed", error);
    return { success: false, error: "Unable to revoke the invitation." };
  }
}

/**
 * Bind an unbound invitation to the first email that presents it. This action
 * never reports whether that email already has an account; the next step is
 * intentionally the same generic sign-in/verification guidance for both paths.
 */
export async function claimAdminRegistrationInvite(input: { token: string; email: string; locale?: "en" | "zh" }): Promise<InviteClaimResult> {
  const token = input.token.trim();
  const email = normalizeEmail(input.email);
  if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: genericInviteError(input.locale) };
  const admin = dynamicClient(createAdminClient());
  const claimed = await admin.rpc("claim_admin_registration_invite", {
    p_token_digest: hashAdminInviteToken(token),
    p_claimed_email: email,
    p_claimed_user_id: null,
  });
  const claimedInvite = firstRow(claimed.data);
  if (claimed.error || !claimedInvite) return { success: false, error: genericInviteError(input.locale) };
  const inviteId = rowValue<string>(claimedInvite, "id", "");

  // Send an Auth invite only when no public customer account exists. Existing
  // accounts must authenticate themselves; this avoids Supabase's duplicate
  // invite error and preserves their profile/password.
  const existing = await admin.from("users").select("id").eq("email", email).is("deleted_at", null).maybeSingle();
  if (!existing.data) {
    const inviteUrl = await buildInviteUrl(token);
    const inviteTarget = new URL(inviteUrl);
    const nextPath = `${inviteTarget.pathname}${inviteTarget.search}&flow=complete`;
    const redirectTo = `${inviteTarget.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      await admin.from("admin_registration_invites").update({ status: "pending", claimed_email: null, claimed_user_id: null, claimed_at: null, updated_at: new Date().toISOString() }).eq("id", inviteId).eq("status", "claimed");
      console.error("Supabase admin invite failed", error);
      return { success: false, error: genericInviteError(input.locale) };
    }
  }
  return { success: true, status: "ready", message: input.locale === "zh" ? "请使用此邮箱完成验证或登录，然后返回注册链接完成接受。" : "Use this email to verify or sign in, then return to the invitation link to finish." };
}

/** Accept a claimed invitation using the currently authenticated, verified email. */
export async function acceptAdminRegistrationInvite(input: { token: string; password?: string; name?: string; locale?: "en" | "zh" }): Promise<InviteAcceptResult> {
  const token = input.token.trim();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!token || !authUser?.email || !authUser.email_confirmed_at) return { success: false, error: genericInviteError(input.locale) };
  const email = normalizeEmail(authUser.email);
  const admin = dynamicClient(createAdminClient());
  const invite = await admin.from("admin_registration_invites").select("id, status, claimed_email, expires_at").eq("token_digest", hashAdminInviteToken(token)).eq("status", "claimed").eq("claimed_email", email).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (invite.error || !invite.data || Array.isArray(invite.data)) return { success: false, error: genericInviteError(input.locale) };
  const inviteId = rowValue<string>(invite.data, "id", "");

  if (input.password !== undefined) {
    if (input.password.length < 8) return { success: false, error: input.locale === "zh" ? "密码至少需要 8 位。" : "Password must be at least 8 characters." };
    const { error } = await supabase.auth.updateUser({ password: input.password, data: input.name?.trim() ? { name: input.name.trim() } : undefined });
    if (error) return { success: false, error: input.locale === "zh" ? "无法设置密码，请重试。" : "Unable to set the password. Please try again." };
  }

  const accepted = await admin.rpc("accept_admin_registration_invite", {
    p_token_digest: hashAdminInviteToken(token),
    p_user_id: authUser.id,
    p_email: email,
    p_name: input.name?.trim() || null,
  });
  const acceptedRow = firstRow(accepted.data);
  const membershipId = rowValue<string>(acceptedRow, "membership_id", "");
  if (accepted.error || !acceptedRow || !membershipId) return { success: false, error: genericInviteError(input.locale) };
  const audit = await recordAdminCommand(authUser.id, "admin_invite.accept", "admin_registration_invites", inviteId, "Invitation accepted", {}, { user_id: authUser.id, membership_id: membershipId, status: "accepted" });
  if (!audit.ok) console.error("Additional admin invite audit failed after atomic acceptance", audit.error);
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { success: true, message: input.locale === "zh" ? "管理员账号已启用。" : "Admin access is now active." };
}

/**
 * Existing customer accounts use this boundary instead of the normal admin
 * login action (which correctly rejects them until membership is granted).
 * The invitation is checked before password authentication and every failure
 * returns the same message so the route cannot be used for account probing.
 */
export async function signInForAdminInvite(input: {
  token: string;
  email: string;
  password: string;
  name?: string;
  locale?: "en" | "zh";
}): Promise<InviteAcceptResult> {
  const email = normalizeEmail(input.email);
  const admin = dynamicClient(createAdminClient());
  const invite = await admin
    .from("admin_registration_invites")
    .select("id")
    .eq("token_digest", hashAdminInviteToken(input.token.trim()))
    .eq("status", "claimed")
    .eq("claimed_email", email)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (invite.error || !invite.data || Array.isArray(invite.data) || !input.password) {
    return { success: false, error: genericInviteError(input.locale) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { success: false, error: genericInviteError(input.locale) };
  return acceptAdminRegistrationInvite({
    token: input.token,
    name: input.name,
    locale: input.locale,
  });
}
