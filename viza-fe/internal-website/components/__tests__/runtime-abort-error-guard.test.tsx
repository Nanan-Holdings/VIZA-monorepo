import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RuntimeAbortErrorGuard } from "../runtime-abort-error-guard";

const { attemptReloadMock } = vi.hoisted(() => ({
  attemptReloadMock: vi.fn(),
}));

vi.mock("@/lib/server-action-recovery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server-action-recovery")>();
  return {
    ...original,
    attemptStaleServerActionReload: attemptReloadMock,
  };
});

function createUnhandledRejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(event, "reason", { value: reason });
  Object.defineProperty(event, "promise", { value: Promise.resolve() });
  return event;
}

describe("RuntimeAbortErrorGuard", () => {
  beforeEach(() => {
    attemptReloadMock.mockReset();
  });

  it("prevents abort-only unhandled rejections from reaching the runtime overlay", () => {
    render(<RuntimeAbortErrorGuard />);

    const event = createUnhandledRejectionEvent(new Error("signal is aborted without reason"));
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("allows real unhandled rejections to keep surfacing", () => {
    render(<RuntimeAbortErrorGuard />);

    const event = createUnhandledRejectionEvent(new Error("database permission denied"));
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("prevents abort-only error events from reaching the runtime overlay", () => {
    render(<RuntimeAbortErrorGuard />);

    const event = new ErrorEvent("error", {
      error: new Error("signal is aborted without reason"),
      message: "signal is aborted without reason",
    });
    const preventDefault = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("prevents stale Server Action failures from reaching the runtime overlay", () => {
    render(<RuntimeAbortErrorGuard />);

    const event = createUnhandledRejectionEvent(
      new Error('Server Action "old-id" was not found on the server.'),
    );
    const preventDefault = vi.spyOn(event, "preventDefault");
    const stopImmediatePropagation = vi.spyOn(event, "stopImmediatePropagation");

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(attemptReloadMock).toHaveBeenCalledOnce();
  });
});
