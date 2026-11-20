import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { UK_PAGE_FILLERS } from "./page-bindings.js";

class EmailTextControl {
  public value = "";

  public async count(): Promise<number> {
    return 1;
  }

  public first(): EmailTextControl {
    return this;
  }

  public async inputValue(): Promise<string> {
    return this.value;
  }

  public async fill(value: string): Promise<void> {
    this.value = value;
  }

  public async press(_key: string): Promise<void> {}
}

class MissingControl {
  public async count(): Promise<number> {
    return 0;
  }

  public first(): MissingControl {
    return this;
  }
}

class EmailRadio {
  public constructor(
    private readonly page: EmailPage,
    private readonly label: "You" | "Someone else",
  ) {}

  public async getAttribute(name: string): Promise<string | null> {
    if (name !== "id") return null;
    return this.label === "You" ? "emailOwner_you" : "emailOwner_someoneElse";
  }

  public async isChecked(): Promise<boolean> {
    return this.page.selectedOwner === this.label;
  }

  public async isDisabled(): Promise<boolean> {
    return false;
  }

  public async check(): Promise<void> {
    this.page.selectedOwner = this.label;
  }
}

class EmailRadioGroup {
  public constructor(private readonly page: EmailPage) {}

  public async count(): Promise<number> {
    return 2;
  }

  public first(): EmailRadio {
    return new EmailRadio(this.page, "You");
  }

  public nth(index: number): EmailRadio {
    return new EmailRadio(this.page, index === 0 ? "You" : "Someone else");
  }
}

class EmailLabel {
  public constructor(private readonly label: string) {}

  public first(): EmailLabel {
    return this;
  }

  public async textContent(): Promise<string> {
    return this.label;
  }
}

class EmailPage {
  public selectedOwner: "You" | "Someone else" | null = null;
  public readonly emailControl: EmailTextControl;

  public constructor(emailControlPresent: boolean) {
    this.emailControl = new EmailTextControl();
    if (!emailControlPresent) {
      this.emailControl.count = async () => 0;
    }
  }

  public locator(selector: string): EmailRadioGroup | EmailLabel | EmailTextControl | MissingControl {
    if (selector === 'input[type="radio"][name="emailOwner"]') {
      return new EmailRadioGroup(this);
    }
    if (selector.startsWith("label[for=")) {
      return new EmailLabel(selector.includes("someoneElse") ? "Someone else" : "You");
    }
    if (selector === "#emailAddress") return this.emailControl;
    return new MissingControl();
  }
}

const asPage = (page: EmailPage): Page => page as unknown as Page;

test("UKVI email page defaults to the applicant radio when no email input is rendered", async () => {
  const page = new EmailPage(false);
  await UK_PAGE_FILLERS.standardApplicantsEmail(asPage(page), {
    email_address: "applicant@example.test",
  });

  assert.equal(page.selectedOwner, "You");
  assert.equal(page.emailControl.value, "");
});

test("UKVI email page fills the conditional address for someone else", async () => {
  const page = new EmailPage(true);
  await UK_PAGE_FILLERS.standardApplicantsEmail(asPage(page), {
    email_owner_label: "Someone else",
    email_address: "contact@example.test",
  });

  assert.equal(page.selectedOwner, "Someone else");
  assert.equal(page.emailControl.value, "contact@example.test");
});

test("UKVI email page fails closed for someone else when its conditional input is absent", async () => {
  const page = new EmailPage(false);
  await assert.rejects(
    UK_PAGE_FILLERS.standardApplicantsEmail(asPage(page), {
      email_owner_label: "Someone else",
      email_address: "contact@example.test",
    }),
    /#emailAddress.*not found/,
  );
});
