import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

import RootErrorBoundary from "../error";

describe("RootErrorBoundary", () => {
  it("resets automatically for runtime abort errors", async () => {
    const reset = vi.fn();

    render(<NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <RootErrorBoundary error={new Error("aborted")} reset={reset} />
    </NextIntlClientProvider>);

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  });

  it("updates the page recovery message with the selected language", () => {
    const error = new Error("page unavailable");
    const reset = vi.fn();
    const view = render(<NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <RootErrorBoundary error={error} reset={reset} />
    </NextIntlClientProvider>);
    expect(screen.getByText(en.pageError.title)).toBeInTheDocument();
    view.rerender(<NextIntlClientProvider locale="zh" messages={zh} timeZone="UTC">
      <RootErrorBoundary error={error} reset={reset} />
    </NextIntlClientProvider>);
    expect(screen.getByText(zh.pageError.title)).toBeInTheDocument();
    expect(screen.queryByText(en.pageError.title)).not.toBeInTheDocument();
  });
});
