import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractFranceTlsActivationUrlFromMessage,
  isFranceTlsActivationMessage,
  isFranceTlsActivationRequiredText,
  isFranceTlsActivationExpiredText,
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
});
