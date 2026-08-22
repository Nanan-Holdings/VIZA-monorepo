import { createAdminClient } from "@/lib/supabase/admin";

export const PH_ETRAVEL_SYNTHETIC_FIXTURE_MARKER_FIELD =
  "__ph_etravel_synthetic_fixture";

export const PH_ETRAVEL_SYNTHETIC_FIXTURE_VERSION =
  "ph_etravel_synthetic_fixture_v1";

export type PhEtravelSyntheticFixtureTransport = "AIR" | "SEA";

export type PhEtravelSyntheticFixtureAuthInput = {
  env: Record<string, string | undefined>;
  userEmail?: string | null;
  authorizationHeader?: string | null;
  nodeEnv?: string;
};

export type PhEtravelSyntheticFixtureAuthResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 404;
      code:
        | "synthetic_fixtures_disabled"
        | "synthetic_fixture_gate_unconfigured"
        | "synthetic_fixture_email_not_allowed"
        | "synthetic_fixture_token_required";
    };

export type PhEtravelSyntheticFixtureCreateResult =
  | {
      ok: true;
      applicationId: string;
      transportType: PhEtravelSyntheticFixtureTransport;
    }
  | { ok: false; status: number; code: string; error: string };

function parseAllowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function bearerToken(authorizationHeader: string | null | undefined): string {
  const value = authorizationHeader?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() ?? "";
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

export function normalizePhEtravelSyntheticFixtureTransport(
  value: unknown
): PhEtravelSyntheticFixtureTransport | null {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized === "AIR" || normalized === "SEA" ? normalized : null;
}

export function isPhEtravelSyntheticFixtureRequestAllowed(
  input: PhEtravelSyntheticFixtureAuthInput
): PhEtravelSyntheticFixtureAuthResult {
  if (input.env.PH_ETRAVEL_SYNTHETIC_FIXTURES_ENABLED !== "true") {
    return {
      allowed: false,
      status: 404,
      code: "synthetic_fixtures_disabled",
    };
  }

  const allowedEmails = parseAllowedEmails(
    input.env.PH_ETRAVEL_SYNTHETIC_FIXTURE_EMAILS
  );
  const requiredToken =
    input.env.PH_ETRAVEL_SYNTHETIC_FIXTURE_TOKEN?.trim() ?? "";
  const isProduction = input.nodeEnv === "production";

  if (isProduction && allowedEmails.size === 0 && !requiredToken) {
    return {
      allowed: false,
      status: 404,
      code: "synthetic_fixture_gate_unconfigured",
    };
  }

  if (allowedEmails.size > 0) {
    const email = input.userEmail?.trim().toLowerCase() ?? "";
    if (!email || !allowedEmails.has(email)) {
      return {
        allowed: false,
        status: 403,
        code: "synthetic_fixture_email_not_allowed",
      };
    }
  }

  if (requiredToken) {
    const suppliedToken = bearerToken(input.authorizationHeader);
    if (!safeEqual(suppliedToken, requiredToken)) {
      return {
        allowed: false,
        status: 403,
        code: "synthetic_fixture_token_required",
      };
    }
  }

  return { allowed: true };
}

export function phEtravelSyntheticFixtureSeedAnswers(input: {
  applicationId: string;
  transportType: PhEtravelSyntheticFixtureTransport;
  now: string;
}) {
  const marker = {
    version: PH_ETRAVEL_SYNTHETIC_FIXTURE_VERSION,
    product: "PH_ETRAVEL_ARRIVAL_CARD",
    transportType: input.transportType,
    createdAt: input.now,
    pii: false,
    officialPortal: false,
  };

  return [
    {
      application_id: input.applicationId,
      field_name: PH_ETRAVEL_SYNTHETIC_FIXTURE_MARKER_FIELD,
      value_text: JSON.stringify(marker),
      updated_at: input.now,
    },
    {
      application_id: input.applicationId,
      field_name: "flight_type",
      value_text: "ARRIVAL",
      updated_at: input.now,
    },
    {
      application_id: input.applicationId,
      field_name: "registration_for",
      value_text: "FOR_ME",
      updated_at: input.now,
    },
    {
      application_id: input.applicationId,
      field_name: "transport_type",
      value_text: input.transportType,
      updated_at: input.now,
    },
  ];
}

export async function createPhEtravelSyntheticFixtureDraft(input: {
  authUserId: string;
  transportType: PhEtravelSyntheticFixtureTransport;
  now?: string;
  admin?: ReturnType<typeof createAdminClient>;
}): Promise<PhEtravelSyntheticFixtureCreateResult> {
  const admin = input.admin ?? createAdminClient();
  const now = input.now ?? new Date().toISOString();

  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();
  if (profileError) {
    return {
      ok: false,
      status: 500,
      code: "profile_lookup_failed",
      error: "Could not verify the signed-in applicant profile.",
    };
  }
  if (!profile?.id) {
    return {
      ok: false,
      status: 404,
      code: "profile_not_found",
      error: "Applicant profile not found.",
    };
  }

  const { data: created, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: "philippines",
      visa_type: "PH_ETRAVEL_ARRIVAL_CARD",
      visa_package_id: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (createError || !created?.id) {
    return {
      ok: false,
      status: 500,
      code: "application_create_failed",
      error: "Could not create an isolated Philippines eTravel draft.",
    };
  }

  const seedRows = phEtravelSyntheticFixtureSeedAnswers({
    applicationId: created.id,
    transportType: input.transportType,
    now,
  });
  const { error: seedError } = await admin
    .from("visa_application_answers")
    .insert(seedRows);
  if (seedError) {
    return {
      ok: false,
      status: 500,
      code: "fixture_seed_failed",
      error:
        "Created the draft but could not mark it as a Philippines synthetic fixture.",
    };
  }

  return {
    ok: true,
    applicationId: created.id,
    transportType: input.transportType,
  };
}
