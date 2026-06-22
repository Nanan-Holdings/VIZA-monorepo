import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeUsProofStoragePaths, waitForDs160ConfirmationPage } from "../proof-artifacts";

test("mergeUsProofStoragePaths preserves submitted DS-160 result fields", () => {
  const merged = mergeUsProofStoragePaths(
    {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
      confirmationNumber: "AA00FLSF69",
      surnameFirst5: "CHEN",
      yearOfBirth: 2006,
      securityQuestion: "Question",
      securityAnswer: "DO_NOT_KNOW",
      embassyOrConsulate: "NSS",
      retrievalUrl: "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=AA00FLSF69",
      confirmationPdfStoragePath: "existing/confirmation.pdf",
    },
    {
      applicationPdfStoragePath: "new/application.pdf",
      emailConfirmationPdfStoragePath: "new/email.pdf",
    },
  );

  assert.equal(merged.applicationId, "AA00FLSF69");
  assert.equal(merged.securityAnswer, "DO_NOT_KNOW");
  assert.equal(merged.confirmationPdfStoragePath, "existing/confirmation.pdf");
  assert.equal(merged.applicationPdfStoragePath, "new/application.pdf");
  assert.equal(merged.emailConfirmationPdfStoragePath, "new/email.pdf");
});

test("mergeUsProofStoragePaths rejects non-submitted DS-160 results", () => {
  assert.throws(
    () => mergeUsProofStoragePaths({ country: "US", status: "stopped_at_sign" }, {}),
    /submitted US DS-160 result/,
  );
});

test("waitForDs160ConfirmationPage does not accept the recovery security page as a proof page", async () => {
  const page = fakeProofPage([
    {
      body: "Security Question What is the given name of your mother's mother? Answer DO_NOT_KNOW Continue Cancel",
      printControls: 0,
      viewConfirmationControls: 0,
      continueControls: 0,
    },
  ]);

  await assert.rejects(
    () => waitForDs160ConfirmationPage(page as never),
    /CEAC confirmation page was not reached/,
  );
});

test("waitForDs160ConfirmationPage advances from recovery continue to official print controls", async () => {
  const page = fakeProofPage([
    {
      body: "Security Question What is the given name of your mother's mother? Answer DO_NOT_KNOW Continue Cancel",
      printControls: 0,
      viewConfirmationControls: 0,
      continueControls: 1,
    },
    {
      body: "Online Nonimmigrant Visa Application View Confirmation Page",
      printControls: 0,
      viewConfirmationControls: 1,
      continueControls: 0,
    },
    {
      body: "Print Confirmation Print Application Email Confirmation",
      printControls: 3,
      viewConfirmationControls: 0,
      continueControls: 0,
    },
  ]);

  await waitForDs160ConfirmationPage(page as never);
  assert.deepEqual(page.clicks, ["continue", "view"]);
});

function fakeProofPage(
  states: Array<{
    body: string;
    printControls: number;
    viewConfirmationControls: number;
    continueControls: number;
  }>,
) {
  let index = 0;
  const current = () => states[Math.min(index, states.length - 1)]!;
  const clicks: string[] = [];
  return {
    clicks,
    locator(selector: string) {
      const kind = selector.includes("Print Confirmation") ||
        selector.includes("Print Application") ||
        selector.includes("Email Confirmation")
        ? "print"
        : selector.includes("View Confirmation")
          ? "view"
          : selector.includes("Continue")
            ? "continue"
            : "body";
      return {
        first() {
          return this;
        },
        count: async () => {
          if (kind === "print") return current().printControls;
          if (kind === "view") return current().viewConfirmationControls;
          if (kind === "continue") return current().continueControls;
          return 1;
        },
        innerText: async () => current().body,
        click: async () => {
          clicks.push(kind);
          index += 1;
        },
        evaluate: async () => {
          clicks.push(kind);
          index += 1;
        },
      };
    },
    waitForLoadState: async () => undefined,
    waitForTimeout: async () => undefined,
  };
}
