import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ds160RecoverySecretKey,
  resolveStoredCeacRecoveryCredentials,
} from "../stored-recovery";

describe("stored CEAC recovery credentials", () => {
  it("uses an explicit official ID and applicant-provided recovery answer", () => {
    const result = resolveStoredCeacRecoveryCredentials({
      application: { ds160_application_id: "aa00exampl1" },
      answers: {
        surname: "Example",
        date_of_birth: "1990-02-03",
        ds160_security_answer: "Applicant supplied",
      },
      profile: {},
    });

    assert.deepEqual(result, {
      status: "ready",
      credentials: {
        applicationId: "AA00EXAMPL1",
        surnameFirstFive: "EXAMP",
        yearOfBirth: "1990",
        securityAnswer: "Applicant supplied",
      },
    });
  });

  it("can use previously encrypted recovery metadata without exposing ciphertext", () => {
    const decryptInputs: string[] = [];
    const result = resolveStoredCeacRecoveryCredentials({
      application: {
        submission_result: {
          country: "US",
          applicationId: "AA00EXAMPL2",
          surnameFirst5: "EXAMP",
          yearOfBirth: 1991,
          securityAnswerCipher: "fake-ciphertext",
        },
      },
      answers: {},
      profile: {},
      decryptSecurityAnswer: (ciphertext) => {
        decryptInputs.push(ciphertext);
        return "Recovered in memory";
      },
    });

    assert.equal(result.status, "ready");
    assert.deepEqual(decryptInputs, ["fake-ciphertext"]);
    assert.doesNotMatch(JSON.stringify(result), /fake-ciphertext/);
  });

  it("uses an application-scoped vault secret without persisting it into answers", () => {
    const result = resolveStoredCeacRecoveryCredentials({
      application: { ds160_application_id: "AA00EXAMPL2" },
      answers: {
        surname: "Example",
        date_of_birth_year: "1991",
      },
      profile: {},
      securityAnswer: "Vault-only answer",
    });

    assert.equal(result.status, "ready");
    assert.equal(result.status === "ready" ? result.credentials.securityAnswer : null, "Vault-only answer");
  });

  it("derives an isolated vault key only from a valid VIZA application ID", () => {
    assert.equal(
      ds160RecoverySecretKey("11111111-2222-4333-8444-555555555555"),
      "us.ds160.11111111-2222-4333-8444-555555555555.security_answer",
    );
    assert.throws(() => ds160RecoverySecretKey("not-an-application"), /valid VIZA application ID/i);
  });

  it("never guesses a recovery answer from mother surname or a constant", () => {
    const result = resolveStoredCeacRecoveryCredentials({
      application: { ds160_application_id: "AA00EXAMPL3" },
      answers: {
        surname: "Example",
        mother_surname: "MustNotBeUsed",
        date_of_birth_year: "1992",
      },
      profile: {},
    });

    assert.deepEqual(result, {
      status: "unavailable",
      missing: ["security_answer"],
      applicationId: "AA00EXAMPL3",
    });
  });

  it("fails closed when stored official application IDs conflict", () => {
    const result = resolveStoredCeacRecoveryCredentials({
      application: {
        ds160_application_id: "AA00EXAMPL4",
        submission_result: { country: "US", applicationId: "AA00EXAMPL5" },
      },
      answers: {},
      profile: {},
    });

    assert.deepEqual(result, {
      status: "invalid",
      reason: "official_application_id_conflict",
    });
  });
});
