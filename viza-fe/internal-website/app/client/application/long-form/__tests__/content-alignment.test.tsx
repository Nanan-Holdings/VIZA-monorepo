import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentAlignment } from "../use-content-alignment";

type Geometry = {
  homeLeft: number;
  homeWidth: number;
  contentLeft: number;
};

function rect(left: number, width: number): DOMRect {
  return {
    bottom: 24,
    height: 24,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function AlignmentProbe() {
  const contentRef = useRef<HTMLElement | null>(null);
  const alignment = useContentAlignment(contentRef);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  return (
    <main ref={contentRef} data-alignment={alignment} data-render-count={renderCountRef.current}>
      <div data-aligned-content style={{ marginLeft: `${alignment}px` }} />
    </main>
  );
}

function installRafQueue() {
  let nextFrameId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId;
    callbacks.set(id, callback);
    return id;
  });
  const cancelAnimationFrame = vi.fn((id: number) => {
    callbacks.delete(id);
  });

  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: requestAnimationFrame,
    writable: true,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: cancelAnimationFrame,
    writable: true,
  });

  return {
    callbacks,
    cancelAnimationFrame,
    requestAnimationFrame,
    restore: () => {
      Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        value: originalRequestAnimationFrame,
        writable: true,
      });
      Object.defineProperty(window, "cancelAnimationFrame", {
        configurable: true,
        value: originalCancelAnimationFrame,
        writable: true,
      });
    },
  };
}

async function flushRaf(
  callbacks: Map<number, FrameRequestCallback>,
): Promise<void> {
  const queued = [...callbacks.values()];
  callbacks.clear();
  await act(async () => {
    for (const callback of queued) callback(performance.now());
  });
}

async function flushMutationObserver(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useContentAlignment", () => {
  let geometry: Geometry;
  let anchor: HTMLAnchorElement;
  let rectSpy: ReturnType<typeof vi.spyOn>;
  let restoreRaf: (() => void) | undefined;

  beforeEach(() => {
    geometry = {
      homeLeft: 140,
      homeWidth: 120,
      contentLeft: 100,
    };

    anchor = document.createElement("a");
    anchor.dataset.navAnchor = "Home";
    document.body.append(anchor);

    rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this === anchor) return rect(geometry.homeLeft, geometry.homeWidth);
        if (this.tagName === "MAIN") return rect(geometry.contentLeft, 900);
        return rect(0, 0);
      });
  });

  afterEach(() => {
    anchor.remove();
    document.querySelectorAll("[data-portal-probe]").forEach((node) => node.remove());
    restoreRaf?.();
    vi.restoreAllMocks();
  });

  it("coalesces portal mutations when the measured geometry is unchanged", async () => {
    const raf = installRafQueue();
    restoreRaf = raf.restore;
    const view = render(<AlignmentProbe />);
    const content = view.container.querySelector("main")!;

    await flushRaf(raf.callbacks);
    expect(content).toHaveAttribute("data-alignment", "40");
    expect(content.querySelector("[data-aligned-content]")).toHaveStyle({
      marginLeft: "40px",
    });

    rectSpy.mockClear();
    for (let index = 0; index < 3; index += 1) {
      const portalNode = document.createElement("div");
      portalNode.dataset.portalProbe = String(index);
      document.body.append(portalNode);
      await flushMutationObserver();
    }

    // Each observer callback only schedules work. Before the queued frame,
    // repeated Radix portal commits must not measure or update React state.
    expect(rectSpy).not.toHaveBeenCalled();
    expect(raf.callbacks.size).toBe(1);

    const rendersBeforeFrame = content.getAttribute("data-render-count");
    await flushRaf(raf.callbacks);

    expect(rectSpy).toHaveBeenCalledTimes(3);
    expect(content).toHaveAttribute("data-alignment", "40");
    expect(content).toHaveAttribute("data-render-count", rendersBeforeFrame!);
    view.unmount();
  });

  it("remeasures once for a resize and removes the listener and pending frame", async () => {
    const raf = installRafQueue();
    restoreRaf = raf.restore;
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, "disconnect");
    const view = render(<AlignmentProbe />);
    const content = view.container.querySelector("main")!;

    await flushRaf(raf.callbacks);
    rectSpy.mockClear();
    geometry.homeLeft = 180;
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));

    expect(rectSpy).not.toHaveBeenCalled();
    expect(raf.callbacks.size).toBe(1);
    await flushRaf(raf.callbacks);

    expect(rectSpy).toHaveBeenCalledTimes(3);
    expect(content).toHaveAttribute("data-alignment", "80");

    window.dispatchEvent(new Event("resize"));
    expect(raf.callbacks.size).toBe(1);
    view.unmount();

    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(raf.callbacks.size).toBe(0);
  });
});
