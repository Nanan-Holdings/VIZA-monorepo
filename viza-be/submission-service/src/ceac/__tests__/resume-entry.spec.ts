import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  requiresAttachedCeacResume,
  resumeAttachedCeacApplication,
  waitForManualStartCaptcha,
  type AttachedCeacResumeDependencies,
} from "../resume-entry";
import type { CeacSession } from "../session";

const credentials = {
  applicationId: "AA00EXAMPL1",
  surnameFirstFive: "EXAMP",
  yearOfBirth: "1990",
  securityAnswer: "Applicant supplied",
};

function session(pageId: CeacSession["attachedPageId"]): CeacSession {
  return {
    browser: {} as never,
    context: {} as never,
    page: {} as never,
    attachedExistingForm: true,
    attachedPageId: pageId,
    close: async () => undefined,
  };
}

describe("attached CEAC stored-application resume", () => {
  it("recognizes only attached Start/Retrieve entry pages", () => {
    assert.equal(requiresAttachedCeacResume(session("start")), true);
    assert.equal(requiresAttachedCeacResume(session("retrieve_application")), true);
    assert.equal(requiresAttachedCeacResume(session("personal_information_1")), false);
    assert.equal(requiresAttachedCeacResume({ attachedExistingForm: false }), false);
  });

  it("observes only whether the applicant entered a CAPTCHA answer", async () => {
    const page = {
      url: () => "https://ceac.state.gov/GenNIV/Default.aspx",
      waitForTimeout: async () => undefined,
      locator: (selector: string) => {
        const locator = {
          first: () => locator,
          nth: () => locator,
          count: async () => selector.includes("h2") || selector.includes("Captcha") ? 1 : 0,
          textContent: async () => "Start an Application",
          innerText: async () => "",
          evaluate: async () => true,
        };
        return locator;
      },
    };

    const identity = await waitForManualStartCaptcha(page as never, 1_000);
    assert.equal(identity.id, "start");
    assert.doesNotMatch(JSON.stringify(identity), /captcha-answer/i);
  });

  it("retrieves first, checks gates, and requires a trusted entered form page", async () => {
    const calls: string[] = [];
    const attached = session("start");
    const dependencies: AttachedCeacResumeDependencies = {
      waitForManualStartCaptcha: async (_page, timeoutMs) => {
        calls.push("captcha");
        assert.equal(timeoutMs, 0);
        return {
          id: "start",
          heading: "Start an Application",
          url: "https://ceac.state.gov/GenNIV/Default.aspx",
        };
      },
      fillRetrieveApplicationForm: async (_page, actual) => {
        calls.push("retrieve");
        assert.deepEqual(actual, credentials);
      },
      assertNoGate: async () => {
        calls.push("gate");
      },
      detectPage: async () => {
        calls.push("detect");
        return {
          id: "personal_information_1",
          heading: "Personal Information 1",
          url: "https://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx",
        };
      },
      readApplicationId: async () => {
        calls.push("verify");
        return credentials.applicationId;
      },
    };

    const identity = await resumeAttachedCeacApplication(attached, credentials, dependencies);
    assert.equal(identity.id, "personal_information_1");
    assert.equal(attached.attachedPageId, "personal_information_1");
    assert.deepEqual(calls, ["captcha", "retrieve", "gate", "detect", "verify"]);
  });

  it("fails closed when retrieval does not reach an entered form page", async () => {
    const attached = session("retrieve_application");
    const dependencies: AttachedCeacResumeDependencies = {
      waitForManualStartCaptcha: async () => {
        throw new Error("not called");
      },
      fillRetrieveApplicationForm: async () => undefined,
      assertNoGate: async () => undefined,
      detectPage: async () => ({
        id: "retrieve_application",
        heading: "Retrieve an Application",
        url: "https://ceac.state.gov/GenNIV/Common/Recovery.aspx",
      }),
      readApplicationId: async () => null,
    };

    await assert.rejects(
      () => resumeAttachedCeacApplication(attached, credentials, dependencies),
      /did not reach a trusted entered DS-160 form page/i,
    );
  });

  it("fails closed without exposing either Application ID when recovery lands on another draft", async () => {
    const attached = session("retrieve_application");
    const dependencies: AttachedCeacResumeDependencies = {
      waitForManualStartCaptcha: async () => {
        throw new Error("not called");
      },
      fillRetrieveApplicationForm: async () => undefined,
      assertNoGate: async () => undefined,
      detectPage: async () => ({
        id: "personal_information_1",
        heading: "Personal Information 1",
        url: "https://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx",
      }),
      readApplicationId: async () => "AA00OTHER1",
    };

    let caught: unknown;
    try {
      await resumeAttachedCeacApplication(attached, credentials, dependencies);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof Error);
    assert.match(caught.message, /matches the stored draft/i);
    assert.doesNotMatch(JSON.stringify(caught), /AA00EXAMPL1|AA00OTHER1/);
  });
});
