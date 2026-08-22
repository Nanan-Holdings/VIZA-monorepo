import { describe, expect, it } from "vitest";
import { toBrowserSafeFranceVisasAccount } from "./route-handler";

describe("France-Visas browser account projection", () => {
  it("returns only masked account status and never credential or reference fields", () => {
    const projection = toBrowserSafeFranceVisasAccount({
      id: "account-1",
      applicant_id: "applicant-1",
      email: "applicant@example.com",
      updated_at: "2026-08-19T00:00:00.000Z",
      created_at: null,
    });

    expect(projection).toEqual({
      email: "ap•••@example.com",
      configured: true,
      verificationStatus: "unknown",
      portalUrl: "https://application-form.france-visas.gouv.fr/fv-fo-dde/",
      updatedAt: "2026-08-19T00:00:00.000Z",
    });
    expect(projection).not.toHaveProperty("password");
    expect(projection).not.toHaveProperty("officialReference");
    expect(JSON.stringify(projection)).not.toContain("SUBMISSION_RESULT_SECRET_KEY");
  });

  it("does not echo an unmasked or malformed email", () => {
    expect(
      toBrowserSafeFranceVisasAccount({
        id: "account-2",
        applicant_id: "applicant-1",
        email: "a@example.com",
        updated_at: null,
        created_at: "2026-08-18T00:00:00.000Z",
      }).email,
    ).toBe("a•••@example.com");
    expect(
      toBrowserSafeFranceVisasAccount({
        id: "account-3",
        applicant_id: "applicant-1",
        email: "malformed-email",
        updated_at: null,
        created_at: null,
      }).email,
    ).toBe("••••");
  });
});
