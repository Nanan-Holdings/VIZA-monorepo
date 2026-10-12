import { describe, expect, it } from "vitest";
import {
  getJpVjwCredentialKeys,
  hasAuthoritativeJpVjwResult,
  resolveJpVjwStoredCredentials,
} from "./jp-vjw-credentials.js";

const empty = { email: null, password: null, registrationState: null };

describe("Visit Japan Web credential reveal policy", () => {
  it("requires qr_ready plus a persisted official QR artifact", () => {
    const result = {
      country: "JP",
      visaType: "JP_VISIT_JAPAN_WEB",
      status: "qr_ready",
      submitted: true,
      qrReady: true,
      artifacts: { qrCodes: ["applications/japan/qr.png"] },
    };
    expect(hasAuthoritativeJpVjwResult(result)).toBe(true);
    expect(hasAuthoritativeJpVjwResult({ ...result, artifacts: { qrCodes: [] } })).toBe(false);
    expect(hasAuthoritativeJpVjwResult({ ...result, status: "submitted" })).toBe(false);
  });

  it("keeps credentials isolated by application key", () => {
    expect(getJpVjwCredentialKeys("application-one")).not.toEqual(
      getJpVjwCredentialKeys("application-two"),
    );
  });

  it("returns a complete registered scoped credential pair for the exact alias", () => {
    expect(resolveJpVjwStoredCredentials({
      alias: "app-one@viza.it.com",
      scoped: {
        email: "APP-ONE@VIZA.IT.COM",
        password: "TestPassword2!",
        registrationState: "registered",
      },
      legacy: empty,
    })).toEqual({
      ok: true,
      email: "app-one@viza.it.com",
      password: "TestPassword2!",
      source: "scoped",
    });
  });

  it("never returns legacy credentials belonging to another application alias", () => {
    expect(resolveJpVjwStoredCredentials({
      alias: "app-two@viza.it.com",
      scoped: empty,
      legacy: {
        email: "app-one@viza.it.com",
        password: "TestPassword2!",
        registrationState: "registered",
      },
    })).toEqual({ ok: false, reason: "alias_mismatch" });
  });

  it("fails closed for partial or unregistered credentials", () => {
    expect(resolveJpVjwStoredCredentials({
      alias: "app-one@viza.it.com",
      scoped: { email: "app-one@viza.it.com", password: null, registrationState: "registered" },
      legacy: empty,
    })).toEqual({ ok: false, reason: "partial" });
    expect(resolveJpVjwStoredCredentials({
      alias: "app-one@viza.it.com",
      scoped: { email: "app-one@viza.it.com", password: "TestPassword2!", registrationState: "pending" },
      legacy: empty,
    })).toEqual({ ok: false, reason: "not_registered" });
  });
});
