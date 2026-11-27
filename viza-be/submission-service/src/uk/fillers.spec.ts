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
import { UK_DOCUMENTS_FILLER, UK_PAGE_FILLERS } from "./page-bindings.js";

type WidgetMode = "missing" | "disabled" | "check_failure" | "label_mismatch" | "working" | "wrapped_label" | "delayed_label";

class FakeLocator {
  private checked = false;
  private value = "";

  public constructor(
    private readonly mode: WidgetMode,
    private readonly id = "control-1",
    private readonly label = "Yes",
    private readonly wrappedLabel = "",
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
    if (this.mode === "missing") return null as unknown as string;
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
    return (this.mode === "wrapped_label" ? this.wrappedLabel : "") as T;
  }

  public async waitFor(): Promise<void> {
    if (this.mode === "missing") throw new Error("missing widget");
  }
}

class FakePage {
  private waitedMs = 0;

  public constructor(
    private readonly mode: WidgetMode,
    private readonly label = "Yes",
    private readonly wrappedLabel = "",
  ) {}

  public locator(selector: string): FakeLocator {
    const label = this.mode === "delayed_label" && this.waitedMs < 100 ? "Other" : this.label;
    if (selector.startsWith("label[for=")) {
      return new FakeLocator(this.mode === "wrapped_label" ? "missing" : this.mode, "label-1", label);
    }
    if (selector.includes("input[type=\"radio\"]") || selector.includes("input[type=\"checkbox\"]")) {
      return new FakeLocator(this.mode, "control-1", label, this.wrappedLabel);
    }
    if (selector.startsWith("#")) return new FakeLocator(this.mode);
    return new FakeLocator("missing");
  }

  public async waitForTimeout(durationMs = 0): Promise<void> {
    this.waitedMs += durationMs;
  }
}

const asPage = (page: FakePage): Page => page as unknown as Page;

test("radio widgets fail when the requested label is missing", async () => {
  await assert.rejects(
    ukPickRadio(asPage(new FakePage("label_mismatch")), "choice", "Yes"),
    (error: unknown) =>
      error instanceof Error &&
      "diagnosticCode" in error &&
      error.diagnosticCode === "radio_option_unmatched",
  );
});

test("purpose radio matching normalizes line breaks and non-breaking spaces", async () => {
  await ukPickRadio(
    asPage(new FakePage("working", "Tourism (including\u00a0visiting\n family and friends)")),
    "purposeRef",
    "Tourism (including visiting family and friends)",
  );
});

test("radio matching falls back to a wrapped label without a for/id association", async () => {
  await ukPickRadio(
    asPage(new FakePage("wrapped_label", "", "Tourism (including visiting family and friends)")),
    "purposeRef",
    "Tourism (including visiting family and friends)",
  );
});

test("radio matching waits briefly for an option that renders after the group", async () => {
  await ukPickRadio(
    asPage(new FakePage("delayed_label", "Tourism (including visiting family and friends)")),
    "purposeRef",
    "Tourism (including visiting family and friends)",
  );
});

test("UK purpose binding selects the official tourism option in purposeRef", async () => {
  await UK_PAGE_FILLERS.purposeOfVisitForVV(
    asPage(new FakePage("working", "Tourism (including visiting family and friends)")),
    { purpose_of_visit: "tourism" },
  );
});

test("disabled radio widgets fail unless the requested value was already checked", async () => {
  await assert.rejects(
    ukPickRadio(asPage(new FakePage("disabled")), "choice", "Yes"),
    (error: unknown) =>
      error instanceof Error && "diagnosticCode" in error && error.diagnosticCode === "radio_disabled",
  );
});

test("missing radio groups produce an allowlisted diagnostic", async () => {
  await assert.rejects(
    ukPickRadio(asPage(new FakePage("missing")), "purposeRef", "Tourism"),
    (error: unknown) =>
      error instanceof Error && "diagnosticCode" in error && error.diagnosticCode === "radio_group_missing",
  );
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
