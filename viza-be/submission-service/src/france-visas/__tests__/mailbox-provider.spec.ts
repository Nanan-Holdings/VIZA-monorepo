import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

describe("France-Visas mailbox provider", () => {
  it("extracts verification links from HTML", () => {
    const { extractVerificationUrlFromMessage } = require("../mailbox-provider") as typeof import("../mailbox-provider");
    const url = extractVerificationUrlFromMessage({
      html: '<a href="https://connect.france-visas.gouv.fr/realms/usager/login-actions/action-token?key=abc&amp;client_id=fv">Verify</a>',
      text: null,
    });

    assert.equal(
      url?.toString(),
      "https://connect.france-visas.gouv.fr/realms/usager/login-actions/action-token?key=abc&client_id=fv",
    );
  });

  it("extracts quoted-printable text links", () => {
    const { extractVerificationUrlFromMessage } = require("../mailbox-provider") as typeof import("../mailbox-provider");
    const url = extractVerificationUrlFromMessage({
      html: null,
      text: "Confirm: https://connect.france-visas.gouv.fr/realms/usager/login-actions/action-token?key=3Dabc=26client_id=3Dfv",
    });

    assert.equal(
      url?.toString(),
      "https://connect.france-visas.gouv.fr/realms/usager/login-actions/action-token?key=abc&client_id=fv",
    );
  });

  it("ignores unrelated links", () => {
    const { extractVerificationUrlFromMessage } = require("../mailbox-provider") as typeof import("../mailbox-provider");
    const url = extractVerificationUrlFromMessage({
      html: '<a href="https://example.com/reset">Ignore</a>',
      text: null,
    });

    assert.equal(url, null);
  });
});
