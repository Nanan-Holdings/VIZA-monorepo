import { describe, expect, it } from "vitest";

import { buildExistingAuthUserUpdate } from "../init-admin-account-helpers.mjs";

describe("init-admin-account", () => {
  it("does not reset an existing user's password unless a password was explicitly provided", () => {
    const update = buildExistingAuthUserUpdate({
      existingUserMetadata: { locale: "zh" },
      name: "VIZA Test Admin",
      role: "admin",
      password: "Viza-random-generated!1",
      shouldUpdatePassword: false,
    });

    expect(update).toEqual({
      user_metadata: {
        locale: "zh",
        name: "VIZA Test Admin",
        role: "admin",
      },
    });
  });

  it("resets an existing user's password when a password was explicitly provided", () => {
    const update = buildExistingAuthUserUpdate({
      existingUserMetadata: {},
      name: "VIZA Test Admin",
      role: "admin",
      password: "explicit-password",
      shouldUpdatePassword: true,
    });

    expect(update).toEqual({
      password: "explicit-password",
      user_metadata: {
        name: "VIZA Test Admin",
        role: "admin",
      },
    });
  });
});
