import { describe, expect, it } from "vitest";
import {
  buildApplicationHref,
  getNextApplicationHref,
  type ApplicationRow,
} from "@/lib/client/application-progress";

function application(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: "application-123",
    status: "draft",
    country: "taiwan",
    visa_type: "TW_ENTRY_PERMIT",
    visa_package_id: "package-123",
    submission_result_status: null,
    submitted_at: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

describe("application progress routing", () => {
  it("opens an unfinished application by its exact id", () => {
    expect(buildApplicationHref(application())).toBe(
      "/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=application-123",
    );
  });

  it("does not send an unfinished application back to the application hub", () => {
    expect(getNextApplicationHref(application(), [])).toBe(
      "/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&applicationId=application-123",
    );
  });
});
