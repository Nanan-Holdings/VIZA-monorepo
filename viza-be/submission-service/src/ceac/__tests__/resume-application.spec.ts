import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { fillRetrieveApplicationForm } from "../resume-application";

test("fills the live CEAC ApplicationRecovery1 retrieve controls", async () => {
  const values = new Map<string, string>();
  let submitted = false;

  const liveControls = [
    "tbxApplicationID",
    "txbSname",
    "txbYear",
    "txbAnswer1",
    "ApplicationRecovery1$Button1",
  ];

  const page = {
    locator(selector: string) {
      const matched = liveControls.find((control) => selector.includes(control));
      return {
        first() { return this; },
        async count() { return matched ? 1 : 0; },
        async fill(value: string) {
          if (!matched) throw new Error(`missing selector: ${selector}`);
          values.set(matched, value);
        },
        async selectOption(value: string) {
          if (!matched) throw new Error(`missing selector: ${selector}`);
          values.set(matched, value);
        },
        async click() {
          if (!matched) throw new Error(`missing selector: ${selector}`);
          if (matched === "ApplicationRecovery1$Button1") submitted = true;
        },
        async evaluate() {
          if (matched === "ApplicationRecovery1$Button1") submitted = true;
        },
      };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  } as unknown as Page;

  await fillRetrieveApplicationForm(page, {
    applicationId: "AA00FLSF69",
    surnameFirstFive: "CHEN",
    yearOfBirth: "2006",
    securityAnswer: "DO_NOT_KNOW",
  });

  assert.equal(values.get("tbxApplicationID"), "AA00FLSF69");
  assert.equal(values.get("txbSname"), "CHEN");
  assert.equal(values.get("txbYear"), "2006");
  assert.equal(values.get("txbAnswer1"), "DO_NOT_KNOW");
  assert.equal(submitted, true);
});

test("completes the two-stage CEAC retrieve flow", async () => {
  const values = new Map<string, string>();
  let stage = 0;
  let submitted = false;

  const page = {
    locator(selector: string) {
      const control =
        selector.includes("tbxApplicationID") ? "tbxApplicationID" :
        stage === 0 && selector.includes("btnBarcodeSubmit") ? "btnBarcodeSubmit" :
        stage === 1 && selector.includes("tbxSurname") ? "tbxSurname" :
        stage === 1 && selector.includes("tbxDOBYear") ? "tbxDOBYear" :
        stage === 1 && selector.includes("tbxAnswer") ? "tbxAnswer" :
        stage === 1 && selector.includes("btnRetrieve") ? "btnRetrieve" :
        null;
      return {
        first() { return this; },
        async count() { return control ? 1 : 0; },
        async isVisible() { return Boolean(control); },
        async fill(value: string) {
          if (!control) throw new Error(`missing selector: ${selector}`);
          values.set(control, value);
        },
        async selectOption(value: string) {
          if (!control) throw new Error(`missing selector: ${selector}`);
          values.set(control, value);
        },
        async click() {
          if (control === "btnBarcodeSubmit") stage = 1;
          if (control === "btnRetrieve") submitted = true;
        },
        async evaluate() {
          if (control === "btnBarcodeSubmit") stage = 1;
          if (control === "btnRetrieve") submitted = true;
        },
      };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  } as unknown as Page;

  await fillRetrieveApplicationForm(page, {
    applicationId: "AA00FLSF69",
    surnameFirstFive: "CHEN",
    yearOfBirth: "2006",
    securityAnswer: "DO_NOT_KNOW",
  });

  assert.equal(values.get("tbxSurname"), "CHEN");
  assert.equal(values.get("tbxDOBYear"), "2006");
  assert.equal(values.get("tbxAnswer"), "DO_NOT_KNOW");
  assert.equal(submitted, true);
});

test("fills CEAC prefilled recovery controls that use txbDOBYear and txbAnswer", async () => {
  const values = new Map<string, string>();
  let submitted = false;
  const liveControls = [
    "tbxApplicationID",
    "txbSurname",
    "txbDOBYear",
    "txbAnswer",
    "btnRetrieve",
  ];

  const page = {
    locator(selector: string) {
      const matched = liveControls.find((control) => selector.includes(control));
      return {
        first() { return this; },
        async count() { return matched ? 1 : 0; },
        async fill(value: string) {
          if (!matched) throw new Error(`missing selector: ${selector}`);
          values.set(matched, value);
        },
        async selectOption(value: string) {
          if (!matched) throw new Error(`missing selector: ${selector}`);
          values.set(matched, value);
        },
        async click() {
          if (matched === "btnRetrieve") submitted = true;
        },
        async evaluate() {
          if (matched === "btnRetrieve") submitted = true;
        },
      };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  } as unknown as Page;

  await fillRetrieveApplicationForm(page, {
    applicationId: "AA00FMEE75",
    surnameFirstFive: "CHEN",
    yearOfBirth: "2006",
    securityAnswer: "VIZAREDOC",
  });

  assert.equal(values.get("txbSurname"), "CHEN");
  assert.equal(values.get("txbDOBYear"), "2006");
  assert.equal(values.get("txbAnswer"), "VIZAREDOC");
  assert.equal(submitted, true);
});

test("targets visible security controls when CEAC keeps hidden duplicates", async () => {
  const selected: string[] = [];
  const page = {
    locator(selector: string) {
      selected.push(selector);
      const isApplicationId = selector.includes("tbxApplicationID");
      const isSecurityField = /Surname|Sname|DOBYear|txbYear|Answer/.test(selector);
      const isSubmit = /btnRetrieve|Button1/.test(selector);
      const exists = isApplicationId || isSecurityField || isSubmit;
      return {
        first() { return this; },
        async count() { return exists ? 1 : 0; },
        async fill() {
          if (isSecurityField && !selector.includes(":visible")) {
            throw new Error("hidden duplicate selected");
          }
        },
        async selectOption() {},
        async click() {},
        async evaluate() {},
      };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  } as unknown as Page;

  await fillRetrieveApplicationForm(page, {
    applicationId: "AA00FLSF69",
    surnameFirstFive: "CHEN",
    yearOfBirth: "2006",
    securityAnswer: "DO_NOT_KNOW",
  });

  assert.equal(selected.some((selector) => selector.includes("tbxDOBYear") && selector.includes(":visible")), true);
  assert.equal(selected.some((selector) => selector.includes("tbxAnswer") && selector.includes(":visible")), true);
});

test("falls back to DOM assignment when CEAC rejects locator.fill", async () => {
  const values = new Map<string, string>();
  const page = {
    locator(selector: string) {
      const key = selector.includes("tbxApplicationID") ? "application" :
        selector.includes("Surname") || selector.includes("Sname") ? "surname" :
        selector.includes("DOBYear") || selector.includes("txbYear") ? "year" :
        selector.includes("Answer") ? "answer" :
        selector.includes("btnRetrieve") || selector.includes("Button1") ? "submit" :
        null;
      return {
        first() { return this; },
        async count() { return key ? 1 : 0; },
        async fill() { throw new Error("CEAC rejected fill"); },
        async selectOption() { throw new Error("not a select"); },
        async click() {},
        async evaluate(_fn: unknown, value?: string) {
          if (key && value) values.set(key, value);
        },
      };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  } as unknown as Page;

  await fillRetrieveApplicationForm(page, {
    applicationId: "AA00FLSF69",
    surnameFirstFive: "CHEN",
    yearOfBirth: "2006",
    securityAnswer: "DO_NOT_KNOW",
  });

  assert.equal(values.get("year"), "2006");
  assert.equal(values.get("answer"), "DO_NOT_KNOW");
});
