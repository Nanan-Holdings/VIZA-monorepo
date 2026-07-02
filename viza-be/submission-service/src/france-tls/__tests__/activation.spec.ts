import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractFranceTlsActivationUrlFromMessage,
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
});

