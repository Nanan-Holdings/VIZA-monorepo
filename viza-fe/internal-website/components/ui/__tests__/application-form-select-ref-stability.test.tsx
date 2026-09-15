import { render } from "@testing-library/react";
import type { RefCallback } from "react";
import { describe, expect, it } from "vitest";

import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "../application-form-select";
import { Select, SelectValue } from "../select";

type SelectOption = {
  value: string;
  label: string;
};

const initialOptions: SelectOption[] = [
  { value: "BEJ", label: "Beijing" },
  { value: "SHA", label: "Shanghai" },
];

const noop = () => undefined;

function SelectHarness({
  options,
  renderToken,
  forwardedRef,
}: {
  options: ReadonlyArray<SelectOption>;
  renderToken: number;
  forwardedRef: RefCallback<HTMLButtonElement>;
}) {
  return (
    <form data-render-token={renderToken}>
      <Select name="consular_post" value="BEJ" onValueChange={noop}>
        <ApplicationFormSelectTrigger
          ref={forwardedRef}
          aria-label="Consular post"
          filled
        >
          <SelectValue />
        </ApplicationFormSelectTrigger>
        <ApplicationFormSelectContent forceMount>
          {options.map((option) => (
            <ApplicationFormSelectItem key={option.value} value={option.value}>
              {option.label}
            </ApplicationFormSelectItem>
          ))}
        </ApplicationFormSelectContent>
      </Select>
    </form>
  );
}

describe("ApplicationFormSelect ref stability", () => {
  it("keeps a filled selection and stable trigger ref across parent and option updates", () => {
    const refCalls: Array<HTMLButtonElement | null> = [];
    const forwardedRef: RefCallback<HTMLButtonElement> = (node) => {
      refCalls.push(node);
    };
    const { rerender } = render(
      <SelectHarness
        forwardedRef={forwardedRef}
        options={initialOptions}
        renderToken={0}
      />,
    );

    const nativeSelect = () =>
      document.querySelector<HTMLSelectElement>('select[name="consular_post"]');
    expect(nativeSelect()).toHaveValue("BEJ");
    expect(refCalls.filter((node) => node === null)).toHaveLength(0);

    rerender(
      <SelectHarness
        forwardedRef={forwardedRef}
        options={[
          ...initialOptions,
          { value: "SIN", label: "Singapore" },
        ]}
        renderToken={1}
      />,
    );

    // @radix-ui/react-slot <=1.2.4 recreated SlotClone's composed ref on
    // every commit. React 19 then detached the trigger (null) and reattached
    // it, which could reset Select's trigger state during a parent update.
    expect(refCalls.filter((node) => node === null)).toHaveLength(0);
    expect(
      new Set(refCalls.filter((node): node is HTMLButtonElement => node !== null)).size,
    ).toBe(1);
    expect(nativeSelect()).toHaveValue("BEJ");
    expect(document.querySelector('[role="combobox"]')).toHaveTextContent("Beijing");
  });
});
