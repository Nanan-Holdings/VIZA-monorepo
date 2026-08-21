import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractFranceTlsActivationUrlFromMessage,
  extractFranceTlsPasswordResetUrlFromMessage,
  isFranceTlsActivationMessage,
  isFranceTlsActivationRequiredText,
  isFranceTlsActivationExpiredText,
  isFranceTlsPasswordResetCompletedText,
  isFranceTlsPasswordResetMessage,
} from "../activation";

describe("France TLS activation", () => {
  it("extracts a TLScontact activation URL from encoded email HTML", () => {
    const url = extractFranceTlsActivationUrlFromMessage({
      text: null,
      html: [
        "<p>Activate your TLScontact account</p>",
        '<a href="https://visas-fr.tlscontact.com/en-us/activate-account?token=abc=3D123&amp;issuerId=3DcnSHA2fr">',
        "Activate account",
        "</a>",
      ].join(""),
    });

    assert.equal(url?.hostname, "visas-fr.tlscontact.com");
    assert.match(url?.href ?? "", /activate-account/);
    assert.match(url?.href ?? "", /issuerId=cnSHA2fr/);
  });

  it("detects expired TLScontact activation screens", () => {
    assert.equal(isFranceTlsActivationExpiredText("Action expired. Please start again."), true);
    assert.equal(isFranceTlsActivationExpiredText("Please check your email to activate your account."), false);
  });

  it("detects the official account activation required screen", () => {
    assert.equal(
      isFranceTlsActivationRequiredText(
        "Activate your account Please check your email and click the link to activate your account.",
      ),
      true,
    );
    assert.equal(isFranceTlsActivationRequiredText("Welcome to your TLScontact account"), false);
  });

  it("accepts a generic activation subject delivered by TLScontact through SES", () => {
    assert.equal(isFranceTlsActivationMessage({
      from_addr: "no-reply@eu-north-1.amazonses.com",
      subject: "Activate your account",
      text: "Open https://visas-fr.tlscontact.com/en-us/activate-account?token=opaque",
      html: null,
    }), true);
    assert.equal(isFranceTlsActivationMessage({
      from_addr: "unknown@example.com",
      subject: "Activate your account",
      text: "Open https://example.com/activate?token=opaque",
      html: null,
    }), false);
  });

  it("extracts only trusted TLScontact password-reset action links", () => {
    const message = {
      from_addr: "no-reply@eu-north-1.amazonses.com",
      subject: "Reset your TLScontact password",
      text: null,
      html: [
        '<a href="https://example.com/login-actions/action-token?key=wrong">Ignore</a>',
        '<a href="https://i2-auth.visas-fr.tlscontact.com/auth/realms/atlas/login-actions/action-token?key=opaque&amp;client_id=atlas">Reset password</a>',
      ].join(""),
    };

    const url = extractFranceTlsPasswordResetUrlFromMessage(message);
    assert.equal(url?.hostname, "i2-auth.visas-fr.tlscontact.com");
    assert.equal(url?.searchParams.get("key"), "opaque");
    assert.equal(isFranceTlsPasswordResetMessage(message), true);
  });

  it("rejects password-reset lookalikes from an untrusted sender", () => {
    assert.equal(isFranceTlsPasswordResetMessage({
      from_addr: "attacker@example.com",
      subject: "Reset your TLScontact password",
      text: "https://i2-auth.visas-fr.tlscontact.com/auth/realms/atlas/login-actions/action-token?key=opaque",
      html: null,
    }), false);
  });

  it("recognizes verified password-reset completion copy", () => {
    assert.equal(isFranceTlsPasswordResetCompletedText("Your password has been updated."), true);
    assert.equal(isFranceTlsPasswordResetCompletedText("Enter a new password"), false);
  });
});
