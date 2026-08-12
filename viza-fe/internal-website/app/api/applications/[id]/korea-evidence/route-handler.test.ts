import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { koreaEvidenceContentType, resolveKoreaEvidenceSource } from "./route-handler";

const cwd = path.join("D:", "repo", "viza-fe", "internal-website");

describe("Korea appointment evidence routing", () => {
  it("accepts only evidence stored under the current application", () => {
    expect(resolveKoreaEvidenceSource(
      "korea-appointments/application-1/job-1-no-selectable-slots.png",
      "application-1",
      cwd,
    )).toEqual({
      kind: "storage",
      path: "korea-appointments/application-1/job-1-no-selectable-slots.png",
    });
    expect(resolveKoreaEvidenceSource(
      "korea-appointments/application-2/job-1-no-selectable-slots.png",
      "application-1",
      cwd,
    )).toBeNull();
  });

  it("rejects storage traversal and nested spoof paths", () => {
    expect(resolveKoreaEvidenceSource(
      "korea-appointments/application-1/../application-2/evidence.png",
      "application-1",
      cwd,
    )).toBeNull();
    expect(resolveKoreaEvidenceSource(
      "korea-appointments/application-1/nested/evidence.png",
      "application-1",
      cwd,
    )).toBeNull();
  });

  it("keeps legacy local output paths available for local development", () => {
    const source = resolveKoreaEvidenceSource(
      "output/playwright/korea-kvac-job-1-no-selectable-slots.png",
      "application-1",
      cwd,
    );
    expect(source?.kind).toBe("local");
    expect(source?.path).toContain(path.join("viza-be", "submission-service", "output", "playwright"));
  });

  it("uses an inline-safe content type from the evidence extension", () => {
    expect(koreaEvidenceContentType("evidence.png")).toBe("image/png");
    expect(koreaEvidenceContentType("evidence.jpeg")).toBe("image/jpeg");
    expect(koreaEvidenceContentType("confirmation.pdf")).toBe("application/pdf");
  });
});

