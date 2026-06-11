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
          return {
            eq() {
              return {
                is() {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          if (options.collisionOnce && !collided) {
                            collided = true;
                            return { data: null, error: { code: "23505", message: "duplicate" } };
                          }
                          if (profile.inbox_alias !== null) {
                            return { data: null, error: null };
                          }
                          profile = { ...profile, ...update };
                          return { data: profile, error: null };
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
    assert.match(result.alias, /^appl-[0-9a-z]{26}@haggstorm\.com$/);
  });

  it("retries on unique collisions", async () => {
    const { ensureApplicantInboxAlias } = await import("../alias");
    const client = fakeClient({ inbox_alias: null }, { collisionOnce: true });

    const result = await ensureApplicantInboxAlias("profile-1", client as never);

    assert.equal(result.created, true);
    assert.match(result.alias, /^appl-[0-9a-z]{26}@haggstorm\.com$/);
  });
});
