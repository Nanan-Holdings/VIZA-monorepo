import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useLocale, useMessages, useNow, useTimeZone, useTranslations } from "next-intl";
import { startTransition, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalogErrorBoundary, CatalogLoadError, LocaleMessagesProvider } from "./client-provider";

const now = new Date("2026-09-12T00:00:00Z");

function FormProbe() {
  const [value, setValue] = useState("");
  const t = useTranslations("common");
  return (
    <>
      <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
      <span data-testid="locale">{useLocale()}</span>
      <span data-testid="message">{t("error")}</span>
      <span data-testid="catalog">{JSON.stringify(useMessages())}</span>
      <span data-testid="zone">{useTimeZone()}</span>
      <span data-testid="now">{useNow().toISOString()}</span>
    </>
  );
}

function FailingCatalog({ locale }: { locale: "en" | "zh" | "vi" | "es" }): ReactNode {
  throw new CatalogLoadError(locale, new Error("synthetic chunk failure"));
}

function TestRoot({ locale }: { locale: string }) {
  return (
    <NextIntlClientProvider locale={locale} messages={null} timeZone="Europe/Berlin" now={now}>
      <LocaleMessagesProvider locale={locale}><FormProbe /></LocaleMessagesProvider>
    </NextIntlClientProvider>
  );
}

describe("locale catalog delivery", () => {
  it("preserves entered form state and inherited configuration across language refreshes", async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<TestRoot locale="en" />); });
    await screen.findByText("An error occurred");
    fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "unsaved draft" } });
    const input = screen.getByRole("textbox", { name: "Draft" });
    await act(async () => { startTransition(() => view.rerender(<TestRoot locale="zh" />)); });
    await screen.findByText("发生错误");
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
    expect(input).toHaveValue("unsaved draft");
    expect(screen.getByTestId("zone")).toHaveTextContent("Europe/Berlin");
    expect(screen.getByTestId("now")).toHaveTextContent(now.toISOString());
  });

  it.each(["en", "zh", "vi", "es"])("keeps the complete unchanged %s catalog available", async (locale) => {
    await act(async () => { render(<TestRoot locale={locale} />); });
    const expected = (await import(`../messages/${locale}.json`)).default;
    await screen.findByText(expected.common.error);
    expect(screen.getByTestId("locale")).toHaveTextContent(locale);
    expect(JSON.parse(screen.getByTestId("catalog").textContent ?? "null")).toEqual(expected);
  });

  it.each([
    ["en", "Translations are temporarily unavailable", "Retry"],
    ["zh", "翻译暂时不可用", "重试"],
    ["vi", "Bản dịch tạm thời không khả dụng", "Thử lại"],
    ["es", "Las traducciones no están disponibles temporalmente", "Reintentar"],
  ] as const)("shows a local recovery boundary in %s", (locale, title, retry) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      render(
        <CatalogErrorBoundary locale={locale}>
          <FailingCatalog locale={locale} />
        </CatalogErrorBoundary>
      );

      expect(screen.getByRole("alert")).toHaveTextContent(title);
      expect(screen.getByRole("button", { name: retry })).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("retries a failed catalog only after the explicit retry click", async () => {
    let failed = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function FlakyCatalog() {
      if (failed) {
        throw new CatalogLoadError("en", new Error("synthetic chunk failure"));
      }

      return <span data-testid="catalog-recovered">Catalog recovered</span>;
    }

    try {
      render(
        <CatalogErrorBoundary locale="en">
          <FlakyCatalog />
        </CatalogErrorBoundary>
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();

      failed = false;
      expect(screen.queryByTestId("catalog-recovered")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      });
      expect(screen.getByTestId("catalog-recovered")).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
