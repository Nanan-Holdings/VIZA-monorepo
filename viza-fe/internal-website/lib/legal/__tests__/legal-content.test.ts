import { describe, expect, it } from "vitest";
import { enDisclaimerArticle, enPrivacyArticle, enTermsArticle } from "../en-legal-content";

describe("English legal articles", () => {
  it("uses the VIZA visa-assistance legal copy for all public legal pages", () => {
    expect(enTermsArticle.title).toBe("Terms of Service");
    expect(JSON.stringify(enTermsArticle)).toContain("visa application assistance platform");

    expect(enPrivacyArticle.title).toBe("Privacy Policy");
    expect(JSON.stringify(enPrivacyArticle)).toContain("We do not sell your personal information.");

    expect(enDisclaimerArticle.title).toBe("Disclaimer");
    expect(JSON.stringify(enDisclaimerArticle)).toContain("Non-Government Affiliation");
  });
});
