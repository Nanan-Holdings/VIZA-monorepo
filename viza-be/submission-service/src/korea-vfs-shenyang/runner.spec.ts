import assert from "node:assert/strict";
import test from "node:test";
import {
  dismissShenyangVfsCookies,
  fillShenyangVfsRegistrationMobileField,
  fillShenyangVfsRegistrationConsents,
  generateShenyangVfsPassword,
  isShenyangVfsPasswordCompliant,
  isOptionalRegistrationConsent,
  resolveShenyangVfsPasswordState,
  selectShenyangVfsRegistrationDialCode,
  shouldRotateShenyangVfsPassword,
} from "./runner.js";
import { extractShenyangVfsSlotsFromTexts } from "./slots.js";

interface FakeField {
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  fill(value: string): Promise<void>;
}

interface FakeFieldCollection {
  count(): Promise<number>;
  nth(index: number): FakeField;
}

interface FakePage {
  locator(selector: string): FakeFieldCollection;
}

interface FakeCookieLocator {
  first(): FakeCookieLocator;
  count(): Promise<number>;
  nth(index: number): FakeCookieLocator;
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  click(options?: { timeout?: number }): Promise<void>;
}

interface FakeCookiePage {
  getByRole(role: string, options: { name: RegExp }): FakeCookieLocator;
  locator(selector: string): FakeCookieLocator;
}

function fakeMobilePage(selectorHint: string, visibility: boolean[]): { page: FakePage; filled: string[] } {
  const filled: string[] = [];
  const fields = visibility.map((visible) => ({
    isVisible: async () => visible,
    fill: async (value: string) => {
      filled.push(value);
    },
  }));
  return {
    page: {
      locator(selector: string): FakeFieldCollection {
        const matches = selector.includes(selectorHint) ? fields : [];
        return {
          count: async () => matches.length,
          nth: (index: number) => matches[index],
        };
      },
    },
    filled,
  };
}

function delayedContactMobilePage(missingChecks: number): {
  page: FakePage;
  filled: string[];
  contactLookups: () => number;
} {
  const filled: string[] = [];
  let lookups = 0;
  const contactField: FakeField = {
    isVisible: async () => true,
    fill: async (value: string) => {
      filled.push(value);
    },
  };
  return {
    page: {
      locator(selector: string): FakeFieldCollection {
        if (selector !== "input[formcontrolname='contact']") {
          return {
            count: async () => 0,
            nth: () => {
              throw new Error("unreachable");
            },
          };
        }
        lookups += 1;
        const matches = lookups > missingChecks ? [contactField] : [];
        return {
          count: async () => matches.length,
          nth: (index: number) => matches[index],
        };
      },
    },
    filled,
    contactLookups: () => lookups,
  };
}

function fakeCookiePage(options: {
  overlayVisible: boolean;
  buttonAfterChecks?: number;
}): {
  page: FakeCookiePage;
  clicked: string[];
  buttonChecks: Record<"reject" | "accept", number>;
} {
  let overlayVisible = options.overlayVisible;
  const buttonAfterChecks = options.buttonAfterChecks ?? Number.POSITIVE_INFINITY;
  const clicked: string[] = [];
  const buttonChecks: Record<"reject" | "accept", number> = { reject: 0, accept: 0 };
  const makeLocator = (visible: () => boolean, onClick?: () => void): FakeCookieLocator => {
    const locator: FakeCookieLocator = {
      first: () => locator,
      count: async () => 1,
      nth: () => locator,
      isVisible: async () => visible(),
      click: async () => {
        onClick?.();
      },
    };
    return locator;
  };
  return {
    page: {
      getByRole(_role: string, { name }: { name: RegExp }): FakeCookieLocator {
        const kind = /accept only necessary|reject all/i.test(name.source) ? "reject" : "accept";
        return makeLocator(() => {
          buttonChecks[kind] += 1;
          return overlayVisible && buttonChecks[kind] > buttonAfterChecks;
        }, () => {
          clicked.push(kind);
          overlayVisible = false;
        });
      },
      locator(selector: string): FakeCookieLocator {
        return makeLocator(() => selector.includes("onetrust") && overlayVisible);
      },
    },
    clicked,
    buttonChecks,
  };
}

function registrationConsentCookiePage(): {
  page: {
    getByRole(role: string, options: { name: RegExp }): FakeCookieLocator;
    locator(selector: string): unknown;
  };
  showOverlay(): void;
  checked: () => number;
  blockedChecks: () => number;
  dismissClicks: () => number;
} {
  let overlayVisible = false;
  let checked = 0;
  let blockedChecks = 0;
  let dismissClicks = 0;
  const consentCheckbox = {
    isVisible: async () => true,
    locator: () => ({ innerText: async () => "I accept the mandatory terms and privacy policy" }),
    check: async () => {
      if (overlayVisible) {
        blockedChecks += 1;
        throw new Error("OneTrust overlay blocked the consent checkbox.");
      }
      checked += 1;
    },
  };
  const consentCollection = {
    count: async () => 1,
    nth: () => consentCheckbox,
  };
  const makeLocator = (visible: () => boolean, onClick?: () => void): FakeCookieLocator => {
    const locator: FakeCookieLocator = {
      first: () => locator,
      count: async () => 1,
      nth: () => locator,
      isVisible: async () => visible(),
      click: async () => {
        onClick?.();
      },
    };
    return locator;
  };
  return {
    page: {
      getByRole: () => makeLocator(
        () => overlayVisible,
        () => {
          dismissClicks += 1;
          overlayVisible = false;
        },
      ),
      locator: (selector: string) => selector.includes("checkbox")
        ? consentCollection
        : makeLocator(() => selector.includes("onetrust") && overlayVisible),
    },
    showOverlay: () => {
      overlayVisible = true;
    },
    checked: () => checked,
    blockedChecks: () => blockedChecks,
    dismissClicks: () => dismissClicks,
  };
}

test("extracts and deduplicates only date-and-time slot observations", () => {
  const slots = extractShenyangVfsSlotsFromTexts([
    "18/08/2026 09:30 Available",
    "18/08/2026 09:30 Available",
    "2026-08-19 14:00",
    "20 August 2026 10:15",
    "21/08/2026 11:00 Fully booked",
    "Continue",
  ], "2026-08-13T08:00:00.000Z");

  assert.deepEqual(slots.map((slot) => [slot.appointment_date, slot.appointment_time]), [
    ["2026-08-18", "09:30"],
    ["2026-08-19", "14:00"],
    ["2026-08-20", "10:15"],
  ]);
  assert.ok(slots.every((slot) => slot.source === "official_vfs_korea_shenyang"));
  assert.ok(slots.every((slot) => slot.status === "observed"));
});

test("does not invent a slot from a date-only calendar label", () => {
  assert.deepEqual(extractShenyangVfsSlotsFromTexts(["18 August 2026", "No appointments available"]), []);
});

test("does not opt the applicant into optional marketing consent", () => {
  assert.equal(isOptionalRegistrationConsent("I accept the mandatory terms and privacy policy"), false);
  assert.equal(isOptionalRegistrationConsent("Receive promotional offers and newsletter updates"), true);
});

test("fills a visible mobile field across drifting VFS registration DOM contracts", async () => {
  const variants: Array<[string, boolean[]]> = [
    ["aria-label*='mobile'", [true]],
    ["placeholder*='mobile'", [true]],
    ["name*='mobile'", [true]],
    ["formcontrolname='contact'", [true]],
    ["type='tel'", [true]],
    [".intl-tel-input", [true]],
  ];

  for (const [selectorHint, visibility] of variants) {
    const fixture = fakeMobilePage(selectorHint, visibility);
    await fillShenyangVfsRegistrationMobileField(fixture.page as unknown as import("playwright").Page, "13800138000");
    assert.deepEqual(fixture.filled, ["13800138000"], `selector variant ${selectorHint}`);
  }
});

test("skips hidden duplicate mobile controls and fills the first visible one", async () => {
  const fixture = fakeMobilePage("formcontrolname='contact'", [false, true]);
  await fillShenyangVfsRegistrationMobileField(fixture.page as unknown as import("playwright").Page, "13800138000");
  assert.deepEqual(fixture.filled, ["13800138000"]);
});

test("prefers the stable contact control when the generated mobile id is also visible", async () => {
  const filled: string[] = [];
  const dynamicIdField: FakeField = {
    isVisible: async () => true,
    fill: async () => {
      filled.push("dynamic-id");
    },
  };
  const contactField: FakeField = {
    isVisible: async () => true,
    fill: async () => {
      filled.push("contact");
    },
  };
  const page: FakePage = {
    locator(selector: string): FakeFieldCollection {
      const matches = selector === "input#mat-input-3"
        ? [dynamicIdField]
        : selector === "input[formcontrolname='contact']"
          ? [contactField]
          : [];
      return {
        count: async () => matches.length,
        nth: (index: number) => matches[index],
      };
    },
  };

  await fillShenyangVfsRegistrationMobileField(page as unknown as import("playwright").Page, "13800138000");
  assert.deepEqual(filled, ["contact"]);
});

test("polls for a contact control that mounts after the first DOM checks", async () => {
  const fixture = delayedContactMobilePage(2);
  await fillShenyangVfsRegistrationMobileField(
    fixture.page as unknown as import("playwright").Page,
    "13800138000",
    { timeoutMs: 40, pollIntervalMs: 1 },
  );
  assert.deepEqual(fixture.filled, ["13800138000"]);
  assert.ok(fixture.contactLookups() >= 3);
});

test("keeps the original safe error when the mobile control never mounts", async () => {
  const fixture = fakeMobilePage("never-matches", [true]);
  await assert.rejects(
    () => fillShenyangVfsRegistrationMobileField(
      fixture.page as unknown as import("playwright").Page,
      "13800138000",
      { timeoutMs: 15, pollIntervalMs: 1 },
    ),
    { message: "The official VFS mobile-number field could not be identified." },
  );
});

test("waits for delayed OneTrust reject control and confirms the overlay disappears", async () => {
  const fixture = fakeCookiePage({ overlayVisible: true, buttonAfterChecks: 2 });
  await dismissShenyangVfsCookies(
    fixture.page as unknown as import("playwright").Page,
    { timeoutMs: 40, pollIntervalMs: 1 },
  );
  assert.deepEqual(fixture.clicked, ["reject"]);
  assert.ok(fixture.buttonChecks.reject >= 3);
});

test("does not block a page with no cookie overlay", async () => {
  const fixture = fakeCookiePage({ overlayVisible: false });
  await dismissShenyangVfsCookies(
    fixture.page as unknown as import("playwright").Page,
    { timeoutMs: 15, pollIntervalMs: 1 },
  );
  assert.deepEqual(fixture.clicked, []);
  assert.deepEqual(fixture.buttonChecks, { reject: 0, accept: 0 });
});

test("fails closed when a visible OneTrust overlay cannot be dismissed", async () => {
  const fixture = fakeCookiePage({ overlayVisible: true });
  await assert.rejects(
    () => dismissShenyangVfsCookies(
      fixture.page as unknown as import("playwright").Page,
      { timeoutMs: 15, pollIntervalMs: 1 },
    ),
    { message: "The official VFS cookie consent could not be dismissed." },
  );
});

test("dismisses a cookie overlay again immediately before required consent checks", async () => {
  const fixture = registrationConsentCookiePage();
  const page = fixture.page as unknown as import("playwright").Page;

  await dismissShenyangVfsCookies(page, { timeoutMs: 15, pollIntervalMs: 1 });
  fixture.showOverlay();
  await fillShenyangVfsRegistrationConsents(page);

  assert.equal(fixture.dismissClicks(), 1);
  assert.equal(fixture.blockedChecks(), 0);
  assert.equal(fixture.checked(), 1);
});

test("generates passwords accepted by the Shenyang VFS registration contract", () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const password = generateShenyangVfsPassword();
    assert.ok(password.length >= 8 && password.length <= 15);
    assert.match(password, /^[A-Za-z0-9$@#!%*?]+$/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /\d/);
    assert.match(password, /[$@#!%*?]/);
    assert.equal(isShenyangVfsPasswordCompliant(password), true);
  }
});

test("rotates an invalid unverified selector-drift password and retries registration", () => {
  const legacyPassword = "Aa1_aaaa";
  assert.equal(shouldRotateShenyangVfsPassword("selector_drift", false, legacyPassword), true);
  const state = resolveShenyangVfsPasswordState({
    password: legacyPassword,
    accountStatus: "selector_drift",
    emailVerified: false,
  });
  assert.equal(state.rotated, true);
  assert.equal(state.accountStatus, "account_prepared");
  assert.notEqual(state.password, legacyPassword);
  assert.equal(isShenyangVfsPasswordCompliant(state.password), true);
});

test("resets unverified selector-drift with a compliant password without rotating it", () => {
  const compliantPassword = "Aa1!aaaa";
  const state = resolveShenyangVfsPasswordState({
    password: compliantPassword,
    accountStatus: "selector_drift",
    emailVerified: false,
  });
  assert.equal(state.rotated, false);
  assert.equal(state.password, compliantPassword);
  assert.equal(state.accountStatus, "account_prepared");
});

test("never rotates protected or already compliant Shenyang VFS credentials", () => {
  const legacyPassword = "Aa1_aaaa";
  for (const input of [
    { accountStatus: "registered", emailVerified: false },
    { accountStatus: "logged_in", emailVerified: false },
    { accountStatus: "registration_submitting", emailVerified: false },
    { accountStatus: "selector_drift", emailVerified: true },
    { accountStatus: "account_prepared", emailVerified: true },
  ]) {
    assert.equal(shouldRotateShenyangVfsPassword(input.accountStatus, input.emailVerified, legacyPassword), false);
    const state = resolveShenyangVfsPasswordState({ ...input, password: legacyPassword });
    assert.equal(state.rotated, false);
    assert.equal(state.password, legacyPassword);
    assert.equal(state.accountStatus, input.accountStatus);
  }
  const compliantPassword = "Aa1!aaaa";
  const state = resolveShenyangVfsPasswordState({
    password: compliantPassword,
    accountStatus: "selector_drift",
    emailVerified: false,
  });
  assert.equal(state.rotated, false);
  assert.equal(state.password, compliantPassword);
  assert.equal(state.accountStatus, "account_prepared");
});

interface FakeDialLocator {
  first(): FakeDialLocator;
  count(): Promise<number>;
  nth(index: number): FakeDialLocator;
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  click(options?: { timeout?: number }): Promise<void>;
  evaluate(fn: (element: { tagName: string }) => string): Promise<string>;
  selectOption(value: string | { label: string }): Promise<void>;
  locator(selector: string): FakeDialLocator;
  filter(options: { hasText: RegExp }): FakeDialLocator;
  innerText(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
}

function fakeDialCodePage(options: {
  mountAfterChecks: number;
  visibility: boolean[];
  nativeSelect?: boolean;
  selectedText?: string;
}): {
  page: {
    locator(selector: string): FakeDialLocator;
    getByLabel(label: RegExp): FakeDialLocator;
    getByRole(role: string, options?: { name?: RegExp }): FakeDialLocator;
  };
  selected: () => string | null;
  dialChecks: () => number;
} {
  let dialChecks = 0;
  let opened = false;
  let selected: string | null = null;
  const optionsLocator = (onClick?: () => void): FakeDialLocator => {
    const option: FakeDialLocator = {
      first: () => option,
      count: async () => 1,
      nth: () => option,
      isVisible: async () => true,
      click: async () => {
        onClick?.();
      },
      evaluate: async (fn) => fn({ tagName: "MAT-OPTION" }),
      selectOption: async () => undefined,
      locator: () => option,
      filter: () => option,
      innerText: async () => "China (+86)",
      getAttribute: async (name) => name === "value" ? "CN" : null,
    };
    return option;
  };
  const controls = options.visibility.map((visible) => {
    const control: FakeDialLocator = {
      first: () => control,
      count: async () => 1,
      nth: () => control,
      isVisible: async () => visible,
      click: async () => {
        opened = true;
      },
      evaluate: async (fn) => fn({ tagName: options.nativeSelect ? "SELECT" : "MAT-SELECT" }),
      selectOption: async (value) => {
        selected = typeof value === "string" ? value : value.label;
      },
      locator: (selector) => selector === "option" ? optionsLocator(() => {
        selected = "CN";
      }) : control,
      filter: () => control,
        innerText: async () => selected ? options.selectedText ?? "China (+86)" : "",
      getAttribute: async () => null,
    };
    return control;
  });
  const collection = (items: FakeDialLocator): FakeDialLocator => items;
  const empty = (): FakeDialLocator => {
    const locator: FakeDialLocator = {
      first: () => locator,
      count: async () => 0,
      nth: () => locator,
      isVisible: async () => false,
      click: async () => undefined,
      evaluate: async (fn) => fn({ tagName: "DIV" }),
      selectOption: async () => undefined,
      locator: () => locator,
      filter: () => locator,
      innerText: async () => "",
      getAttribute: async () => null,
    };
    return locator;
  };
  const page = {
    locator: (selector: string): FakeDialLocator => {
      if (!selector.includes("formcontrolname='dialcode'")) return empty();
      dialChecks += 1;
      if (dialChecks <= options.mountAfterChecks) return empty();
      return collection({
        first: () => controls[0],
        count: async () => controls.length,
        nth: (index) => controls[index],
        isVisible: async () => controls.some((control) => control === controls[0]),
        click: async () => undefined,
        evaluate: async (fn) => fn({ tagName: "DIV" }),
        selectOption: async () => undefined,
        locator: () => empty(),
        filter: () => empty(),
        innerText: async () => "",
        getAttribute: async () => null,
      });
    },
    getByLabel: () => empty(),
    getByRole: (role: string) => role === "option" && opened
      ? optionsLocator(() => {
        selected = "CN";
      })
      : empty(),
  };
  return {
    page,
    selected: () => selected,
    dialChecks: () => dialChecks,
  };
}

test("polls for the stable dialcode control before selecting China (+86)", async () => {
  const fixture = fakeDialCodePage({ mountAfterChecks: 2, visibility: [true] });
  await selectShenyangVfsRegistrationDialCode(
    fixture.page as unknown as import("playwright").Page,
    { timeoutMs: 40, pollIntervalMs: 1 },
  );
  assert.equal(fixture.selected(), "CN");
  assert.ok(fixture.dialChecks() >= 3);
});

test("skips hidden duplicate dial controls and selects only the visible China option", async () => {
  const fixture = fakeDialCodePage({ mountAfterChecks: 0, visibility: [false, true] });
  await selectShenyangVfsRegistrationDialCode(
    fixture.page as unknown as import("playwright").Page,
    { timeoutMs: 40, pollIntervalMs: 1 },
  );
  assert.equal(fixture.selected(), "CN");
});

test("fails closed when the Shenyang China dial-code control never mounts", async () => {
  const fixture = fakeDialCodePage({ mountAfterChecks: Number.POSITIVE_INFINITY, visibility: [true] });
  await assert.rejects(
    () => selectShenyangVfsRegistrationDialCode(
      fixture.page as unknown as import("playwright").Page,
      { timeoutMs: 15, pollIntervalMs: 1 },
    ),
    { message: "The official VFS China dial-code control could not be identified or selected." },
  );
});

test("fails closed when the dial control cannot confirm China (+86) after selection", async () => {
  const fixture = fakeDialCodePage({ mountAfterChecks: 0, visibility: [true], selectedText: "86" });
  await assert.rejects(
    () => selectShenyangVfsRegistrationDialCode(
      fixture.page as unknown as import("playwright").Page,
      { timeoutMs: 15, pollIntervalMs: 1 },
    ),
    { message: "The official VFS China dial-code control could not be identified or selected." },
  );
});
