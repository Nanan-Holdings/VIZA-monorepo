import dotenv from "dotenv";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";

dotenv.config({ path: ".env" });
dotenv.config({ path: "../../viza-fe/internal-website/.env.local" });
dotenv.config({ path: "../../.agents/local-test-credentials.env" });

async function main(): Promise<void> {
  process.env.PH_ETRAVEL_BROWSERBASE_PROXIES ??= "false";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const email = process.env.VIZA_TEST_CLIENT_EMAIL?.trim();
  const password = process.env.VIZA_TEST_CLIENT_PASSWORD?.trim();
  if (!url || !anon || !email || !password) throw new Error("Local test auth configuration is incomplete.");

  const session = await connectBrowserbaseCloudBrowser({ prefix: "PH_ETRAVEL" });
  try {
    console.log("Browserbase connected; checking test-client scoped Supabase access.");
    const result = await session.page.evaluate(async (input) => {
      const auth = await fetch(`${input.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: input.anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.email, password: input.password }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!auth.ok) return { stage: "auth", status: auth.status, profile: null };
      const authPayload = await auth.json() as { access_token?: string; user?: { id?: string } };
      const token = authPayload.access_token ?? "";
      const userId = authPayload.user?.id ?? "";
      const profile = await fetch(
        `${input.url}/rest/v1/applicant_profiles?auth_user_id=eq.${encodeURIComponent(userId)}&select=id,inbox_alias,full_name,passport_number&limit=1`,
        { headers: { apikey: input.anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
      );
      if (!profile.ok) return { stage: "profile", status: profile.status, profile: null };
      const rows = await profile.json() as Array<{ id?: string; inbox_alias?: string; full_name?: string; passport_number?: string }>;
      return { stage: "ok", status: 200, profile: rows[0] ?? null };
    }, { url, anon, email, password });

    console.log(JSON.stringify({
      stage: result.stage,
      status: result.status,
      profileId: result.profile?.id ?? null,
      hasAlias: Boolean(result.profile?.inbox_alias),
      hasName: Boolean(result.profile?.full_name),
      hasPassport: Boolean(result.profile?.passport_number),
    }, null, 2));
  } finally {
    await session.browser.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
