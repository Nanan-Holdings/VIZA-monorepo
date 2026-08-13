import type { Dialog, Locator, Page } from "@playwright/test";
import { TwTermsModalError } from "./errors";

const TERMS_CHECKBOX_TEXT = "同意上述條款";
const AGREE_FIRST_ALERT = /請先勾選同意條款|Agree first/i;
const CHECKBOX_STATE_TIMEOUT_MS = 750;
const CHECKBOX_STABLE_MS = 75;

interface TermsCheckboxState {
  checked: boolean;
  ariaChecked: string | null;
  id: string;
  name: string;
}

function termsModalCandidates(page: Page): Locator {
  return page
    .locator('[role="dialog"], .modal-dialog, .modal-content, .modal')
    .filter({ hasText: TERMS_CHECKBOX_TEXT });
}

async function visibleTermsModal(page: Page): Promise<Locator | null> {
  const candidates = termsModalCandidates(page);
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function uniqueVisibleInModal(modal: Locator, selector: string, label: string): Promise<Locator> {
  const locator = modal.locator(selector);
  const count = await locator.count().catch(() => 0);
  const visible: Locator[] = [];
  for (let i = 0; i < count; i++) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible().catch(() => false)) visible.push(candidate);
  }
  if (visible.length !== 1) {
    throw new TwTermsModalError(`Terms modal ${label} expected exactly one visible match; found ${visible.length}`);
  }
  return visible[0];
}

async function readTermsCheckboxState(checkbox: Locator): Promise<TermsCheckboxState> {
  return checkbox.evaluate((element) => {
    const input = element as HTMLInputElement;
    return {
      checked: input.checked === true,
      ariaChecked: input.getAttribute("aria-checked"),
      id: input.id,
      name: input.name,
    };
  });
}

async function waitForStableCheckedState(
  checkbox: Locator,
  timeoutMs = CHECKBOX_STATE_TIMEOUT_MS,
): Promise<TermsCheckboxState | null> {
  const deadline = Date.now() + timeoutMs;
  let checkedSince = 0;
  let latest: TermsCheckboxState | null = null;

  while (Date.now() < deadline) {
    latest = await readTermsCheckboxState(checkbox).catch(() => null);
    if (latest?.checked) {
      checkedSince ||= Date.now();
      if (Date.now() - checkedSince >= CHECKBOX_STABLE_MS) return latest;
    } else {
      checkedSince = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

async function visibleAssociatedLabels(modal: Locator, checkbox: Locator): Promise<Locator[]> {
  const checkboxId = await checkbox.getAttribute("id").catch(() => null);
  const labels = modal.locator("label");
  const count = await labels.count().catch(() => 0);
  const matches: Locator[] = [];

  for (let i = 0; i < count; i += 1) {
    const label = labels.nth(i);
    if (!(await label.isVisible().catch(() => false))) continue;
    const related = await label.evaluate((element, inputId) => {
      const htmlLabel = element as HTMLLabelElement;
      const text = (htmlLabel.textContent ?? "").replace(/\s+/g, " ").trim();
      const wrapsCheckbox = Boolean(htmlLabel.querySelector('input[type="checkbox"]'));
      const referencesCheckbox = Boolean(inputId) && htmlLabel.htmlFor === inputId;
      return /同意上述條款/.test(text) && (wrapsCheckbox || referencesCheckbox);
    }, checkboxId).catch(() => false);
    if (related) matches.push(label);
  }

  return matches;
}

async function ensureTermsCheckboxChecked(modal: Locator, checkbox: Locator): Promise<TermsCheckboxState> {
  const initial = await readTermsCheckboxState(checkbox);
  if (initial.checked) return initial;

  await checkbox.check({ timeout: 2_000 }).catch(() => undefined);
  let accepted = await waitForStableCheckedState(checkbox);
  if (accepted) return accepted;

  for (const label of await visibleAssociatedLabels(modal, checkbox)) {
    await label.click({ timeout: 2_000 }).catch(() => undefined);
    accepted = await waitForStableCheckedState(checkbox);
    if (accepted) return accepted;
  }

  await checkbox.click({ timeout: 2_000, force: true }).catch(() => undefined);
  accepted = await waitForStableCheckedState(checkbox);
  if (accepted) return accepted;

  await checkbox.evaluate((element) => (element as HTMLInputElement).click()).catch(() => undefined);
  accepted = await waitForStableCheckedState(checkbox);
  if (accepted) return accepted;

  await checkbox.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }).catch(() => undefined);
  accepted = await waitForStableCheckedState(checkbox);
  if (accepted) return accepted;

  const finalState = await readTermsCheckboxState(checkbox).catch(() => initial);
  throw new TwTermsModalError("Terms modal checkbox was not checked after verified interactions", {
    details: {
      controlId: finalState.id,
      controlName: finalState.name,
      checked: finalState.checked,
      ariaChecked: finalState.ariaChecked,
    },
  });
}

export async function assertTwTermsModalCleared(page: Page): Promise<void> {
  const modal = await visibleTermsModal(page);
  if (!modal) return;
  throw new TwTermsModalError("Terms modal is still visible; refusing to continue to delivery-location fields", {
    url: page.url(),
  });
}

export async function withTwAgreeFirstAlertHandler<T>(
  page: Page,
  action: () => Promise<T>,
): Promise<T> {
  let unexpected: TwTermsModalError | null = null;
  const handler = (dialog: Dialog) => {
    void (async () => {
      const message = dialog.message().replace(/\s+/g, " ").trim();
      if (AGREE_FIRST_ALERT.test(message)) {
        await dialog.accept().catch(() => undefined);
        return;
      }
      unexpected = new TwTermsModalError("Unexpected official alert while handling Taiwan terms modal", {
        url: page.url(),
        details: { message, dialogType: dialog.type() },
      });
      await dialog.dismiss().catch(() => undefined);
    })();
  };

  page.on("dialog", handler);
  try {
    const result = await action();
    if (unexpected) throw unexpected;
    return result;
  } finally {
    page.off("dialog", handler);
  }
}

export async function acceptTermsModal(page: Page): Promise<boolean> {
  return withTwAgreeFirstAlertHandler(page, async () => {
    const modal = await visibleTermsModal(page);
    if (!modal) return false;

    const checkbox = await uniqueVisibleInModal(modal, 'input[type="checkbox"]', "terms checkbox");
    await checkbox.waitFor({ state: "visible", timeout: 5_000 });
    if (!(await checkbox.isEnabled().catch(() => false))) {
      await checkbox.waitFor({ state: "attached", timeout: 5_000 }).catch(() => undefined);
    }
    if (!(await checkbox.isEnabled().catch(() => false))) {
      throw new TwTermsModalError("Terms modal checkbox is not enabled", { url: page.url() });
    }
    await ensureTermsCheckboxChecked(modal, checkbox);

    const okButton = await uniqueVisibleInModal(
      modal,
      [
        'button:not(.btn-danger)',
        'input[type="button"]:not(.btn-danger)',
        'input[type="submit"]:not(.btn-danger)',
      ].join(","),
      "OK/確定 button",
    );
    const visibleText = await okButton.innerText().catch(() => "");
    const valueText = (await okButton.getAttribute("value").catch(() => null)) ?? "";
    const okText = `${visibleText} ${valueText}`.trim();
    if (!/^(OK|Ok|ok|確定|确定)$/.test(okText)) {
      throw new TwTermsModalError("Terms modal primary button did not match OK/確定; refusing to click", {
        url: page.url(),
        details: { buttonText: okText },
      });
    }
    await okButton.waitFor({ state: "visible", timeout: 5_000 });
    if (!(await okButton.isEnabled().catch(() => false))) {
      throw new TwTermsModalError("Terms modal OK/確定 button is not enabled", { url: page.url() });
    }
    await okButton.click({ timeout: 5_000 });
    await page.waitForTimeout(150);

    const stillVisible = await visibleTermsModal(page);
    if (stillVisible) {
      await stillVisible.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
    }
    await assertTwTermsModalCleared(page);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    return true;
  });
}
