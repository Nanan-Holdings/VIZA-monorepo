import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for QA-001 (e2e), QA-002 (a11y), QA-003 (mobile).
 *
 * `npm run test:e2e`     — happy path + edge cases on desktop chromium
 * `npm run test:a11y`    — axe-core sweep on /home /application /signup
 * `npm run test:mobile`  — iPhone 14 + Pixel 7 viewport matrix
 *
 * BASE_URL defaults to the local dev server; CI overrides to the staging URL.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "e2e-desktop",
      testMatch: /tests\/e2e\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "a11y",
      testMatch: /tests\/a11y\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-iphone-14",
      testMatch: /tests\/mobile\/.+\.spec\.ts/,
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "mobile-pixel-7",
      testMatch: /tests\/mobile\/.+\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
