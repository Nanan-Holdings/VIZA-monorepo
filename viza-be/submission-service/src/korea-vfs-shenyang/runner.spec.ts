import assert from "node:assert/strict";
import test from "node:test";
import { fillShenyangVfsRegistrationMobileField, isOptionalRegistrationConsent } from "./runner.js";
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
