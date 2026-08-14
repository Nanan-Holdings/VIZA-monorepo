import assert from "node:assert/strict";
import test from "node:test";
import {
  dismissShenyangVfsCookies,
  fillShenyangVfsRegistrationMobileField,
  isOptionalRegistrationConsent,
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
