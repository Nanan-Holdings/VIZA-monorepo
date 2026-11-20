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

  it("waits on the application's own inbox alias, not the applicant's", async () => {
    const { inbox } = require("../../inbox/wait-for-message") as typeof import("../../inbox/wait-for-message");
    const { createSupabaseMailboxProvider } = require("../mailbox-provider") as typeof import("../mailbox-provider");
    const original = inbox.waitForApplicationMessage;
    const calls: Array<[string, string]> = [];
    inbox.waitForApplicationMessage = (async (applicationId: string, applicantId: string) => {
      calls.push([applicationId, applicantId]);
      return {
        html: '<a href="https://connect.france-visas.gouv.fr/realms/usager/login-actions/action-token?key=k">Verify</a>',
        text: null,
      };
    }) as unknown as typeof inbox.waitForApplicationMessage;
    try {
      const url = await createSupabaseMailboxProvider("application-1", "applicant-1")
        .waitForVerificationLink({ mailboxAddress: "alias@viza.test", timeoutMs: 1_000 });
      assert.equal(url.hostname, "connect.france-visas.gouv.fr");
      assert.deepEqual(calls, [["application-1", "applicant-1"]]);
    } finally {
      inbox.waitForApplicationMessage = original;
    }
  });
});
