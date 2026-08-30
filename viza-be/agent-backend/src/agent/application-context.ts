import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "../db/supabase-client.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "ApplicationContext" });

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE_FIELDS =
  "id, full_name, date_of_birth, nationality, passport_issuing_country, passport_number, passport_expiry_date, email, phone";
const APPLICATION_FIELDS =
  "id, status, visa_type, country, arrival_date, departure_date, port_of_entry";
const JOINED_CONTEXT_FIELDS = `${PROFILE_FIELDS}, auth_user_id, applications(${APPLICATION_FIELDS}, created_at)`;

export interface ApplicationContext {
  profile: Record<string, string | null> | null;
  application: Record<string, string | null> | null;
}

interface LookupError {
  message: string;
}

export interface JoinedApplicationContextResult {
  data: unknown;
  error: LookupError | null;
}

export type JoinedApplicationContextLookup = (
  userId: string
) => Promise<JoinedApplicationContextResult>;

export type LegacyApplicationContextLookup = (
  userId: string
) => Promise<ApplicationContext>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapProfile(row: Record<string, unknown>): Record<string, string | null> {
  return {
    full_name: nullableString(row.full_name),
    date_of_birth: nullableString(row.date_of_birth),
    nationality: nullableString(row.nationality),
    passport_issuing_country: nullableString(row.passport_issuing_country),
    passport_number: nullableString(row.passport_number),
    passport_expiry_date: nullableString(row.passport_expiry_date),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
  };
}

function mapApplication(
  row: Record<string, unknown> | null
): Record<string, string | null> | null {
  if (!row) return null;

  return {
    id: nullableString(row.id),
    status: nullableString(row.status),
    visa_type: nullableString(row.visa_type),
    country: nullableString(row.country),
    arrival_date: nullableString(row.arrival_date),
    departure_date: nullableString(row.departure_date),
    port_of_entry: nullableString(row.port_of_entry),
  };
}

function firstApplication(row: Record<string, unknown>): Record<string, unknown> | null {
  const applications = row.applications;
  if (!Array.isArray(applications)) return null;
  return asRecord(applications[0]);
}

function selectPreferredProfileRow(data: unknown, userId: string): Record<string, unknown> | null {
  if (!Array.isArray(data)) return null;

  const normalizedUserId = userId.toLowerCase();
  const rows = data.map(asRecord).filter((row): row is Record<string, unknown> => row !== null);
  return (
    rows.find((row) => nullableString(row.id)?.toLowerCase() === normalizedUserId) ??
    rows.find(
      (row) => nullableString(row.auth_user_id)?.toLowerCase() === normalizedUserId
    ) ??
    null
  );
}

function mapJoinedContext(data: unknown, userId: string): ApplicationContext {
  const profile = selectPreferredProfileRow(data, userId);
  if (!profile) return { profile: null, application: null };

  return {
    profile: mapProfile(profile),
    application: mapApplication(firstApplication(profile)),
  };
}

function hasValidJoinedShape(data: unknown, userId: string): boolean {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;

  const profile = selectPreferredProfileRow(data, userId);
  return profile !== null && Array.isArray(profile.applications);
}

/**
 * Fetch a request-scoped profile and latest application in one PostgREST
 * request. The outer limit covers a theoretical id/auth_user_id collision;
 * the mapper preserves the historical id-first precedence.
 */
export async function fetchJoinedApplicationContext(
  userId: string,
  client: SupabaseClient = getSupabaseClient()
): Promise<JoinedApplicationContextResult> {
  if (!UUID_PATTERN.test(userId)) return { data: [], error: null };

  const result = await client
    .from("applicant_profiles")
    .select(JOINED_CONTEXT_FIELDS)
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .order("created_at", {
      referencedTable: "applications",
      ascending: false,
    })
    .limit(1, { referencedTable: "applications" })
    .limit(2);

  return { data: result.data, error: result.error };
}

export async function fetchLegacyApplicationContext(
  userId: string,
  client: SupabaseClient = getSupabaseClient()
): Promise<ApplicationContext> {
  const profileById = await client
    .from("applicant_profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  let profile = asRecord(profileById.data);
  if (!profile) {
    const profileByAuthUserId = await client
      .from("applicant_profiles")
      .select(PROFILE_FIELDS)
      .eq("auth_user_id", userId)
      .maybeSingle();
    profile = asRecord(profileByAuthUserId.data);
  }

  if (!profile) return { profile: null, application: null };

  const applicationResult = await client
    .from("applications")
    .select(APPLICATION_FIELDS)
    .eq("applicant_id", nullableString(profile.id) ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    profile: mapProfile(profile),
    application: mapApplication(asRecord(applicationResult.data)),
  };
}

export async function buildApplicationContextWithLookups(
  userId: string,
  joinedLookup: JoinedApplicationContextLookup,
  legacyLookup: LegacyApplicationContextLookup
): Promise<ApplicationContext> {
  if (!UUID_PATTERN.test(userId)) {
    return { profile: null, application: null };
  }

  try {
    const joinedResult = await joinedLookup(userId);
    if (
      !joinedResult.error &&
      hasValidJoinedShape(joinedResult.data, userId)
    ) {
      return mapJoinedContext(joinedResult.data, userId);
    }

    logger.warn(
      "application_context_join_failed_using_legacy_fallback",
      new Error("Joined application context lookup failed")
    );
  } catch {
    logger.warn(
      "application_context_join_failed_using_legacy_fallback",
      new Error("Joined application context lookup failed")
    );
  }

  try {
    return await legacyLookup(userId);
  } catch {
    logger.warn(
      "application_context_legacy_fallback_failed",
      new Error("Legacy application context lookup failed")
    );
    return { profile: null, application: null };
  }
}

/**
 * Build user-specific context without process-wide caching. The single joined
 * request is the normal path; the old sequence remains an availability fallback.
 */
export async function buildApplicationContext(
  userId: string
): Promise<ApplicationContext> {
  return buildApplicationContextWithLookups(
    userId,
    (lookupUserId) => fetchJoinedApplicationContext(lookupUserId),
    (lookupUserId) => fetchLegacyApplicationContext(lookupUserId)
  );
}
