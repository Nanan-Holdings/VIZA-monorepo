#!/usr/bin/env npx tsx
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (input, init) => fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    }),
  },
});

function readApplicationId(): string {
  const marker = "--application-id=";
  const value = process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim();
  if (!value) throw new Error("--application-id is required");
  return value;
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return firstRelation(value[0]);
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ status: "probing" }));
  const applicationId = readApplicationId();
  const startedAt = Date.now();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(
      "id, applicant_id, country, visa_type, appointment_assistance_status, applicant_profiles!inner(auth_user_id,inbox_alias)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) throw applicationError;

  const profile = firstRelation(application?.applicant_profiles);
  const [{ data: queueRow, error: queueError }, { data: accounts, error: accountError }, inboxProbe] =
    await Promise.all([
      supabase
        .from("submission_queue")
        .select("official_application_reference_encrypted")
        .eq("application_id", applicationId)
        .not("official_application_reference_encrypted", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("appointment_accounts")
        .select("account_status,email_verified,portal")
        .eq("application_id", applicationId)
        .eq("portal", "tlscontact_cn_fr")
        .order("updated_at", { ascending: false })
        .limit(3),
      supabase.from("inbound_email").select("id", { count: "exact", head: true }),
    ]);
  if (queueError) throw queueError;
  if (accountError) throw accountError;

  console.log(JSON.stringify({
    reachable: true,
    latencyMs: Date.now() - startedAt,
    applicationFound: Boolean(application),
    isFrance: String(application?.country ?? "").toLowerCase() === "france",
    hasApplicantId: Boolean(application?.applicant_id),
    hasAuthUser: typeof profile?.auth_user_id === "string",
    hasInboxAlias: typeof profile?.inbox_alias === "string",
    hasOfficialReference: Boolean(queueRow?.official_application_reference_encrypted),
    appointmentStatus: application?.appointment_assistance_status ?? null,
    existingTlsAccounts: (accounts ?? []).map((account) => ({
      status: account.account_status,
      emailVerified: account.email_verified,
      portal: account.portal,
    })),
    inboundEmailTableReachable: !inboxProbe.error,
    inboundEmailCountAvailable: inboxProbe.count !== null,
  }, null, 2));
}

const keepAlive = setInterval(() => undefined, 1_000);
main().catch((error: unknown) => {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  console.error(JSON.stringify({
    reachable: false,
    code: typeof record?.code === "string" ? record.code : null,
    message: error instanceof Error
      ? error.message.split("\n")[0]
      : typeof record?.message === "string"
        ? record.message.split("\n")[0]
        : String(error),
    details: typeof record?.details === "string" ? record.details.split("\n")[0] : null,
  }, null, 2));
  process.exit(1);
}).finally(() => clearInterval(keepAlive));
