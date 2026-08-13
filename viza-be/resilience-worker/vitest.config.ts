import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      // The checked-in Workerd binary currently supports through 2026-08-11;
      // production keeps the current compatibility date in wrangler.jsonc.
      compatibilityDate: "2026-08-11",
      bindings: {
        VIZA_RESILIENCE_HMAC_SECRET: "test-only-secret",
        SUPABASE_MANAGEMENT_API_TOKEN: "test-management-token",
        VIZA_RESILIENCE_KEY_ID: "viza-web-v1",
      },
    },
  })],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
