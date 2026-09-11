import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  startAttachedCeacNewApplication,
  type AttachedNewApplicationDependencies,
} from "../attached-new-application";
import type { CeacSession } from "../session";

function session(overrides: Partial<CeacSession> = {}): CeacSession {
  return {
    browser: {} as never,
    context: {} as never,
    page: {
      url: () => "https://ceac.state.gov/GenNIV/Common/ConfirmApplicationID.aspx?node=SecureQuestion",
      waitForURL: async () => undefined,
    } as never,
    attachedExistingForm: true,
    attachedPageId: "start",
    newApplicationFromStart: true,
    manualStartWaitMs: 60_000,
    close: async () => undefined,
    ...overrides,
  };
}

describe("attached CEAC new-application Start flow", () => {
  it("waits for the applicant's CAPTCHA action before clicking only Start", async () => {
    const calls: string[] = [];
    const dependencies: AttachedNewApplicationDependencies = {
      waitForManualStartCaptcha: async (_page, timeoutMs) => {
        calls.push("manual-captcha");
        assert.ok(timeoutMs > 0);
        return {
          id: "start",
          heading: "Start an Application",
          url: "https://ceac.state.gov/GenNIV/Default.aspx",
        };
      },
      clickStart: async () => {
        calls.push("start-new");
      },
      detectPage: async () => {
        throw new Error("not called after confirmed navigation");
      },
    };

    await startAttachedCeacNewApplication(session(), dependencies);
    assert.deepEqual(calls, ["manual-captcha", "start-new"]);
  });

  it("fails closed unless the attach was explicitly approved for new application", async () => {
    const attached = session({ newApplicationFromStart: false });
    await assert.rejects(
      () => startAttachedCeacNewApplication(attached),
      /not approved for a new-application Start flow/i,
    );
  });
});
