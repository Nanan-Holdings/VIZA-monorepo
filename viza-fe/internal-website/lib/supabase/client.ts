import { createBrowserClient } from "@supabase/ssr";

import { normalizeSupabaseEnvValue } from "./env";
import { createFetchWithTransientRetry } from "./fetch-with-timeout";

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
      global: {
        fetch: createFetchWithTransientRetry({
          // supabase-auth-js already retries token refreshes. A second shared
          // browser circuit turns one offline moment into a burst of synthetic
          // circuit-open errors across unrelated form requests.
          circuitBreakerScope: null,
          // supabase-auth-js logs every thrown fetch error to the console.
          // Returning a real 503 lets it use its normal retryable-error path.
          returnUnavailableResponse: true,
        }),
      },
      auth: {
        flowType: "implicit",
      },
    }
  );
}
