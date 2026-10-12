import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

let mockLocale = "zh";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const elementPrototype = Element.prototype as Element & Partial<{
    scrollIntoView: () => void;
    hasPointerCapture: () => boolean;
    setPointerCapture: () => void;
    releasePointerCapture: () => void;
  }>;
  if (typeof elementPrototype.scrollIntoView !== "function") {
    elementPrototype.scrollIntoView = vi.fn();
  }
  if (typeof elementPrototype.hasPointerCapture !== "function") {
    elementPrototype.hasPointerCapture = vi.fn(() => false);
  }
  if (typeof elementPrototype.setPointerCapture !== "function") {
    elementPrototype.setPointerCapture = vi.fn();
  }
  if (typeof elementPrototype.releasePointerCapture !== "function") {
    elementPrototype.releasePointerCapture = vi.fn();
  }
});

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

vi.mock("@/lib/chinese-conversion", () => ({
  convertSimplifiedToTraditional: async (value: string) => value,
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: `field-${overrides.fieldName ?? "test-field"}`,
    visaType: "DS160",
    fieldName: "answer",
    label: "Answer",
    fieldType: "text",
    required: false,
    stepNumber: 1,
    stepName: "Performance regression",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function stepFor(fields: VisaFormFieldRow[]): WizardStep {
  return {
    stepNumber: 1,
    stepName: "Performance regression",
    fields: fields.map((candidate, index) => ({ ...candidate, displayOrder: index + 1 })),
  };
}

function renderForm(step: WizardStep, prefill: Record<string, string> = {}) {
  return render(
    <DynamicStepForm
      step={step}
      prefill={prefill}
      onComplete={vi.fn()}
      onDraftChange={vi.fn()}
      visaType="DS160"
    />,
  );
}

function getControl(container: HTMLElement, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const control = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field-name="${fieldName}"] input:not([type="radio"]):not([type="checkbox"]), [data-field-name="${fieldName}"] textarea`,
  );
  expect(control).toBeTruthy();
  return control!;
}

function rect(height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => {
  vi.restoreAllMocks();
  mockLocale = "zh";
});

describe("DynamicStepForm performance boundaries", () => {
  it("does not read form geometry for ordinary text input", () => {
    const geometrySpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(rect(500));
    const { container } = renderForm(stepFor([
      field({ fieldName: "surname", label: "Surname" }),
      field({ fieldName: "given_name", label: "Given name" }),
    ]));

    geometrySpy.mockClear();
    fireEvent.change(getControl(container, "surname"), { target: { value: "Chen" } });

    expect(geometrySpy).not.toHaveBeenCalled();
  });

  it("keeps the scroll offset when a conditional branch collapses", async () => {
    let scrollY = 600;
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const geometrySpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.scrollHeightContent !== "true") return rect(0);
        return rect(this.querySelector('[data-field-name="details"]') ? 1000 : 500);
      });
    const { container } = renderForm(stepFor([
      field({ fieldName: "show_details", label: "Show details" }),
      field({
        fieldName: "details",
        label: "Details",
        conditionalLogic: { showIf: "show_details === yes" },
      }),
    ]));

    geometrySpy.mockClear();
    scrollTo.mockClear();
    const controller = getControl(container, "show_details");
    fireEvent.change(controller, { target: { value: "yes" } });
    await waitFor(() => expect(container.querySelector('[data-field-name="details"]')).toBeTruthy());

    scrollY = 600;
    fireEvent.change(controller, { target: { value: "" } });
    await waitFor(() => expect(container.querySelector('[data-field-name="details"]')).toBeNull());

    expect(geometrySpy).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: "auto" });
  });

  it("resolves exact cross-field dates before aliases and refreshes the lookup after edits", () => {
    const step = stepFor([
      field({ fieldName: "passport_issue_date", fieldType: "date", validationRules: { allow_year_only: true } }),
      field({ fieldName: "profile_passport_issue_date", fieldType: "date", validationRules: { allow_year_only: true } }),
      field({ fieldName: "passport_expiry_date", fieldType: "date", validationRules: { allow_year_only: true } }),
    ]);
    const prefill = {
      passport_issue_date: "2024",
      profile_passport_issue_date: "2026-01-01",
      passport_expiry_date: "2025-01-01",
    };
    const view = renderForm(step, prefill);
    const { container } = view;

    const expiry = () => container.querySelector('[data-field-name="passport_expiry_date"]');
    expect(expiry()).toHaveAttribute("data-field-warning", "false");

    // With the exact key cleared, the prefixed alias is the fallback answer.
    fireEvent.change(getControl(container, "passport_issue_date"), { target: { value: "" } });
    expect(expiry()).toHaveAttribute("data-field-warning", "true");

    // A new values object must get a fresh index; the old alias result cannot
    // remain cached after the edited prefill changes.
    view.rerender(
      <DynamicStepForm
        step={step}
        prefill={{ ...prefill, profile_passport_issue_date: "2024-01-01" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    expect(expiry()).toHaveAttribute("data-field-warning", "false");
  });

  it("validates a selected value against the active dependent options", () => {
    const { container } = renderForm(
      stepFor([
        field({
          fieldName: "province",
          fieldType: "select",
          options: [{ value: "north", text: "North" }],
        }),
        field({
          fieldName: "district",
          fieldType: "select",
          validationRules: {
            dependent_on: "province",
            dependent_options: {
              north: [{ value: "north-1", text: "North District" }],
            },
          },
        }),
      ]),
      { province: "north", district: "stale-district" },
    );

    expect(container.querySelector('[data-field-name="district"]'))
      .toHaveAttribute("data-field-warning", "true");
  });

  it("keeps repeated cross-field lookups within the matching instance suffix", () => {
    const repeatRules = { repeatable: true, repeat_group: "documents", max_items: 2 };
    const { container } = renderForm(
      stepFor([
        field({ fieldName: "profile_passport_issue_date", fieldType: "date", validationRules: { ...repeatRules, allow_year_only: true } }),
        field({ fieldName: "passport_expiry_date", fieldType: "date", validationRules: { ...repeatRules, allow_year_only: true } }),
      ]),
      {
        profile_passport_issue_date: "2024-01-01",
        profile_passport_issue_date__2: "2026-01-01",
        passport_expiry_date: "2025-01-01",
        passport_expiry_date__2: "2025-01-01",
      },
    );

    expect(container.querySelector('[data-field-name="passport_expiry_date"]'))
      .toHaveAttribute("data-field-warning", "false");
    expect(container.querySelector('[data-field-name="passport_expiry_date__2"]'))
      .toHaveAttribute("data-field-warning", "true");
  });

  it("evaluates conditional repeat fields against their own instance values", () => {
    const repeatRules = { repeatable: true, repeat_group: "social_media", max_items: 2 };
    const { container } = renderForm(
      stepFor([
        field({
          fieldName: "social_media_platform",
          fieldType: "select",
          options: [
            { value: "INSTAGRAM", text: "Instagram" },
            { value: "NONE", text: "None" },
          ],
          validationRules: repeatRules,
        }),
        field({
          fieldName: "social_media_handle",
          required: false,
          validationRules: repeatRules,
          conditionalLogic: {
            showIf: "social_media_platform !== NONE && social_media_platform !== null",
          },
        }),
      ]),
      {
        social_media_platform: "INSTAGRAM",
        social_media_platform__2: "NONE",
        social_media_handle: "first-user",
      },
    );

    expect(container.querySelector('[data-field-name="social_media_handle"]')).toBeTruthy();
    expect(container.querySelector('[data-field-name="social_media_handle__2"]')).toBeNull();
  });

  it("clears dependent values only inside the changed repeat instance", async () => {
    const repeatRules = { repeatable: true, repeat_group: "addresses", max_items: 2 };
    const drafts: Record<string, string>[] = [];
    const step = stepFor([
      field({
        fieldName: "address_kind",
        fieldType: "radio",
        options: [
          { value: "yes", text: "Yes" },
          { value: "no", text: "No" },
        ],
        validationRules: repeatRules,
      }),
      field({
        fieldName: "address_line",
        validationRules: repeatRules,
        conditionalLogic: { showIf: "address_kind === yes" },
      }),
    ]);
    const rendered = render(
      <DynamicStepForm
        step={step}
        prefill={{
          address_kind: "yes",
          address_kind__2: "yes",
          address_line: "first row",
          address_line__2: "second row",
        }}
        onComplete={vi.fn()}
        onDraftChange={(patch) => drafts.push(patch)}
        visaType="DS160"
      />,
    );

    const secondNo = rendered.container.querySelector<HTMLInputElement>(
      '[data-field-name="address_kind__2"] input[type="radio"][value="no"]',
    );
    expect(secondNo).toBeTruthy();
    fireEvent.click(secondNo!);

    await waitFor(() => expect(rendered.container.querySelector('[data-field-name="address_line__2"]')).toBeNull());
    expect(getControl(rendered.container, "address_line")).toHaveValue("first row");
    expect(drafts.at(-1)?.address_line).toBe("first row");
    expect(drafts.at(-1)?.address_line__2).toBe("");

    // The next parent snapshot can still contain both the old controller and
    // dependent answer while the queued clear is in flight. Neither may
    // recreate the hidden second row's answer.
    rendered.rerender(
      <DynamicStepForm
        step={step}
        prefill={{
          address_kind: "yes",
          address_kind__2: "yes",
          address_line: "first row",
          address_line__2: "second row",
        }}
        onComplete={vi.fn()}
        onDraftChange={(patch) => drafts.push(patch)}
        visaType="DS160"
      />,
    );
    await waitFor(() => expect(rendered.container.querySelector('[data-field-name="address_line__2"]')).toBeNull());
    expect(getControl(rendered.container, "address_line")).toHaveValue("first row");
  });

  it("keeps repeat validation errors scoped to the active instance", () => {
    const repeatRules = { repeatable: true, repeat_group: "documents", max_items: 2 };
    const { container } = renderForm(
      stepFor([
        field({
          fieldName: "document_kind",
          fieldType: "select",
          options: [
            { value: "passport", text: "Passport" },
            { value: "other", text: "Other" },
          ],
          validationRules: repeatRules,
        }),
        field({
          fieldName: "document_number",
          required: true,
          validationRules: { ...repeatRules, pattern: "^[A-Z]{3}$" },
          conditionalLogic: { showIf: "document_kind === passport" },
        }),
      ]),
      {
        document_kind: "passport",
        document_kind__2: "passport",
        document_number: "ABC",
        document_number__2: "bad",
      },
    );

    expect(container.querySelector('[data-field-name="document_number"]'))
      .toHaveAttribute("data-validation-invalid", "false");
    expect(container.querySelector('[data-field-name="document_number__2"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(container.querySelector('button[data-required-filled="true"]')).toBeTruthy();
    expect(container.querySelector('button[data-blocking-errors-clear="false"]')).toBeTruthy();
  });

  it("merges late prefilled repeat rows without resurrecting a deleted tail", async () => {
    const repeatRules = { repeatable: true, repeat_group: "education", max_items: 2 };
    const step = stepFor([
      field({
        fieldName: "school_name",
        validationRules: repeatRules,
      }),
    ]);
    const rendered = render(
      <DynamicStepForm
        step={step}
        prefill={{ school_name: "NUS" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(1);
    rendered.rerender(
      <DynamicStepForm
        step={step}
        prefill={{ school_name: "NUS", school_name__2: "NTU" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(2));
    expect(getControl(rendered.container, "school_name__2")).toHaveValue("NTU");

    const removeButtons = Array.from(rendered.container.querySelectorAll("button"))
      .filter((button) => button.textContent?.includes("remove"));
    fireEvent.click(removeButtons.at(-1)!);
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(1));

    // A stale parent snapshot can still contain the deleted row while the
    // save queue is catching up. It must not expand the local form again.
    rendered.rerender(
      <DynamicStepForm
        step={step}
        prefill={{ school_name: "NUS", school_name__2: "NTU" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(1));
  });

  it("keeps an edited bilingual pair when an unrelated prefill snapshot changes", async () => {
    const step = stepFor([
      field({ fieldName: "given_names", label: "Given Names" }),
      field({ fieldName: "prefill_marker", label: "Marker" }),
    ]);
    const initialPrefill = {
      given_names: "USER",
      given_names_zh: "USER",
      given_names_en: "USER",
      prefill_marker: "before",
    };
    const rendered = render(
      <DynamicStepForm
        step={step}
        prefill={initialPrefill}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    const givenNamesInput = rendered.container.querySelector<HTMLInputElement>(
      '[data-field-name="given_names"] input',
    );
    expect(givenNamesInput).toBeTruthy();
    fireEvent.change(givenNamesInput!, { target: { value: "JOURNEY" } });
    await waitFor(() => expect(givenNamesInput).toHaveValue("JOURNEY"));

    // The first parent refresh acknowledges the edit and contains the saved
    // bilingual pair. This clears the local dirty marker just as navigation
    // back to the step would.
    rendered.rerender(
      <DynamicStepForm
        step={step}
        prefill={{
          given_names: "JOURNEY",
          given_names_zh: "JOURNEY",
          given_names_en: "JOURNEY",
          prefill_marker: "after-save",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    await waitFor(() => expect(rendered.container.querySelector<HTMLInputElement>(
      '[data-field-name="given_names"] input',
    )).toHaveValue("JOURNEY"));

    // A later unrelated refresh may still carry stale companion columns. The
    // ref-backed current pair must win over those stale mirrors.
    rendered.rerender(
      <DynamicStepForm
        step={step}
        prefill={{
          given_names: "JOURNEY",
          given_names_zh: "USER",
          given_names_en: "USER",
          prefill_marker: "after-other-change",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    await waitFor(() => expect(rendered.container.querySelector<HTMLInputElement>(
      '[data-field-name="given_names"] input',
    )).toHaveValue("JOURNEY"));
  });

  it("publishes an empty bilingual answer before an immediate submit", () => {
    const onDraftChange = vi.fn();
    const onComplete = vi.fn();
    const step = stepFor([
      field({ fieldName: "given_names", label: "Given Names" }),
    ]);
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          given_names: "VIZA USER",
          given_names_zh: "VIZA USER",
          given_names_en: "VIZA USER",
        }}
        onComplete={onComplete}
        onDraftChange={onDraftChange}
        visaType="DS160"
      />,
    );

    onDraftChange.mockClear();
    fireEvent.change(getControl(container, "given_names"), { target: { value: "" } });

    expect(getControl(container, "given_names")).toHaveValue("");

    // This assertion intentionally happens before form submission. It models
    // the page-level review click, whose save barrier reads the parent draft
    // rather than waiting for the component's deferred values effect.
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      given_names: "",
      given_names_zh: "",
      given_names_en: "",
    }));
  });

  it("drops removed repeat instances from the canonical and bilingual draft", async () => {
    const repeatRules = { repeatable: true, repeat_group: "education", max_items: 2 };
    const step = stepFor([
      field({
        fieldName: "school_name",
        validationRules: repeatRules,
      }),
    ]);
    const drafts: Record<string, string>[] = [];
    const onDraftChange = (patch: Record<string, string>) => drafts.push(patch);
    const renderStep = (key?: string, prefill: Record<string, string> = { school_name: "NUS" }) => (
      <DynamicStepForm
        key={key}
        step={step}
        prefill={prefill}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="DS160"
      />
    );
    const rendered = render(renderStep());
    const findButton = (label: string) => Array.from(rendered.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes(label));

    fireEvent.click(findButton("addAnother")!);
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(2));

    const removeButtons = Array.from(rendered.container.querySelectorAll("button"))
      .filter((button) => button.textContent?.includes("remove"));
    fireEvent.click(removeButtons.at(-1)!);
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(1));

    const latestDraft = drafts.at(-1);
    expect(latestDraft?.school_name).toBe("NUS");
    expect(latestDraft?.school_name__2).toBe("");
    expect(latestDraft?.school_name__2_zh).toBe("");
    expect(latestDraft?.school_name__2_en).toBe("");

    rendered.rerender(renderStep("refreshed", latestDraft));
    await waitFor(() => expect(rendered.container.querySelectorAll('[data-repeat-group-instance="true"]'))
      .toHaveLength(1));
  });

  it("publishes empty tombstones for every removed repeat field", async () => {
    const repeatRules = { repeatable: true, repeat_group: "nationality", max_items: 2 };
    const step = stepFor([
      field({
        fieldName: "country_name",
        validationRules: repeatRules,
      }),
      field({
        fieldName: "has_passport",
        fieldType: "radio",
        options: [
          { value: "yes", text: "Yes" },
          { value: "no", text: "No" },
        ],
        validationRules: repeatRules,
      }),
    ]);
    const drafts: Record<string, string>[] = [];
    const rendered = render(
      <DynamicStepForm
        step={step}
        prefill={{
          country_name: "China",
          country_name__2: "Singapore",
          has_passport: "yes",
          has_passport__2: "yes",
        }}
        onComplete={vi.fn()}
        onDraftChange={(patch) => drafts.push(patch)}
        visaType="DS160"
      />,
    );

    const removeButtons = Array.from(rendered.container.querySelectorAll("button"))
      .filter((button) => button.textContent?.includes("remove"));
    fireEvent.click(removeButtons.at(-1)!);

    await waitFor(() => expect(drafts.some((patch) => (
      patch.country_name__2 === ""
      && patch.country_name__2_zh === ""
      && patch.country_name__2_en === ""
      && patch.has_passport__2 === ""
    ))).toBe(true));

    // The page replaces the whole step draft on each callback. A later edit
    // must carry the tombstones forward instead of dropping them.
    fireEvent.change(getControl(rendered.container, "country_name"), {
      target: { value: "China updated" },
    });
    await waitFor(() => expect(drafts.at(-1)?.country_name).toBe("China updated"));
    expect(drafts.at(-1)).toEqual(expect.objectContaining({
      country_name__2: "",
      country_name__2_zh: "",
      country_name__2_en: "",
      has_passport__2: "",
    }));
  });
});
