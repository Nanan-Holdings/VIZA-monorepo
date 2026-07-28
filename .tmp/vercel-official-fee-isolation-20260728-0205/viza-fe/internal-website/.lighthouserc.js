/**
 * Lighthouse perf budget (QA-004 — non-blocking).
 *
 * Runs against the deployed preview URL. Numbers are tracked in PR
 * comments but do not fail the build.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        "https://www.viza.app/",
        "https://www.viza.app/signup",
        "https://www.viza.app/home",
      ],
      numberOfRuns: 3,
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "interaction-to-next-paint": ["warn", { maxNumericValue: 200 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
