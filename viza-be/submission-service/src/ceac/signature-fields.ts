import type { Locator, Page } from "@playwright/test";
import { waitForAspNetPostback } from "./aspnet";

/**
 * Historical official labels: reginfo.gov objectID=49797701, page 41 (2014).
 * The screenshot does not prove the name NA checkbox's DOM scope. A shared
 * surname/given-name NA container is deliberately not inferred below.
 * Current CEAC matching, NA behavior and options still require live evidence.
 */
const PREPARER_FIELDS: ReadonlyArray<{ key: string; label: RegExp; allowsNa?: boolean; optional?: boolean }> = [
  { key: "ds160_preparer_surname", label: /^Surnames\s*:?$/i },
  { key: "ds160_preparer_given_names", label: /^Given Names\s*:?$/i, allowsNa: true },
  { key: "ds160_preparer_organization_name", label: /^Organization Name\s*:?$/i, allowsNa: true },
  { key: "ds160_preparer_street1", label: /^Street Address\s*\(Line 1\)\s*:?$/i },
  { key: "ds160_preparer_street2", label: /^Street Address\s*\(Line 2\)(?:\s*\*?Optional\*?)?\s*:?$/i, optional: true },
  { key: "ds160_preparer_city", label: /^City\s*:?$/i },
  { key: "ds160_preparer_state_province", label: /^State\s*\/\s*Province\s*:?$/i, allowsNa: true },
  { key: "ds160_preparer_postal_code", label: /^Postal Zone\s*\/\s*ZIP Code\s*:?$/i, allowsNa: true },
  { key: "ds160_preparer_country", label: /^Country(?:\s*\/\s*Region)?\s*:?$/i },
  { key: "ds160_preparer_relationship", label: /^Relationship to You\s*:?$/i },
];

export const DS160_PREPARER_FIELD_NAMES: readonly string[] = [
  "ds160_preparer_assistance",
  ...PREPARER_FIELDS.map(field => field.key),
];

export type Ds160PreparerAnswers = Readonly<Record<string, string | null | undefined>>;

const isExplicitNa = (value: string): boolean => value === "DOES_NOT_APPLY";

/** Run before official bootstrap; no declaration or third-party detail is inferred. */
export function assertDs160PreparerAnswers(answers: Ds160PreparerAnswers): void {
  const answer = normalizePreparerAnswer(answers.ds160_preparer_assistance ?? undefined);
  if (!answer) throw new Error("Missing required DS-160 answer: ds160_preparer_assistance.");
  if (answer === "no") return;
  for (const field of PREPARER_FIELDS) {
    const value = answers[field.key]?.trim() ?? "";
    if ((!value || value.toLowerCase() === "null") && !field.optional) {
      throw new Error(`Missing required DS-160 preparer answer: ${field.key}.`);
    }
    if (isExplicitNa(value) && !field.allowsNa) {
      throw new Error(`Does Not Apply is not supported for DS-160 preparer field: ${field.key}.`);
    }
  }
}

/**
 * CEAC WebForms identifiers for the SignCertify preparer radio group.
 *
 * Do not broaden this to all radios: the page can contain unrelated controls,
 * and a missing/ambiguous preparer group must stop the final action.
 */
const PREPARER_RADIO_SELECTOR = [
  'input[type="radio"][id$="_rblPreparer_0"]',
  'input[type="radio"][id$="_rblPreparer_1"]',
  'input[type="radio"][name*="Preparer" i]',
  'input[type="radio"][id*="Preparer" i]',
].join(", ");

type PreparerAnswer = "yes" | "no";

interface PreparerControlMetadata {
  id: string;
  name: string;
  value: string;
  labelText: string;
}

interface SignatureInputMetadata {
  id: string;
  name: string;
  labelText: string;
  ariaLabel: string;
  placeholder: string;
}

function normalizePreparerAnswer(value: string | undefined): PreparerAnswer | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "y", "true", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "no";
  throw new Error("Saved DS-160 preparer assistance answer must be yes or no.");
}

function inferPreparerAnswer(metadata: PreparerControlMetadata): PreparerAnswer | null {
  const value = metadata.value.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(value)) return "yes";
  if (["no", "n", "false", "0"].includes(value)) return "no";

  const identifier = `${metadata.id} ${metadata.name}`.toLowerCase();
  if (/_rblpreparer_0(?:$|[^a-z0-9])/.test(identifier)) return "yes";
  if (/_rblpreparer_1(?:$|[^a-z0-9])/.test(identifier)) return "no";

  const label = metadata.labelText.toLowerCase();
  const hasYes = /\byes\b/.test(label);
  const hasNo = /\bno\b/.test(label);
  if (hasYes === hasNo) return null;
  return hasYes ? "yes" : "no";
}

async function readPreparerControlMetadata(control: Locator): Promise<PreparerControlMetadata> {
  return control.evaluate((element) => {
    const input = element as HTMLInputElement;
    const labels = new Set<HTMLElement>();
    for (const label of Array.from(input.labels ?? [])) labels.add(label);
    if (input.id) {
      for (const label of Array.from(document.querySelectorAll("label"))) {
        if ((label as HTMLLabelElement).htmlFor === input.id) labels.add(label as HTMLElement);
      }
    }
    const closestLabel = input.closest("label");
    if (closestLabel) labels.add(closestLabel);
    return {
      id: input.id,
      name: input.name,
      value: input.value,
      labelText: Array.from(labels)
        .map((label) => (label.textContent ?? "").trim())
        .filter(Boolean)
        .join(" "),
    };
  });
}

/**
 * Apply an applicant-supplied preparer answer to the visible CEAC control.
 *
 * A visible preparer group requires an explicit saved answer. `yes` requires
 * the saved third-party details and unique associated official labels.
 * Pages without a visible preparer group are left unchanged.
 */
export async function applyExplicitPreparerAnswer(
  page: Page,
  savedAnswer?: string,
  savedDetails: Ds160PreparerAnswers = {},
): Promise<void> {
  const normalizedAnswer = normalizePreparerAnswer(savedAnswer);
  const controls = page.locator(PREPARER_RADIO_SELECTOR);
  const visibleControls: Array<{
    locator: Locator;
    metadata: PreparerControlMetadata;
    answer: PreparerAnswer | null;
  }> = [];

  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    const metadata = await readPreparerControlMetadata(control);
    visibleControls.push({ locator: control, metadata, answer: inferPreparerAnswer(metadata) });
  }

  if (visibleControls.length === 0) {
    if (normalizedAnswer === "yes") {
      throw new Error(
        "DS-160 preparer assistance is yes, but third-party preparer fields are unavailable on this page.",
      );
    }
    return;
  }

  if (!normalizedAnswer) {
    throw new Error(
      "Visible DS-160 preparer controls require an explicit saved yes/no answer before submission.",
    );
  }

  if (normalizedAnswer === "yes") {
    assertDs160PreparerAnswers({ ...savedDetails, ds160_preparer_assistance: "yes" });
  }

  const yesControls = visibleControls.filter((control) => control.answer === "yes");
  const noControls = visibleControls.filter((control) => control.answer === "no");
  if (
    visibleControls.some((control) => control.answer === null) ||
    yesControls.length !== 1 ||
    noControls.length !== 1
  ) {
    throw new Error("DS-160 preparer controls are missing or ambiguous; submission is blocked.");
  }

  const target = normalizedAnswer === "yes" ? yesControls[0].locator : noControls[0].locator;
  const opposite = normalizedAnswer === "yes" ? noControls[0].locator : yesControls[0].locator;
  if (!(await target.isEnabled().catch(() => false))) {
    throw new Error("The requested DS-160 preparer control is unavailable; submission is blocked.");
  }
  await target.check({ timeout: 5_000 });
  await waitForAspNetPostback(page);
  if (!(await target.isChecked().catch(() => false)) || await opposite.isChecked().catch(() => false)) {
    throw new Error("The DS-160 preparer answer failed exact read-back verification.");
  }
  if (normalizedAnswer === "yes") {
    await fillPreparerDetails(page, savedDetails);
    if (!(await target.isChecked().catch(() => false))) {
      throw new Error("The DS-160 preparer answer changed while filling its dependent fields.");
    }
  }
}

async function uniquePreparerField(page: Page, field: typeof PREPARER_FIELDS[number]): Promise<Locator> {
  const candidates = page.getByLabel(field.label).filter({ visible: true });
  if (await candidates.count() !== 1) {
    throw new Error(`Missing or ambiguous official DS-160 preparer control: ${field.key}.`);
  }
  const control = candidates.first();
  const tag = await control.evaluate(element => element.tagName.toLowerCase());
  if (tag !== "input" && tag !== "select") {
    throw new Error(`Unsupported official DS-160 preparer control: ${field.key}.`);
  }
  return control;
}

/** An NA checkbox must share a field-only container; never select a global NA. */
async function preparerNaCheckbox(control: Locator, key: string): Promise<Locator | null> {
  let container = control.locator("..");
  for (let depth = 0; depth < 6; depth += 1) {
    const fields = container.locator('input:not([type="checkbox"]):not([type="hidden"]):not([type="radio"]), select');
    if (await fields.count() > 1) break;
    const candidates = container.getByLabel(/^Does Not Apply\s*$/i).filter({ visible: true });
    if (await candidates.count() > 1) throw new Error(`Ambiguous preparer NA control: ${key}.`);
    if (await candidates.count() === 1) {
      const checkbox = candidates.first();
      if (await checkbox.getAttribute("type") !== "checkbox") {
        throw new Error(`Unsupported preparer NA control: ${key}.`);
      }
      return checkbox;
    }
    container = container.locator("..");
  }
  return null;
}

async function fillPreparerDetails(page: Page, answers: Ds160PreparerAnswers): Promise<void> {
  const expectedValues = new Map<string, string>();
  // Resolve country first: its postback may replace address/state controls.
  const fieldsInFillOrder = [...PREPARER_FIELDS].sort((left, right) =>
    Number(right.key === "ds160_preparer_country") - Number(left.key === "ds160_preparer_country"));
  for (const field of fieldsInFillOrder) {
    const expected = answers[field.key]?.trim() ?? "";
    let control = await uniquePreparerField(page, field);
    const na = field.allowsNa ? await preparerNaCheckbox(control, field.key) : null;
    if (isExplicitNa(expected) && !na) throw new Error(`Missing preparer NA control: ${field.key}.`);
    if (na && await na.isChecked() !== isExplicitNa(expected)) {
      await na.setChecked(isExplicitNa(expected));
      await waitForAspNetPostback(page);
      control = await uniquePreparerField(page, field);
    }
    if (isExplicitNa(expected)) continue;
    if (!await control.isEnabled() || await control.getAttribute("readonly") !== null) {
      throw new Error(`Official preparer control is not editable: ${field.key}.`);
    }
    const tag = await control.evaluate(element => element.tagName.toLowerCase());
    let selectedValue = expected;
    if (tag === "select") {
      const options = await control.locator("option").evaluateAll(elements => elements.map(element => ({
        value: (element as HTMLOptionElement).value,
        text: (element as HTMLOptionElement).text,
        disabled: (element as HTMLOptionElement).disabled,
      })));
      const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
      const matches = options.filter(option => !option.disabled &&
        (option.value === expected || normalize(option.text) === normalize(expected))).map(option => option.value);
      if (matches.length !== 1) throw new Error(`Missing or ambiguous official preparer option: ${field.key}.`);
      selectedValue = matches[0];
      await control.selectOption(selectedValue);
    } else {
      await control.fill(expected);
      await control.press("Tab");
    }
    expectedValues.set(field.key, selectedValue);
    await waitForAspNetPostback(page);
  }
  // Country and NA postbacks can reset fields that were filled earlier.
  for (const field of PREPARER_FIELDS) {
    const expected = answers[field.key]?.trim() ?? "";
    const control = await uniquePreparerField(page, field);
    const na = field.allowsNa ? await preparerNaCheckbox(control, field.key) : null;
    if (isExplicitNa(expected)) {
      if (!na || !await na.isChecked() || await control.isEnabled()) {
        throw new Error(`Preparer NA answer failed final read-back: ${field.key}.`);
      }
    } else if ((na && await na.isChecked()) || await control.inputValue() !== expectedValues.get(field.key)) {
      throw new Error(`Preparer answer failed final read-back: ${field.key}.`);
    }
  }
}

function isExplicitPassportIdentifier(metadata: SignatureInputMetadata): boolean {
  const identifier = `${metadata.id} ${metadata.name}`;
  return /(?:^|[^a-z0-9])sign[_-]?passport(?:$|[^a-z0-9])|(?:^|[^a-z0-9])passport(?:number|no)?(?:$|[^a-z0-9])/i.test(
    identifier,
  );
}

function hasExplicitPassportLabel(metadata: SignatureInputMetadata): boolean {
  return /passport\s*(?:\/\s*travel\s*document|travel\s*document|number|no\.?|#)|travel\s+document/i.test(
    `${metadata.labelText} ${metadata.ariaLabel} ${metadata.placeholder}`,
  );
}

async function readSignatureInputMetadata(input: Locator): Promise<SignatureInputMetadata> {
  return input.evaluate((element) => {
    const field = element as HTMLInputElement;
    const labels = new Set<HTMLElement>();
    for (const label of Array.from(field.labels ?? [])) labels.add(label);
    if (field.id) {
      for (const label of Array.from(document.querySelectorAll("label"))) {
        if ((label as HTMLLabelElement).htmlFor === field.id) labels.add(label as HTMLElement);
      }
    }
    const closestLabel = field.closest("label");
    if (closestLabel) labels.add(closestLabel);
    const labelledBy = field.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
    for (const id of labelledBy) {
      const labelledNode = id ? document.getElementById(id) : null;
      if (labelledNode) labels.add(labelledNode);
    }
    return {
      id: field.id,
      name: field.name,
      labelText: Array.from(labels)
        .map((label) => (label.textContent ?? "").trim())
        .filter(Boolean)
        .join(" "),
      ariaLabel: field.getAttribute("aria-label") ?? "",
      placeholder: field.getAttribute("placeholder") ?? "",
    };
  });
}

/**
 * Fill the unique visible CEAC passport signature field and verify its exact
 * value. Generic first-input fallback is deliberately forbidden.
 */
export async function fillVerifiedPassportSignature(
  page: Page,
  passportNumber: string,
): Promise<void> {
  const expected = passportNumber.trim();
  if (!expected) throw new Error("DS-160 passport signature value is required.");

  const inputs = page.locator(
    'input[type="text"], input[type="password"], input:not([type])',
  );
  const candidates: Locator[] = [];
  for (let index = 0; index < await inputs.count(); index += 1) {
    const input = inputs.nth(index);
    if (!(await input.isVisible().catch(() => false))) continue;
    if (!(await input.isEnabled().catch(() => false))) continue;
    if ((await input.getAttribute("readonly")) !== null) continue;
    const metadata = await readSignatureInputMetadata(input);
    if (isExplicitPassportIdentifier(metadata) || hasExplicitPassportLabel(metadata)) {
      candidates.push(input);
    }
  }

  if (candidates.length !== 1) {
    throw new Error(
      "Could not identify exactly one visible official DS-160 passport signature field.",
    );
  }

  const input = candidates[0];
  await input.fill(expected);
  const actual = await input.inputValue();
  if (actual !== expected) {
    throw new Error("The DS-160 passport signature field failed exact read-back verification.");
  }
}
