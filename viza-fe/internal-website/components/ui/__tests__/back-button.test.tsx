import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BackButton,
  getSafeInternalBackHref,
  hasSameOriginHistoryEntry,
} from "@/components/ui/back-button";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

function setReferrer(value: string) {
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value,
  });
}

describe("BackButton", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    vi.restoreAllMocks();
    setReferrer("");
  });

  it("uses browser history for a same-origin previous entry", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    setReferrer(`${window.location.origin}/client/application?country=taiwan#review`);

    render(<BackButton fallbackHref="/client/home" />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(back).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("uses fallback for a direct deep link and preserves query/hash", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);

    render(<BackButton fallbackHref="/client/status?country=taiwan#submitted" />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(navigation.push).toHaveBeenCalledWith("/client/status?country=taiwan#submitted");
  });

  it("rejects external fallback targets", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);

    render(<BackButton fallbackHref="https://evil.example/client/status" />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(navigation.push).toHaveBeenCalledWith("/client/home");
  });

  it("classifies same-origin history without trusting cross-origin referrers", () => {
    expect(
      hasSameOriginHistoryEntry({
        historyLength: 2,
        referrer: "https://app.viza.it.com/client/home?tab=1#x",
        currentOrigin: "https://app.viza.it.com",
      }),
    ).toBe(true);
    expect(
      hasSameOriginHistoryEntry({
        historyLength: 2,
        referrer: "https://evil.example/client/home",
        currentOrigin: "https://app.viza.it.com",
      }),
    ).toBe(false);
  });

  it("sanitizes fallback hrefs while retaining internal query/hash", () => {
    expect(
      getSafeInternalBackHref(
        "/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT#documents",
      ),
    ).toBe("/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT#documents");
    expect(getSafeInternalBackHref("//evil.example/client/home")).toBe("/client/home");
  });
});
