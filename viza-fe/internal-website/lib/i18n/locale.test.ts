import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_CHANGE_EVENT, LOCALE_COOKIE, setInterfaceLocalePreference } from "./locale";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.cookie = `${LOCALE_COOKIE}=; max-age=0; path=/`;
});

describe("interface language preference", () => {
  it("keeps auth and portal cookie/storage/event consumers aligned in both directions", () => {
    const listener = vi.fn();
    window.addEventListener(LOCALE_CHANGE_EVENT, listener);
    try {
      for (const locale of ["zh", "en", "zh"]) {
        setInterfaceLocalePreference(locale);
        expect(document.cookie).toContain(`${LOCALE_COOKIE}=${locale}`);
        expect(localStorage.getItem(LOCALE_COOKIE)).toBe(locale);
        expect((listener.mock.lastCall?.[0] as CustomEvent).detail).toBe(locale);
      }
    } finally {
      window.removeEventListener(LOCALE_CHANGE_EVENT, listener);
    }
  });

  it("switches language even when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
    expect(() => setInterfaceLocalePreference("en")).not.toThrow();
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
  });
});
