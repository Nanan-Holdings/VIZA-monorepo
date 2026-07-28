import { describe, expect, it } from "vitest";

import {
  buildExistingAuthUserUpdate,
  shouldResetExistingPassword,
} from "../init-admin-account-helpers.mjs";

describe("init-admin-account", () => {
  it("does not reset an existing user's password unless reset was explicitly requested", () => {
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

  it("resets an existing user's password when reset and password were explicitly provided", () => {
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

  it("does not treat env or password-only values as permission to overwrite an existing password", () => {
    expect(
      shouldResetExistingPassword({
        resetPassword: false,
        passwordArg: "from-env-or-cli",
      })
    ).toBe(false);

    expect(
      shouldResetExistingPassword({
        resetPassword: true,
        passwordArg: undefined,
      })
    ).toBe(false);

    expect(
      shouldResetExistingPassword({
        resetPassword: true,
        passwordArg: "intentional-reset",
      })
    ).toBe(true);
  });
});
