import { describe, expect, it } from "vitest";
import { isAllowedUkResumeUrl } from "./uk-visa-links";

describe("isAllowedUkResumeUrl", () => {
  it.each([
    "https://visas-immigration.service.gov.uk/forceResume/application-token",
    "https://visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000",
    "https://visas-immigration.service.gov.uk/resume/123E4567-E89B-12D3-A456-426614174000",
    "https://apply-uk-visa.service.gov.uk/forceResume?token=application-token",
  ])("accepts the official resume shape: %s", (value) => {
    expect(isAllowedUkResumeUrl(value)).toBe(true);
  });

  it.each([
    "http://visas-immigration.service.gov.uk/forceResume/token",
    "https://visas-immigration.service.gov.uk/resume/",
    "https://visas-immigration.service.gov.uk/RESUME/123e4567-e89b-12d3-a456-426614174000",
    "https://visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000/extra",
    "https://visas-immigration.service.gov.uk/resume/not-a-uuid",
    "https://visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-42661417400%30",
    "https://visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000?next=https://evil.example",
    "https://visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000#secret",
    "https://visas-immigration.service.gov.uk:443/resume/123e4567-e89b-12d3-a456-426614174000",
    "https://user:password@visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000",
    "https://sub.visas-immigration.service.gov.uk/resume/123e4567-e89b-12d3-a456-426614174000",
    "https://evil.example/resume/123e4567-e89b-12d3-a456-426614174000",
    "https://visas-immigration.service.gov.uk/forceResume/token#secret",
    "https://apply-uk-visa.service.gov.uk/forceResume?token=token&next=https://evil.example",
    "https://user:password@visas-immigration.service.gov.uk/forceResume/token",
    "https://evil.example/forceResume/token",
  ])("rejects an unsafe resume shape: %s", (value) => {
    expect(isAllowedUkResumeUrl(value)).toBe(false);
  });
});
