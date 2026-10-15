// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://app.viza.it.com/client/home"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";

const fakePostHog = vi.hoisted(() => {
  const state = { distinctId: "anon-1", userState: "anonymous" as string };
  return {
    state,
    init: vi.fn(),
    identify: vi.fn((id: string) => {
      state.distinctId = id;
      state.userState = "identified";
    }),
    reset: vi.fn(() => {
      state.distinctId = "anon-2";
      state.userState = "anonymous";
    }),
    capture: vi.fn(),
    get_distinct_id: vi.fn(() => state.distinctId),
    get_property: vi.fn((key: string) => (key === "$user_state" ? state.userState : undefined)),
  };
});

vi.mock("posthog-js", () => ({ default: fakePostHog }));

import {
  __resetPostHogStateForTests,
  buildPostHogConfig,
  captureEvent,
  identifyUser,
  isAnalyticsEnabled,
  resetAnalytics,
  sanitizeEvent,
  toRoutePath,
  toRouteUrl,
} from "../posthog";

const UUID = "3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f";

function clearConsentCookie() {
  document.cookie = "viza_cookie_consent=; path=/; max-age=0";
}

beforeEach(() => {
  __resetPostHogStateForTests();
  vi.clearAllMocks();
  fakePostHog.state.distinctId = "anon-1";
  fakePostHog.state.userState = "anonymous";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
  clearConsentCookie();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  clearConsentCookie();
});

describe("route sanitising", () => {
  it("replaces id-like segments and keeps route words", () => {
    expect(toRoutePath(`/client/application/${UUID}/review`)).toBe("/client/application/:id/review");
    expect(toRoutePath("/client/signing/12345")).toBe("/client/signing/:id");
    expect(toRoutePath("/bilingual-review-preview")).toBe("/bilingual-review-preview");
    expect(toRoutePath("/client/simplified-form")).toBe("/client/simplified-form");
  });

  it("drops query strings and hashes from URLs", () => {
    expect(toRouteUrl(`https://app.viza.it.com/client/status?applicationId=${UUID}#top`)).toBe(
      "https://app.viza.it.com/client/status",
    );
    expect(toRouteUrl("$direct")).toBe("$direct");
    expect(toRouteUrl(`/client/application/${UUID}?step=3`)).toBe("/client/application/:id");
  });

  it("sanitises every URL-like property before send and tags the app", () => {
    const event = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: `https://app.viza.it.com/client/application/${UUID}?token=secret`,
        $pathname: `/client/application/${UUID}`,
        $referrer: "https://viza.it.com/apply?email=a@b.c",
        $prev_pageview_pathname: `/client/documents/${UUID}`,
        title: "VIZA Portal",
      },
      $set_once: {
        $initial_current_url: `https://app.viza.it.com/client/login?next=/client/application/${UUID}`,
      },
    } as unknown as CaptureResult;

    const result = sanitizeEvent(event);

    expect(result?.properties.$current_url).toBe("https://app.viza.it.com/client/application/:id");
    expect(result?.properties.$pathname).toBe("/client/application/:id");
    expect(result?.properties.$referrer).toBe("https://viza.it.com/apply");
    expect(result?.properties.$prev_pageview_pathname).toBe("/client/documents/:id");
    expect(result?.properties.app).toBe("portal");
    expect(result?.$set_once?.$initial_current_url).toBe("https://app.viza.it.com/client/login");
    expect(JSON.stringify(result)).not.toContain(UUID);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("drops events once the visitor rejects analytics cookies", () => {
    document.cookie = "viza_cookie_consent=reject; path=/";
    const event = { uuid: "u", event: "x", properties: {} } as unknown as CaptureResult;
    expect(sanitizeEvent(event)).toBeNull();
  });
});

describe("privacy configuration", () => {
  it("keeps replay, autocapture and lazy scripts off", () => {
    const config = buildPostHogConfig();
    expect(config.disable_session_recording).toBe(true);
    expect(config.autocapture).toBe(false);
    expect(config.mask_all_text).toBe(true);
    expect(config.mask_all_element_attributes).toBe(true);
    expect(config.person_profiles).toBe("identified_only");
    expect(config.capture_pageview).toBe("history_change");
    expect(config.capture_exceptions).toBe(false);
    expect(config.capture_performance).toBe(false);
    expect(config.disable_external_dependency_loading).toBe(true);
    expect(config.session_recording).toMatchObject({ recordBody: false, recordHeaders: false });
  });
});

describe("loading", () => {
  it("is a no-op without a key", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(isAnalyticsEnabled()).toBe(false);
    captureEvent("application_started", {});
    await Promise.resolve();
    expect(fakePostHog.init).not.toHaveBeenCalled();
  });

  it("is a no-op after the visitor rejects analytics cookies", () => {
    document.cookie = "viza_cookie_consent=reject; path=/";
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("initialises once on the production host", async () => {
    expect(isAnalyticsEnabled()).toBe(true);
    captureEvent("chat_assistant_used", { assistant: "visa" });
    captureEvent("chat_assistant_used", { assistant: "travel" });
    await vi.waitFor(() => expect(fakePostHog.capture).toHaveBeenCalledTimes(2));
    expect(fakePostHog.init).toHaveBeenCalledTimes(1);
    expect(fakePostHog.init.mock.calls[0][0]).toBe("phc_test_key");
  });
});

describe("identity", () => {
  it("identifies with the auth uid and role only", async () => {
    await identifyUser({ userId: UUID, role: null });
    expect(fakePostHog.identify).toHaveBeenCalledWith(UUID, { role: "applicant", is_staff: false });
  });

  it("tags staff accounts", async () => {
    await identifyUser({ userId: UUID, role: "admin" });
    expect(fakePostHog.identify).toHaveBeenCalledWith(UUID, { role: "admin", is_staff: true });
    const event = sanitizeEvent({ uuid: "u", event: "x", properties: {} } as unknown as CaptureResult);
    expect(event?.properties.is_staff).toBe(true);
  });

  it("does not re-identify the same person", async () => {
    await identifyUser({ userId: UUID, role: null });
    await identifyUser({ userId: UUID, role: null });
    expect(fakePostHog.identify).toHaveBeenCalledTimes(1);
  });

  it("resets before identifying a different person", async () => {
    await identifyUser({ userId: UUID, role: null });
    await identifyUser({ userId: "other-user", role: null });
    expect(fakePostHog.reset).toHaveBeenCalledTimes(1);
    expect(fakePostHog.identify).toHaveBeenLastCalledWith("other-user", { role: "applicant", is_staff: false });
  });

  it("resets on sign-out", async () => {
    await identifyUser({ userId: UUID, role: "staff" });
    resetAnalytics();
    expect(fakePostHog.reset).toHaveBeenCalledTimes(1);
    const event = sanitizeEvent({ uuid: "u", event: "x", properties: {} } as unknown as CaptureResult);
    expect(event?.properties.is_staff).toBeUndefined();
  });
});
