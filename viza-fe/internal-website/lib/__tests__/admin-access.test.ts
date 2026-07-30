import { describe, expect, it } from "vitest";

import {
  ADMIN_EMAIL_ALLOWLIST,
  isAdminEmailAllowed,
  normalizeAdminEmail,
} from "../admin-access";

describe("admin email access", () => {
  it("allows every configured production admin email case-insensitively", () => {
    for (const email of ADMIN_EMAIL_ALLOWLIST) {
      expect(
        isAdminEmailAllowed(`  ${email.toUpperCase()}  `, {
          allowLocalTestAdmin: false,
        }),
      ).toBe(true);
    }
  });

  it("rejects emails outside the production allowlist", () => {
    expect(
      isAdminEmailAllowed("someone@example.com", {
        allowLocalTestAdmin: false,
      }),
    ).toBe(false);
  });

  it("only permits the local smoke-test admin outside production", () => {
    expect(
      isAdminEmailAllowed("admin@viza.test", {
        allowLocalTestAdmin: true,
      }),
    ).toBe(true);
    expect(
      isAdminEmailAllowed("admin@viza.test", {
        allowLocalTestAdmin: false,
      }),
    ).toBe(false);
  });

  it("normalizes whitespace and casing", () => {
    expect(normalizeAdminEmail("  E1484122@U.NUS.EDU ")).toBe(
      "e1484122@u.nus.edu",
    );
  });
});
