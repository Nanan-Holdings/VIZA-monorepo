import { describe, expect, it } from "vitest";
import { isAllowedUkResumeUrl } from "./uk-visa-links";

describe("isAllowedUkResumeUrl", () => {
  it.each([
    "https://visas-immigration.service.gov.uk/forceResume/application-token",
    "https://apply-uk-visa.service.gov.uk/forceResume?token=application-token",
  ])("accepts the official resume shape: %s", (value) => {
    expect(isAllowedUkResumeUrl(value)).toBe(true);
  });

  it.each([
    "http://visas-immigration.service.gov.uk/forceResume/token",
    "https://visas-immigration.service.gov.uk/forceResume/token#secret",
    "https://apply-uk-visa.service.gov.uk/forceResume?token=token&next=https://evil.example",
    "https://user:password@visas-immigration.service.gov.uk/forceResume/token",
    "https://evil.example/forceResume/token",
  ])("rejects an unsafe resume shape: %s", (value) => {
    expect(isAllowedUkResumeUrl(value)).toBe(false);
  });
});
