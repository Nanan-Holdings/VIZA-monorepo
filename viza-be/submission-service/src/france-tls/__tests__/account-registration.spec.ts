import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateFranceTlsAccountPassword,
  isAuthenticatedFranceTlsRedirectUrl,
} from "../account-registration";

describe("France TLS account registration", () => {
  it("generates a TLS-compatible password without leaking deterministic credentials", () => {
    const first = generateFranceTlsAccountPassword();
    const second = generateFranceTlsAccountPassword();

    for (const password of [first, second]) {
      assert.equal(password.length, 16);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[!@#$%^&*_+=?\-]/);
      assert.match(password, /^[A-Za-z0-9!@#$%^&*_+=?\-]+$/);
    }
    assert.notEqual(first, second);
  });

  it("only treats a redirect away from the TLS identity host as authenticated", () => {
    assert.equal(
      isAuthenticatedFranceTlsRedirectUrl(
        "https://i2-auth.visas-fr.tlscontact.com/auth/realms/atlas/login-actions/authenticate",
      ),
      false,
    );
    assert.equal(
      isAuthenticatedFranceTlsRedirectUrl("https://visas-fr.tlscontact.com/en-us/"),
      true,
    );
  });
});
