import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attemptStaleServerActionReload,
  isStaleServerActionError,
  resetStaleServerActionRecoveryForTests,
} from "../server-action-recovery";

describe("server action recovery", () => {
  beforeEach(() => {
    resetStaleServerActionRecoveryForTests();
  });

  it("recognizes the stale Next.js Server Action response", () => {
    expect(
      isStaleServerActionError(
        new Error(
          'Server Action "60ddccfff2f505cfbe010afbdd698b6ecc03792cad" was not found on the server.',
        ),
      ),
    ).toBe(true);
    expect(
      isStaleServerActionError(
        "Failed to find Server Action. Read more: /docs/messages/failed-to-find-server-action",
      ),
    ).toBe(true);
  });

  it("does not treat application or database errors as stale bundles", () => {
    expect(isStaleServerActionError(new Error("permission denied for table applications"))).toBe(false);
  });

  it("hard reloads once and records a cooldown timestamp", () => {
    const reload = vi.fn();
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const error = new Error('Server Action "old-id" was not found on the server.');

    expect(
      attemptStaleServerActionReload(error, {
        now: 10_000,
        reload,
        storage,
        storageKey: "test-key",
      }),
    ).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(values.get("test-key")).toBe("10000");

    expect(
      attemptStaleServerActionReload(error, {
        now: 10_001,
        reload,
        storage,
        storageKey: "test-key",
      }),
    ).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload again during the cooldown after a fresh document loads", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => "10000",
      setItem: vi.fn(),
    };

    expect(
      attemptStaleServerActionReload(new Error("Failed to find Server Action"), {
        now: 20_000,
        reload,
        storage,
        storageKey: "test-key",
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
