import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegionSelect } from "../region-select";

describe("RegionSelect", () => {
  it("formats region labels without changing the canonical selected code", async () => {
    const onChange = vi.fn();
    const formatRegionName = vi.fn((region: { name: string; shortCode: string }) =>
      region.shortCode === "AL" ? "阿拉巴马州" : region.name,
    );
    const view = render(
      <RegionSelect
        countryCode="US"
        whitelist={["AL"]}
        placeholder="请选择州"
        formatRegionName={formatRegionName}
        onChange={onChange}
      />,
    );

    fireEvent.click(view.getByRole("combobox"));

    const option = view.getByRole("option", { name: "阿拉巴马州" });
    expect(option).toBeInTheDocument();
    expect(view.queryByRole("option", { name: "Alabama" })).not.toBeInTheDocument();
    expect(formatRegionName).toHaveBeenCalledWith({ name: "Alabama", shortCode: "AL" });

    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith({ name: "Alabama", shortCode: "AL" });
    await waitFor(() => {
      expect(view.getByRole("combobox")).toHaveTextContent("阿拉巴马州");
    });
  });

  it("keeps source region names when no formatter is provided", () => {
    const view = render(
      <RegionSelect countryCode="US" whitelist={["AL"]} placeholder="Select a state" />,
    );

    fireEvent.click(view.getByRole("combobox"));

    expect(view.getByRole("option", { name: "Alabama" })).toBeInTheDocument();
  });

  it("hydrates a saved US state code into the selected control", async () => {
    const view = render(
      <RegionSelect countryCode="US" defaultValue="CA" placeholder="Select a state" />,
    );

    await waitFor(() => {
      expect(view.getByRole("combobox")).toHaveTextContent("California");
    });
  });
});
