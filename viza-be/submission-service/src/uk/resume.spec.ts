import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import {
  resumeUkApplication,
  type UkResumeOptions,
  type UkResumeResult,
} from "./resume.js";

const RESUME_URL = "https://example.test/uk/resume";

class FakeLocator {
  public constructor(
    private readonly present: boolean,
    private readonly onClick?: () => void,
    private readonly onCheck?: () => void,
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

  public async fill(_value: string): Promise<void> {}

  public async press(_key: string): Promise<void> {}

  public async click(): Promise<void> {
    this.onClick?.();
  }

  public async check(): Promise<void> {
    this.onCheck?.();
  }

  public async scrollIntoViewIfNeeded(): Promise<void> {}

  public async isVisible(): Promise<boolean> {
    return this.present;
  }

  public async isChecked(): Promise<boolean> {
    return false;
  }

  public async isDisabled(): Promise<boolean> {
    return false;
  }

  public async textContent(): Promise<string> {
    return "";
  }
}

class FakePage {
  public checkedCount = 0;
  private currentUrl = RESUME_URL;

  public constructor(private readonly mode: "no_navigation" | "fill_failure" | "declaration") {}

  public async goto(url: string): Promise<void> {
    this.currentUrl = url;
  }

  public url(): string {
    return this.currentUrl;
  }

  public async title(): Promise<string> {
    return this.currentUrl.includes("declaration") ? "Declaration" : "Application";
  }

  public async waitForLoadState(): Promise<void> {}

  public async waitForTimeout(): Promise<void> {}

  public async textContent(_selector: string): Promise<string> {
    return "";
  }

  public locator(selector: string): FakeLocator {
    if (selector.includes('input[type="password"]')) return new FakeLocator(true);
    if (selector === 'button[type="submit"], input[type="submit"]') {
      return new FakeLocator(true);
    }
    if (selector.includes("input#submit")) {
      return new FakeLocator(true, () => {
        if (this.mode === "declaration" && this.currentUrl.includes("/edit/application.0.")) {
          this.currentUrl = "https://example.test/edit/declaration.standardDeclaration";
        }
      }, () => {
        this.checkedCount += 1;
      });
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
    return {
      url: this.currentUrl,
      formAction: null,
      heading: this.currentUrl.includes("declaration") ? "Declaration" : "Application",
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
