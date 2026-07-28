import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RuntimeAbortErrorGuard } from "../runtime-abort-error-guard";

function createUnhandledRejectionEvent(reason: unknown) {
  const event = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(event, "reason", { value: reason });
  Object.defineProperty(event, "promise", { value: Promise.resolve() });
  return event;
}

describe("RuntimeAbortErrorGuard", () => {
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
});
