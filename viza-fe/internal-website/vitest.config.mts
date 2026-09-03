import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // tests/ holds Playwright specs (e2e, a11y, mobile, perf). They are run by
    // `npm run test:e2e` and friends; Vitest cannot execute them.
    exclude: ["node_modules/**", "dist/**", ".next/**", "tests/**"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "app/actions/companion-sessions.ts",
        "app/client/new-report/category-score-utils.ts",
        "components/client/companion/**/*.tsx",
        "hooks/use-agent-socket.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./vitest.server-only.ts"),
    },
  },
});
