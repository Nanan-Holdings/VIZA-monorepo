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

class FakeTelephoneControl {
  public constructor(
    private readonly page: FakeTelephonePage,
    public readonly id: string,
    private readonly label?: string,
  ) {}

  public async count(): Promise<number> {
    return 1;
  }

  public first(): FakeTelephoneControl {
    return this;
  }

  public async getAttribute(name: string): Promise<string | null> {
    return name === "id" ? this.id : null;
  }

  public async textContent(): Promise<string | null> {
    return this.label ?? null;
  }

  public async isChecked(): Promise<boolean> {
    return this.page.checked.has(this.id);
  }

  public async isDisabled(): Promise<boolean> {
    return false;
  }

  public async check(): Promise<void> {
    this.page.checked.add(this.id);
  }

  public async inputValue(): Promise<string> {
    return this.page.textValues.get(this.id) ?? "";
  }

  public async fill(value: string): Promise<void> {
    this.page.textValues.set(this.id, value);
  }

  public async press(): Promise<void> {}
}

class FakeTelephoneList {
  public constructor(private readonly controls: FakeTelephoneControl[]) {}

  public async count(): Promise<number> {
    return this.controls.length;
  }

  public first(): FakeTelephoneControl {
    return this.controls[0]!;
  }

  public nth(index: number): FakeTelephoneControl {
    return this.controls[index]!;
  }
}

class FakeTelephonePage {
  public readonly checked = new Set<string>();
  public readonly textValues = new Map<string, string>();

  public locator(selector: string): FakeTelephoneList | FakeTelephoneControl {
    if (selector === 'input[type="radio"][name="addAnother"]') {
      return new FakeTelephoneList([
        new FakeTelephoneControl(this, "addAnother_true", "Yes"),
        new FakeTelephoneControl(this, "addAnother_false", "No"),
      ]);
    }
    if (selector === 'input[type="radio"][name="contactByTelephone"]') {
      return new FakeTelephoneList([
        new FakeTelephoneControl(this, "contactByTelephone_callAndText", "I can be contacted by telephone call and text message (SMS)"),
        new FakeTelephoneControl(this, "contactByTelephone_callOnly", "I can only be contacted by telephone call"),
      ]);
    }
    if (selector === 'input[type="checkbox"][name^="telephoneNumberPurpose"]') {
      return new FakeTelephoneList([
        new FakeTelephoneControl(this, "purpose_in_uk", "For use whilst in the UK"),
        new FakeTelephoneControl(this, "purpose_outside_uk", "For use whilst out of the UK"),
      ]);
    }
    if (selector === 'input[type="checkbox"][name^="telephoneNumberType"]') {
      return new FakeTelephoneList([
        new FakeTelephoneControl(this, "type_mobile", "Mobile telephone number"),
      ]);
    }
    const labelMatch = selector.match(/^label\[for="([^"]+)"\]$/);
    if (labelMatch) {
      const control = [
        ["addAnother_true", "Yes"],
        ["addAnother_false", "No"],
        ["contactByTelephone_callAndText", "I can be contacted by telephone call and text message (SMS)"],
        ["contactByTelephone_callOnly", "I can only be contacted by telephone call"],
        ["purpose_in_uk", "For use whilst in the UK"],
        ["purpose_outside_uk", "For use whilst out of the UK"],
        ["type_mobile", "Mobile telephone number"],
      ].find(([id]) => id === labelMatch[1]);
      return new FakeTelephoneControl(this, labelMatch[1]!, control?.[1]);
    }
    const idMatch = selector.match(/^#(.+)$/);
    if (idMatch) return new FakeTelephoneControl(this, idMatch[1]!);
    return new FakeTelephoneList([]);
  }
}

const asTelephonePage = (page: FakeTelephonePage): Page => page as unknown as Page;

test("UKVI phone page fills observed purpose and type choices", async () => {
  const page = new FakeTelephonePage();
  await UK_PAGE_FILLERS["standardTelephoneDetailsList.0"]!(asTelephonePage(page), {
    phone_number: "8613800138000",
    phone_purpose_labels: "For use whilst in the UK|For use whilst out of the UK",
    phone_type_labels: "Mobile telephone number",
  });

  assert.equal(page.textValues.get("telephoneNumber"), "8613800138000");
  assert.deepEqual(
    [...page.checked].sort(),
    ["purpose_in_uk", "purpose_outside_uk", "type_mobile"].sort(),
  );
});

test("UKVI phone repeat gate requires an explicit no and fails closed for yes", async () => {
  const noPage = new FakeTelephonePage();
  await UK_PAGE_FILLERS.standardTelephoneDetailsList!(asTelephonePage(noPage), {
    has_alternative_phone: "no",
  });
  assert.deepEqual([...noPage.checked], ["addAnother_false"]);

  await assert.rejects(
    UK_PAGE_FILLERS.standardTelephoneDetailsList!(asTelephonePage(new FakeTelephonePage()), {}),
    /alternative telephone-number choice is required/,
  );
  await assert.rejects(
    UK_PAGE_FILLERS.standardTelephoneDetailsList!(asTelephonePage(new FakeTelephonePage()), {
      has_alternative_phone: "yes",
    }),
    /repeat row is not fully modelled/,
  );
});

test("UKVI telephone-contact page requires the observed preference", async () => {
  const page = new FakeTelephonePage();
  await UK_PAGE_FILLERS.standardContactingYouByTelephone!(asTelephonePage(page), {
    contact_by_phone_label: "I can only be contacted by telephone call",
  });
  assert.deepEqual([...page.checked], ["contactByTelephone_callOnly"]);

  await assert.rejects(
    UK_PAGE_FILLERS.standardContactingYouByTelephone!(asTelephonePage(new FakeTelephonePage()), {}),
    /telephone contact preference is required/,
  );
});

class FakeHomeControl {
  public constructor(
    private readonly page: FakeHomePage,
    public readonly id: string,
    private readonly label?: string,
  ) {}

  public async count(): Promise<number> { return 1; }
  public first(): FakeHomeControl { return this; }
  public async getAttribute(name: string): Promise<string | null> {
    return name === "id" ? this.id : null;
  }
  public async textContent(): Promise<string | null> { return this.label ?? null; }
  public async isChecked(): Promise<boolean> { return this.page.checked.has(this.id); }
  public async isDisabled(): Promise<boolean> { return false; }
  public async check(): Promise<void> { this.page.checked.add(this.id); }
  public async inputValue(): Promise<string> { return this.page.values.get(this.id) ?? ""; }
  public async fill(value: string): Promise<void> { this.page.values.set(this.id, value); }
  public async press(): Promise<void> {}
}

class FakeHomeList {
  public constructor(private readonly controls: FakeHomeControl[]) {}
  public async count(): Promise<number> { return this.controls.length; }
  public first(): FakeHomeControl { return this.controls[0]!; }
  public nth(index: number): FakeHomeControl { return this.controls[index]!; }
}

class FakeHomePage {
  public readonly checked = new Set<string>();
  public readonly values = new Map<string, string>();

  public locator(selector: string): FakeHomeList | FakeHomeControl {
    if (selector.includes('input[type="radio"][name="yesNo"]')) {
      return new FakeHomeControl(this, selector.includes('[value="false"]') ? "yesNo_false" : "yesNo_true");
    }
    if (selector === 'input[type="radio"][name="ownershipCategory"]') {
      return new FakeHomeList([
        new FakeHomeControl(this, "ownershipCategory_own", "I own it"),
        new FakeHomeControl(this, "ownershipCategory_rent", "I rent it"),
        new FakeHomeControl(this, "ownershipCategory_other", "Other"),
      ]);
    }
    const labelMatch = selector.match(/^label\[for="([^"]+)"\]$/);
    if (labelMatch) {
      const labels: Record<string, string> = {
        ownershipCategory_own: "I own it",
        ownershipCategory_rent: "I rent it",
        ownershipCategory_other: "Other",
      };
      return new FakeHomeControl(this, labelMatch[1]!, labels[labelMatch[1]!]);
    }
    const idMatch = selector.match(/^#(.+)$/);
    if (idMatch) return new FakeHomeControl(this, idMatch[1]!);
    return new FakeHomeList([]);
  }
}

const asHomePage = (page: FakeHomePage): Page => page as unknown as Page;

test("UKVI ADS page stops immediately when the applicant has not answered", async () => {
  await assert.rejects(
    UK_PAGE_FILLERS.adsAgreement!(asHomePage(new FakeHomePage()), {}),
    /ADS tour operator answer is required/,
  );
});

test("UKVI ADS page selects the boolean value for an explicit No", async () => {
  const page = new FakeHomePage();
  await UK_PAGE_FILLERS.adsAgreement!(asHomePage(page), {
    ads_tour_operator_employee: "no",
  });
  assert.deepEqual([...page.checked], ["yesNo_false"]);
});

class FakeSpendControl {
  public value = "";
  public constructor(private readonly id: string, private readonly kind: "hidden" | "select" | "number") {}
  public async count(): Promise<number> { return 1; }
  public first(): FakeSpendControl { return this; }
  public async isVisible(): Promise<boolean> { return this.kind !== "hidden"; }
  public async getAttribute(name: string): Promise<string | null> {
    return name === "type" ? this.kind === "select" ? null : this.kind : null;
  }
  public async inputValue(): Promise<string> { return this.value; }
  public async fill(value: string): Promise<void> { this.value = value; }
  public async press(): Promise<void> {}
  public async selectOption(option: unknown): Promise<string[]> {
    this.value = typeof option === "string" ? option : "GBP";
    return [this.value];
  }
}

class FakeSpendPage {
  public readonly currency = new FakeSpendControl("value_currencyRef", "hidden");
  public readonly amount = new FakeSpendControl("value_amount", "number");
  public locator(selector: string): FakeSpendControl {
    return selector === "#value_currencyRef" ? this.currency : this.amount;
  }
}

const asSpendPage = (page: FakeSpendPage): Page => page as unknown as Page;

test("UKVI GBP spending pages accept the fixed GBP currency when its input is hidden", async () => {
  const page = new FakeSpendPage();
  await UK_PAGE_FILLERS.plannedSpendOnVisitToUK!(asSpendPage(page), {
    planned_spend_currency: "GBP",
    planned_spend_amount: "500",
  });
  assert.equal(page.currency.value, "");
  assert.equal(page.amount.value, "500");
});

test("UKVI spending pages reject non-GBP currencies when the currency input is hidden", async () => {
  const page = new FakeSpendPage();
  await assert.rejects(
    UK_PAGE_FILLERS.monthlyOutgoings!(asSpendPage(page), {
      monthly_outgoings_currency: "CNY",
      monthly_outgoings_amount: "1000",
    }),
    /requires spending amounts in GBP/,
  );
  assert.equal(page.amount.value, "");
});

test("UKVI home page requires months and ownership before saving", async () => {
  await assert.rejects(
    UK_PAGE_FILLERS.standardAboutYourHomeOoC!(asHomePage(new FakeHomePage()), {
      years_at_address: "2",
      home_ownership_label: "I rent it",
    }),
    /duration months is required/,
  );

  await assert.rejects(
    UK_PAGE_FILLERS.standardAboutYourHomeOoC!(asHomePage(new FakeHomePage()), {
      years_at_address: "2",
      months_at_address: "0",
    }),
    /home ownership is required/,
  );
});

test("UKVI home page fills the observed month and ownership controls", async () => {
  const page = new FakeHomePage();
  await UK_PAGE_FILLERS.standardAboutYourHomeOoC!(asHomePage(page), {
    years_at_address: "2",
    months_at_address: "0",
    home_ownership_label: "I rent it",
  });
  assert.equal(page.values.get("yearsLived"), "2");
  assert.equal(page.values.get("monthsLived"), "0");
  assert.deepEqual([...page.checked], ["ownershipCategory_rent"]);
});
