import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "@playwright/test";
import {
  CANADA_DASHBOARD_SELECTORS,
  classifyCanadaCognitoResponse,
  classifyCanadaLoginEvidence,
  submitCanadaPortalLogin,
} from "../portal.js";

test("CA login classification distinguishes accepted and rejected Cognito results", () => {
  assert.equal(
    classifyCanadaCognitoResponse({ AuthenticationResult: { AccessToken: "fixture" } }),
    "authenticated",
  );
  assert.equal(
    classifyCanadaCognitoResponse({ __type: "NotAuthorizedException" }),
    "rejected",
  );
  assert.equal(
    classifyCanadaCognitoResponse({ ChallengeName: "PASSWORD_VERIFIER" }),
    null,
  );
});

test("CA dashboard resume selector matches the verified application grid control", () => {
  assert.equal(
    CANADA_DASHBOARD_SELECTORS.gridResume,
    'button[id^="Grid.actionContinue_"]',
  );
});

test("CA login evidence honors rejection before transient SPA DOM state", () => {
  const result = classifyCanadaLoginEvidence({
    url: "https://portal-portail.apps.cic.gc.ca/dashboard",
    title: "IRCC Portal",
    cognitoOutcome: "rejected",
    emailVisible: false,
    passwordVisible: false,
    authenticatedMarkerVisible: true,
    mainText: "",
  });
  assert.equal(result.checkpoint, "credentials_rejected");
});

test("CA login evidence does not infer authentication from missing controls", () => {
  const result = classifyCanadaLoginEvidence({
    url: "https://portal-portail.apps.cic.gc.ca/signin?lang=en",
    title: "IRCC Portal",
    cognitoOutcome: null,
    emailVisible: false,
    passwordVisible: false,
    authenticatedMarkerVisible: false,
    mainText: "",
  });
  assert.equal(result.checkpoint, "login_response_unverified");
});

test("CA login evidence requires a settled authenticated route or portal marker", () => {
  const unsettled = classifyCanadaLoginEvidence({
    url: "https://portal-portail.apps.cic.gc.ca/signin?lang=en",
    title: "IRCC Portal",
    cognitoOutcome: "authenticated",
    emailVisible: false,
    passwordVisible: false,
    authenticatedMarkerVisible: false,
    mainText: "",
  });
  assert.equal(unsettled.checkpoint, "portal_api_unavailable");

  const settled = classifyCanadaLoginEvidence({
    url: "https://portal-portail.apps.cic.gc.ca/dashboard",
    title: "IRCC Portal",
    cognitoOutcome: "authenticated",
    emailVisible: false,
    passwordVisible: false,
    authenticatedMarkerVisible: false,
    mainText: "",
  });
  assert.equal(settled.checkpoint, "authenticated_portal");
});

test("CA login refuses mirrored selectors before reading or filling credentials", async () => {
  for (const url of [
    "http://portal-portail.apps.cic.gc.ca/signin",
    "https://portal-portail.apps.cic.gc.ca.evil.example/signin",
  ]) {
    let locatorTouched = false;
    const mirroredPage = {
      url: () => url,
      title: async () => "Mirrored IRCC Portal",
      locator: () => {
        locatorTouched = true;
        throw new Error("mirrored selector must not be touched");
      },
    } as unknown as Page;

    const result = await submitCanadaPortalLogin({
      page: mirroredPage,
      email: "applicant@example.test",
      password: "credential-must-not-be-filled",
    });
    assert.equal(result.checkpoint, "unexpected_redirect");
    assert.equal(locatorTouched, false);
  }
});
