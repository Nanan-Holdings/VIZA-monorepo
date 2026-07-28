import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RootErrorBoundary from "../error";

describe("RootErrorBoundary", () => {
  it("resets automatically for runtime abort errors", async () => {
    const reset = vi.fn();

    render(<RootErrorBoundary error={new Error("signal is aborted without reason")} reset={reset} />);

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  });
});
