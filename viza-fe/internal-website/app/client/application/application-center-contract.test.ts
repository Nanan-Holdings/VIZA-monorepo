import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appPage = readFileSync(
  join(process.cwd(), "app/client/application/page.tsx"),
  "utf8"
);
const statusPage = readFileSync(
  join(process.cwd(), "app/client/status/page.tsx"),
  "utf8"
);

describe("application center route contract", () => {
  it("keeps the application center as one continuous page with owned anchors", () => {
    expect(appPage).toContain('id="my-applications"');
    expect(appPage).toContain('id="application-status-guide"');
    expect(appPage).toContain('id="start-new-application"');
    expect(appPage).toContain('fallbackHref="/client/home"');
    expect(appPage).toContain('mode="manage"');
    expect(appPage).toContain("showManageHeader={false}");
    expect(appPage).toContain("StatusGuide");
    expect(appPage).toContain("AddDestinationSection");
    expect(appPage).not.toContain("h-dvh");
  });

  it("preserves /client/status deep links while redirecting the duplicated index to the application center", () => {
    expect(statusPage).toContain("selectedApplicationId");
    expect(statusPage).toContain("selectedPackageId");
    expect(statusPage).toContain('step: "status"');
    expect(statusPage).toContain('redirect(selectedCountry ? "/client/application#my-applications" : "/client/application")');
    expect(statusPage).not.toContain("<ApplicationsList");
    expect(statusPage).not.toContain("<StatusGuide");
  });
});
