import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import {
  resumeUkApplication,
  type UkResumeOptions,
  type UkResumeResult,
} from "./resume.js";

const UK_ORIGIN = "https://visas-immigration.service.gov.uk";
const RESUME_URL = `${UK_ORIGIN}/forceResume/test-resume-token`;
const LEGACY_RESUME_URL = "https://apply-uk-visa.service.gov.uk/forceResume?token=test-resume-token";
const APP_URL = `${UK_ORIGIN}/edit/application.0.`;

class FakeLocator {
  private checked = false;
  private value = "";

  public constructor(
    private readonly present: boolean,
    private readonly onClick?: () => void,
    private readonly onCheck?: () => void,
    private readonly attributes: Record<string, string> = {},
    private readonly label = "",
  ) {}

  public async count(): Promise<number> {
    return this.present ? 1 : 0;
  }

  public first(): FakeLocator {
    return this;
  }

  public nth(_index: number): FakeLocator {
    return this;
  }

  public async fill(value: string): Promise<void> {
    this.value = value;
  }

  public async press(_key: string): Promise<void> {}

  public async click(): Promise<void> {
    this.onClick?.();
  }

  public async getAttribute(name: string): Promise<string | null> {
    return this.attributes[name] ?? null;
  }

  public async check(): Promise<void> {
    this.checked = true;
    this.onCheck?.();
  }

  public async scrollIntoViewIfNeeded(): Promise<void> {}

  public async isVisible(): Promise<boolean> {
    return this.present;
  }

  public async isChecked(): Promise<boolean> {
    return this.checked;
  }

  public async isDisabled(): Promise<boolean> {
    return false;
  }

  public async textContent(): Promise<string> {
    return this.label;
  }

  public async inputValue(): Promise<string> {
    return this.value;
  }
}

class FakeList {
  public constructor(private readonly items: FakeLocator[]) {}

  public async count(): Promise<number> {
    return this.items.length;
  }

  public first(): FakeLocator {
    return this.items[0]!;
  }

  public nth(index: number): FakeLocator {
    return this.items[index]!;
  }
}

type FakeMode =
  | "no_navigation"
  | "fill_failure"
  | "declaration"
  | "actual_next"
  | "unknown_next"
  | "loop"
  | "foreign_action"
  | "overview";

class FakePage {
  public checkedCount = 0;
  public readonly gotoUrls: string[] = [];
  private currentUrl = RESUME_URL;
  private saveAck = false;

  public constructor(
    private readonly mode: FakeMode,
    private readonly initialSlug = "standardApplicantsEmail",
  ) {}

  public async goto(url: string): Promise<void> {
    this.gotoUrls.push(url);
    this.currentUrl = url;
  }

  public url(): string {
    return this.currentUrl;
  }

  public async title(): Promise<string> {
    if (this.currentUrl.includes("declaration")) return "Declaration";
    if (this.currentUrl.endsWith("/edit/application")) {
      return this.mode === "overview" ? "Application" : "Check your answers";
    }
    return "Application";
  }

  public async waitForLoadState(): Promise<void> {}

  public async waitForTimeout(): Promise<void> {}

  public async textContent(_selector: string): Promise<string> {
    return "";
  }

  public locator(selector: string): FakeLocator | FakeList {
    if (selector.includes('input[type="password"]')) return new FakeLocator(true);
    if (selector === 'button[type="submit"], input[type="submit"]') {
      return new FakeLocator(true, () => {
        if (this.currentUrl === RESUME_URL || this.currentUrl === LEGACY_RESUME_URL) {
          this.currentUrl = this.mode === "overview"
            ? `${UK_ORIGIN}/edit/application`
            : `${APP_URL}${this.initialSlug}`;
          return;
        }
        if (this.currentUrl.endsWith("/edit/application")) {
          this.currentUrl = `${UK_ORIGIN}/edit/declaration.standardDeclaration`;
        }
      });
    }
    if (selector.includes("input#submit")) {
      return new FakeLocator(true, () => {
        if (!/(?:edit|save)\/application\.0\./.test(this.currentUrl)) return;
        if (this.saveAck) {
          this.saveAck = false;
          if (this.mode === "declaration") {
            this.currentUrl = `${UK_ORIGIN}/edit/declaration.standardDeclaration`;
          } else if (this.mode === "actual_next") {
            const slug = this.currentUrl.endsWith("standardApplicantsEmail")
              ? "standardTelephoneDetailsList.0"
              : "review";
            this.currentUrl = slug === "review"
              ? `${UK_ORIGIN}/edit/application`
              : `${APP_URL}${slug}`;
          } else if (this.mode === "unknown_next") {
            this.currentUrl = `${APP_URL}unobservedConditionalPage`;
          } else if (this.mode === "loop") {
            this.currentUrl = `${APP_URL}standardApplicantsEmail`;
          }
          return;
        }
        if (this.mode === "no_navigation") return;
        if (this.mode === "declaration") {
          this.currentUrl = `${UK_ORIGIN}/save/application.0.standardApplicantsEmail`;
          this.saveAck = true;
        } else if (this.mode === "actual_next") {
          this.currentUrl = `${UK_ORIGIN}/save/application.0.${this.currentUrl.split(".0.")[1]}`;
          this.saveAck = true;
        } else if (this.mode === "unknown_next") {
          this.currentUrl = `${UK_ORIGIN}/save/application.0.standardApplicantsEmail`;
          this.saveAck = true;
        } else if (this.mode === "loop") {
          this.currentUrl = `${UK_ORIGIN}/save/application.0.standardApplicantsEmail`;
          this.saveAck = true;
        } else if (this.mode === "foreign_action") {
          this.currentUrl = `${UK_ORIGIN}/save/application.0.standardApplicantsEmail`;
          this.saveAck = true;
        }
      }, () => {
        this.checkedCount += 1;
      });
    }
    if (this.mode === "actual_next" && selector === "#telephoneNumber") {
      return new FakeLocator(true);
    }
    if (this.mode === "actual_next" && selector === 'input[type="checkbox"][name^="telephoneNumberPurpose"]') {
      return new FakeList([
        new FakeLocator(true, undefined, undefined, { id: "purpose_in_uk" }, "For use whilst in the UK"),
        new FakeLocator(true, undefined, undefined, { id: "purpose_outside_uk" }, "For use whilst out of the UK"),
      ]);
    }
    if (this.mode === "actual_next" && selector === 'input[type="checkbox"][name^="telephoneNumberType"]') {
      return new FakeList([
        new FakeLocator(true, undefined, undefined, { id: "type_mobile" }, "Mobile telephone number"),
      ]);
    }
    if (this.mode === "actual_next" && selector.startsWith("label[for=\"")) {
      const id = selector.match(/^label\[for="([^"]+)"\]$/)?.[1];
      const labels: Record<string, string> = {
        purpose_in_uk: "For use whilst in the UK",
        purpose_outside_uk: "For use whilst out of the UK",
        type_mobile: "Mobile telephone number",
      };
      return new FakeLocator(Boolean(id && labels[id]), undefined, undefined, {}, id ? labels[id] : "");
    }
    if (selector.includes('input[type="radio"]') && this.mode === "fill_failure") {
      return new FakeLocator(false);
    }
    if (selector.includes("govuk-error-summary") || selector.includes("govuk-error-message")) {
      return new FakeLocator(false);
    }
    return new FakeLocator(false);
  }

  public async evaluate<T>(_callback: unknown, ..._args: unknown[]): Promise<T> {
    const currentSlug = this.currentUrl.match(/application\.0\.([^/?#]+)/i)?.[1] ?? null;
    return {
      url: this.currentUrl,
      formAction: this.mode === "foreign_action" && currentSlug
        ? "https://evil.example/save/application.0.foreign"
        : currentSlug
          ? `/save/application.0.${currentSlug}`
          : null,
      heading: this.currentUrl.includes("declaration")
        ? "Declaration"
        : this.currentUrl.endsWith("/edit/application")
          ? this.mode === "overview" ? "Application" : "Check your answers"
          : "Application",
    } as T;
  }
}

class FakeContext {
  public closed = false;

  public async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeBrowser {
  public closed = false;

  public async close(): Promise<void> {
    this.closed = true;
  }
}

function fakeBrowserLauncher(page: FakePage, context: FakeContext, browser: FakeBrowser): NonNullable<UkResumeOptions["browserLauncher"]> {
  return (async () => ({
    page: page as unknown as Page,
    context: context as never,
    browser: browser as never,
  })) as NonNullable<UkResumeOptions["browserLauncher"]>;
}

function resumeOptions(page: FakePage, context: FakeContext, browser: FakeBrowser): UkResumeOptions {
  return {
    browserLauncher: fakeBrowserLauncher(page, context, browser),
    pageTimeoutMs: 50,
  };
}

function baseInput(answers: Record<string, string> = {}) {
  return {
    resumeUrl: RESUME_URL,
    password: "test-password",
    email: "test@example.test",
    answers,
  };
}

test("save without navigation is form_incomplete and closes the browser", async () => {
  const page = new FakePage("no_navigation");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => {
    clock += 30_000;
    return clock;
  };
  let result: UkResumeResult;
  try {
    result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));
  } finally {
    Date.now = originalNow;
  }

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.match(result.reason, /did not navigate/);
    assert.deepEqual(result.pagesFilled, []);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("widget fill failure is form_incomplete and does not count the page", async () => {
  const page = new FakePage("fill_failure");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(
    baseInput({ email_owner_label: "Applicant" }),
    resumeOptions(page, context, browser),
  );

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.match(result.reason, /Filler failed/);
    assert.deepEqual(result.pagesFilled, []);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("declaration is returned before any legal checkbox is touched", async () => {
  const page = new FakePage("declaration");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "declaration");
    assert.deepEqual(result.pagesFilled, ["standardApplicantsEmail"]);
  }
  assert.equal(page.checkedCount, 0);
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("accepts the legacy apply-uk-visa resume form and requires post-login migration", async () => {
  const page = new FakePage("declaration");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(
    { ...baseInput(), resumeUrl: LEGACY_RESUME_URL },
    resumeOptions(page, context, browser),
  );

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "declaration");
  }
  assert.deepEqual(page.gotoUrls, [LEGACY_RESUME_URL]);
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("follows the official next page and does not goto review directly", async () => {
  const page = new FakePage("actual_next");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(
    baseInput({
      phone_number: "8613800138000",
      phone_purpose_labels: "For use whilst in the UK|For use whilst out of the UK",
      phone_type_labels: "Mobile telephone number",
    }),
    resumeOptions(page, context, browser),
  );

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "declaration");
    assert.deepEqual(result.pagesFilled, [
      "standardApplicantsEmail",
      "standardTelephoneDetailsList.0",
    ]);
  }
  assert.deepEqual(page.gotoUrls, [RESUME_URL]);
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("fails closed on an unknown official next page", async () => {
  const page = new FakePage("unknown_next");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.deepEqual(result.pagesFilled, ["standardApplicantsEmail"]);
    assert.match(result.reason, /unknown next application page/);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("fails closed on a page loop instead of refilling the same slug", async () => {
  const page = new FakePage("loop");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.deepEqual(result.pagesFilled, ["standardApplicantsEmail"]);
    assert.match(result.reason, /looped on/);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("rejects a non-official form action before filling answers", async () => {
  const page = new FakePage("foreign_action");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.deepEqual(result.pagesFilled, []);
    assert.match(result.reason, /form action left the official origin/);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});

test("does not treat an unverified application overview as review", async () => {
  const page = new FakePage("overview");
  const context = new FakeContext();
  const browser = new FakeBrowser();
  const result = await resumeUkApplication(baseInput(), resumeOptions(page, context, browser));

  assert.equal(result.status, "halted_before_pay");
  if (result.status === "halted_before_pay") {
    assert.equal(result.checkpoint, "form_incomplete");
    assert.deepEqual(result.pagesFilled, []);
    assert.match(result.reason, /unknown application page/);
  }
  assert.equal(context.closed, true);
  assert.equal(browser.closed, true);
});
