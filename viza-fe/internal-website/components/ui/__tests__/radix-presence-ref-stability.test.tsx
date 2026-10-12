import { act, fireEvent, render } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as PresencePrimitive from "@radix-ui/react-presence";
import * as Primitive from "@radix-ui/react-primitive";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { NextIntlClientProvider } from "next-intl";
import { ApplicationFormDatePicker } from "../application-form-date-picker";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible";
import { ApplicationSearchableSelect } from "../application-form-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip";

function PresenceSlotHarness() {
  const [revision, setRevision] = useState(0);
  const tooltipRefCalls = useRef(0);
  const triggerRefCalls = useRef(0);
  const tooltipRef = useCallback(() => {
    tooltipRefCalls.current += 1;
  }, []);
  const triggerRef = useCallback(() => {
    triggerRefCalls.current += 1;
  }, []);

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button ref={triggerRef} type="button" onClick={() => setRevision((current) => current + 1)}>
              Show help {revision}
            </button>
          </TooltipTrigger>
          <TooltipContent forceMount ref={tooltipRef}>Help text</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Collapsible open>
        <CollapsibleTrigger type="button">Details {revision}</CollapsibleTrigger>
        <CollapsibleContent forceMount>
          <p>Details content</p>
        </CollapsibleContent>
      </Collapsible>
      <output data-testid="tooltip-ref-calls">{tooltipRefCalls.current}</output>
      <output data-testid="trigger-ref-calls">{triggerRefCalls.current}</output>
    </>
  );
}

function DirectPresenceSlotHarness() {
  const [revision, setRevision] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setRevision((current) => current + 1)}>
        Rerender {revision}
      </button>
      <PresencePrimitive.Presence present>
        <Primitive.Primitive.div asChild>
          <div>Presence content {revision}</div>
        </Primitive.Primitive.div>
      </PresencePrimitive.Presence>
    </>
  );
}

function SearchableSelectHarness() {
  const [value, setValue] = useState("");
  const [revision, setRevision] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setRevision((current) => current + 1)}>
        Parent update {revision}
      </button>
      <ApplicationSearchableSelect
        value={value}
        onValueChange={setValue}
        options={[
          { value: "BEJ", text: "Beijing" },
          { value: "SHA", text: "Shanghai" },
          { value: "CAN", text: "Guangzhou" },
        ]}
        placeholder="Select post"
      />
    </>
  );
}

describe("Radix Presence ref stability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps an unchanged tooltip trigger attached when its Presence tree rerenders", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getByRole, getByTestId, getByText } = render(<PresenceSlotHarness />);

    expect(getByRole("tooltip")).toHaveTextContent("Help text");
    expect(getByText("Details content")).toBeInTheDocument();

    act(() => {
      fireEvent.click(getByRole("button", { name: /show help/i }));
    });

    expect(getByRole("button", { name: /show help 1/i })).toBeInTheDocument();
    // The unchanged button must remain attached. Nested Slot 1.2.x calls this
    // ref with null and then the node again; Presence turns that churn into state updates.
    expect(Number(getByTestId("trigger-ref-calls").textContent)).toBe(1);
    expect(consoleError.mock.calls.flat().map(String).join("\n")).not.toMatch(/Maximum update depth|Rendered more hooks/);
  });

  it("does not loop for the underlying Presence plus asChild Slot composition", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getByRole, getByText } = render(<DirectPresenceSlotHarness />);

    expect(getByText("Presence content 0")).toBeInTheDocument();
    act(() => {
      fireEvent.click(getByRole("button", { name: /rerender 0/i }));
    });

    expect(getByText("Presence content 1")).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().map(String).join("\n")).not.toMatch(/Maximum update depth|Rendered more hooks/);
  });

  it("does not loop when opening the application's searchable select portal", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getByRole, getByText, queryByPlaceholderText } = render(<SearchableSelectHarness />);

    act(() => {
      fireEvent.click(getByRole("button", { name: /select post/i }));
    });
    expect(getByText("Beijing")).toBeInTheDocument();

    act(() => {
      fireEvent.click(getByRole("button", { name: /parent update 0/i }));
    });
    expect(queryByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().map(String).join("\n")).not.toMatch(/Maximum update depth|Rendered more hooks/);
  });

  it("does not detach a FocusScope container when its parent rerenders", () => {
    const calls: Array<HTMLDivElement | null> = [];
    const nodeRef = (node: HTMLDivElement | null) => { calls.push(node); };
    const scope = (revision: number) => (
      <FocusScope asChild ref={nodeRef}>
        <div><button type="button">Focus content {revision}</button></div>
      </FocusScope>
    );
    const view = render(scope(0));
    const initialCalls = calls.length;
    view.rerender(scope(1));
    expect(view.getByRole("button", { name: "Focus content 1" })).toBeInTheDocument();
    expect(calls.slice(initialCalls).filter((node) => node === null)).toHaveLength(0);
  });

  it("opens and closes the canonical date picker without changing the saved date", () => {
    const onChange = vi.fn();
    const view = render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <ApplicationFormDatePicker value="2026-11-01" onChange={onChange} />
      </NextIntlClientProvider>,
    );
    const trigger = view.getByRole("button", { name: /November 1st, 2026/ });
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(trigger);
      expect(view.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
      expect(view.queryByRole("dialog")).not.toBeInTheDocument();
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lets a partial-date field enter a month without synthesizing a day", () => {
    const onChange = vi.fn();
    const view = render(
      <NextIntlClientProvider locale="zh" messages={{}}>
        <ApplicationFormDatePicker
          value="2026-11"
          onChange={onChange}
          minimumDatePrecision="month"
          mode="month"
          displayLocale="zh"
        />
      </NextIntlClientProvider>,
    );

    const input = view.getByRole("textbox", { name: "请输入年份和月份（日期未知）" });
    expect(input).toHaveValue("2026-11");
    fireEvent.change(input, { target: { value: "202612" } });
    expect(onChange).toHaveBeenCalledWith("2026-12");
    expect(view.container.querySelector('[data-date-mode="month"]')).toBeInTheDocument();
  });
});
