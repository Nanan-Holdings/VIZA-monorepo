import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import {
  ukFillDateSplit,
  ukFillText,
  ukPickBooleanRadio,
  ukPickCheckboxes,
  ukPickRadio,
  ukSelectCountry,
  ukSelectOption,
} from "./fillers.js";
import { UK_DOCUMENTS_FILLER } from "./page-bindings.js";

type WidgetMode = "missing" | "disabled" | "check_failure" | "label_mismatch" | "working";

class FakeLocator {
  private checked = false;
  private value = "";

  public constructor(
    private readonly mode: WidgetMode,
    private readonly id = "control-1",
    private readonly label = "Yes",
  ) {}

  public async count(): Promise<number> {
    return this.mode === "missing" ? 0 : 1;
  }

  public first(): FakeLocator {
    return this;
  }

  public nth(_index: number): FakeLocator {
    return this;
  }

  public async getAttribute(name: string): Promise<string | null> {
    return name === "id" ? this.id : null;
  }

  public async textContent(): Promise<string> {
    return this.mode === "label_mismatch" ? "Other" : this.label;
  }

  public async isChecked(): Promise<boolean> {
    return this.checked;
  }

  public async isDisabled(): Promise<boolean> {
    return this.mode === "disabled";
  }

  public async isVisible(): Promise<boolean> {
    return this.mode !== "missing";
  }

  public async check(): Promise<void> {
    if (this.mode === "check_failure") throw new Error("synthetic check failure");
    this.checked = true;
  }

  public async fill(nextValue: string): Promise<void> {
    if (this.mode === "check_failure") throw new Error("synthetic fill failure");
    this.value = nextValue;
  }

  public async press(): Promise<void> {}

  public async inputValue(): Promise<string> {
    return this.value || "existing";
  }

  public async selectOption(value: unknown): Promise<string[]> {
    if (this.mode === "check_failure") throw new Error("synthetic select failure");
    this.value = typeof value === "string" ? value : "selected";
    return [this.value];
  }

  public async evaluate<T>(): Promise<T> {
    return "" as T;
  }
}

class FakePage {
  public constructor(
    private readonly mode: WidgetMode,
    private readonly label = "Yes",
  ) {}

  public locator(selector: string): FakeLocator {
    if (selector.startsWith("label[for=")) return new FakeLocator(this.mode, "label-1", this.label);
    if (selector.includes("input[type=\"radio\"]") || selector.includes("input[type=\"checkbox\"]")) {
      return new FakeLocator(this.mode, "control-1", this.label);
    }
    if (selector.startsWith("#")) return new FakeLocator(this.mode);
    return new FakeLocator("missing");
  }

  public async waitForTimeout(): Promise<void> {}
}

const asPage = (page: FakePage): Page => page as unknown as Page;

test("radio widgets fail when the requested label is missing", async () => {
  await assert.rejects(ukPickRadio(asPage(new FakePage("label_mismatch")), "choice", "Yes"), /not found/);
});

test("disabled radio widgets fail unless the requested value was already checked", async () => {
  await assert.rejects(ukPickRadio(asPage(new FakePage("disabled")), "choice", "Yes"), /disabled/);
});

test("disabled checkbox widgets fail instead of being silently ignored", async () => {
  await assert.rejects(
    ukPickCheckboxes(asPage(new FakePage("disabled", "Passport")), "documents", ["Passport"]),
    /disabled/,
  );
});

test("boolean radio check failures propagate", async () => {
  await assert.rejects(
    ukPickBooleanRadio(asPage(new FakePage("check_failure")), "choice", true),
    /synthetic check failure/,
  );
});

test("non-empty text and select values fail when controls are absent", async () => {
  const page = asPage(new FakePage("missing"));
  await assert.rejects(ukFillText(page, "email", "person@example.test"), /not found/);
  await assert.rejects(ukSelectOption(page, "currency", "GBP"), /not found/);
  await assert.rejects(ukSelectCountry(page, "country", "SGP"), /not found/);
});

test("malformed dates fail instead of disappearing from the form", async () => {
  await assert.rejects(
    ukFillDateSplit(asPage(new FakePage("working")), "dateOfBirth", "not-a-date"),
    /expected YYYY-MM-DD/,
  );
});

test("documents skip disabled rows but propagate enabled checkbox failures", async () => {
  await UK_DOCUMENTS_FILLER(asPage(new FakePage("disabled")), {});
  await assert.rejects(
    UK_DOCUMENTS_FILLER(asPage(new FakePage("check_failure")), {}),
    /synthetic check failure/,
  );
});
