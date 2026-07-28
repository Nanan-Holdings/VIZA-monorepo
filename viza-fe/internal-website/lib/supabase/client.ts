import { createBrowserClient } from "@supabase/ssr";

import { normalizeSupabaseEnvValue } from "./env";

export function createClient() {
  return createBrowserClient(
    normalizeSupabaseEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL"
    ),
    normalizeSupabaseEnvValue(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),
    {
      auth: {
        flowType: "implicit",
      },
    }
  );
}
