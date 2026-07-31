import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

type FakeProfile = { inbox_alias: string | null };

function fakeClient(initial: FakeProfile, options: { collisionOnce?: boolean } = {}) {
  let profile = { ...initial };
  let collided = false;

  return {
    get profile() {
      return profile;
    },
    from(table: string) {
      assert.equal(table, "applicant_profiles");

      const applyCollisionOrValue = (inboxMustBeNull = false): { data: FakeProfile | null; error: { code: string; message: string } | null } => {
        if (options.collisionOnce && !collided) {
          collided = true;
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }

        if (inboxMustBeNull && profile.inbox_alias !== null) {
          return { data: null, error: null };
        }

        return { data: profile, error: null };
      };

      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: profile, error: null };
                },
              };
            },
          };
        },
        update(update: Partial<FakeProfile>) {
          const resultWithUpdate = (inboxMustBeNull: boolean) => {
            const existing = profile;
            const { data, error } = applyCollisionOrValue(inboxMustBeNull);

            if (error) {
              return { data: null, error };
            }

            if (!error && data === null) {
              return { data: null, error: null };
            }

            const nextProfile = { ...profile, ...update };
            if (existing !== nextProfile) {
              profile = nextProfile;
            }
            return { data: profile, error: null };
          };

          return {
            eq() {
              return {
                is() {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          return resultWithUpdate(true);
                        },
                      };
                    },
                  };
                },
                select() {
                  return {
                    async maybeSingle() {
                      return resultWithUpdate(false);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("applicant inbox alias", () => {
  it("returns an existing alias", async () => {
    const { ensureApplicantInboxAlias } = await import("../alias");
    const client = fakeClient({ inbox_alias: "APPL-EXISTING@HAGGSTORM.COM" });

    const result = await ensureApplicantInboxAlias("profile-1", client as never);

    assert.deepEqual(result, { alias: "appl-existing@haggstorm.com", created: false });
  });

  it("creates an alias when missing", async () => {
    const { ensureApplicantInboxAlias } = await import("../alias");
    const client = fakeClient({ inbox_alias: null });

    const result = await ensureApplicantInboxAlias("profile-1", client as never);

    assert.equal(result.created, true);
    assert.match(result.alias, /^appl-[0-9a-z]{26}@viza\.it\.com$/);
  });

  it("supports custom domain for generated alias", async () => {
    const { generateApplicantInboxAlias } = await import("../alias");

    const alias = generateApplicantInboxAlias(1_700_000_000_000, "Test-Example.COM");

    assert.equal(alias.endsWith("@test-example.com"), true);
  });

  it("overwrites inbox_alias with a requested domain", async () => {
    const { ensureApplicantInboxAliasForDomain } = await import("../alias");
    const client = fakeClient({ inbox_alias: null });

    const result = await ensureApplicantInboxAliasForDomain("profile-1", "example.org", client as never);

    assert.match(result.alias, /^appl-[0-9a-z]{26}@example\.org$/);
    assert.equal(client.profile.inbox_alias, result.alias);
  });

  it("retries on unique collisions", async () => {
    const { ensureApplicantInboxAlias } = await import("../alias");
    const client = fakeClient({ inbox_alias: null }, { collisionOnce: true });

    const result = await ensureApplicantInboxAlias("profile-1", client as never);

    assert.equal(result.created, true);
    assert.match(result.alias, /^appl-[0-9a-z]{26}@viza\.it\.com$/);
  });
});

describe("applicant inbox routing", () => {
  it("accepts a domain with a usable MX record", async () => {
    const { assertInboxAliasDomainRoutable } = await import("../wait-for-message");

    await assert.doesNotReject(
      assertInboxAliasDomainRoutable(
        "appl-test@example.org",
        async () => [{ exchange: "inbound.example.org", priority: 10 }],
      ),
    );
  });

  it("rejects a domain without a usable MX record", async () => {
    const {
      assertInboxAliasDomainRoutable,
      InboxDomainUnroutableError,
    } = await import("../wait-for-message");

    await assert.rejects(
      assertInboxAliasDomainRoutable("appl-test@example.org", async () => []),
      InboxDomainUnroutableError,
    );
  });

  it("rejects a null MX domain", async () => {
    const {
      assertInboxAliasDomainRoutable,
      InboxDomainUnroutableError,
    } = await import("../wait-for-message");

    await assert.rejects(
      assertInboxAliasDomainRoutable(
        "appl-test@example.org",
        async () => [{ exchange: ".", priority: 0 }],
      ),
      InboxDomainUnroutableError,
    );
  });

  it("retries a transient DNS timeout before accepting a usable MX record", async () => {
    const { assertInboxAliasDomainRoutable } = await import("../wait-for-message");
    let attempts = 0;

    await assert.doesNotReject(
      assertInboxAliasDomainRoutable(
        "appl-test@example.org",
        async () => {
          attempts += 1;
          if (attempts === 1) {
            throw Object.assign(new Error("queryMx ETIMEOUT example.org"), {
              code: "ETIMEOUT",
            });
          }
          return [{ exchange: "inbound.example.org", priority: 10 }];
        },
        { retryDelaysMs: [0] },
      ),
    );
    assert.equal(attempts, 2);
  });

  it("still rejects a transient DNS failure after bounded retries", async () => {
    const {
      assertInboxAliasDomainRoutable,
      InboxDomainUnroutableError,
    } = await import("../wait-for-message");
    let attempts = 0;

    await assert.rejects(
      assertInboxAliasDomainRoutable(
        "appl-test@example.org",
        async () => {
          attempts += 1;
          throw Object.assign(new Error("queryMx ETIMEOUT example.org"), {
            code: "ETIMEOUT",
          });
        },
        { retryDelaysMs: [0, 0], fallbackResolver: null },
      ),
      InboxDomainUnroutableError,
    );
    assert.equal(attempts, 3);
  });

  it("uses DNS-over-HTTPS after native MX lookups exhaust transient retries", async () => {
    const { assertInboxAliasDomainRoutable } = await import("../wait-for-message");
    let nativeAttempts = 0;
    let fallbackAttempts = 0;

    await assert.doesNotReject(
      assertInboxAliasDomainRoutable(
        "appl-test@example.org",
        async () => {
          nativeAttempts += 1;
          throw Object.assign(new Error("queryMx ETIMEOUT example.org"), {
            code: "ETIMEOUT",
          });
        },
        {
          retryDelaysMs: [0],
          fallbackResolver: async () => {
            fallbackAttempts += 1;
            return [{ exchange: "inbound.example.org", priority: 10 }];
          },
        },
      ),
    );
    assert.equal(nativeAttempts, 2);
    assert.equal(fallbackAttempts, 1);
  });
});
