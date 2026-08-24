import assert from "node:assert/strict";
import test from "node:test";
import {
  generateJpVjwPortalPassword,
  JpVjwAccountStateError,
  resolveJpVjwAccountState,
} from "../account";

test("generates a conservative Visit Japan Web password satisfying the official classes", () => {
  for (let index = 0; index < 30; index += 1) {
    const password = generateJpVjwPortalPassword();
    assert.equal(password.length, 16);
    assert.match(password, /[A-Z]/u);
    assert.match(password, /[a-z]/u);
    assert.match(password, /[0-9]/u);
    assert.match(password, /!/u);
  }
});

test("reuses a complete credential pair only for the same managed alias", () => {
  assert.deepEqual(resolveJpVjwAccountState({
    aliasEmail: "APPL-ONE@VIZA.IT.COM",
    storedEmail: "appl-one@viza.it.com",
    storedPassword: "StoredPass2!",
    storedRegistrationState: "registered",
    generatedPassword: "UnusedPass2!",
  }), {
    email: "appl-one@viza.it.com",
    password: "StoredPass2!",
    registrationState: "registered",
    reuseExistingAccount: true,
  });
});

test("fails closed for partial or cross-application credentials", () => {
  assert.throws(() => resolveJpVjwAccountState({
    aliasEmail: "appl-one@viza.it.com",
    storedEmail: "appl-one@viza.it.com",
    storedPassword: null,
    storedRegistrationState: null,
    generatedPassword: "Generated2!",
  }), JpVjwAccountStateError);
  assert.throws(() => resolveJpVjwAccountState({
    aliasEmail: "appl-one@viza.it.com",
    storedEmail: "appl-two@viza.it.com",
    storedPassword: "StoredPass2!",
    storedRegistrationState: "registered",
    generatedPassword: "Generated2!",
  }), JpVjwAccountStateError);
});
