"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { Component, Suspense, use, type ReactNode } from "react";

// Keep the complete active catalog in a cacheable locale chunk, rather than
// serializing it through Flight on every page request. Cache only these four
// public imports; a stable promise also lets React retry suspended SSR/hydration.
const loaders = {
  en: () => import("@/messages/en.json"),
  zh: () => import("@/messages/zh.json"),
  vi: () => import("@/messages/vi.json"),
  es: () => import("@/messages/es.json"),
};
type CatalogLocale = keyof typeof loaders;
const catalogs: Partial<Record<CatalogLocale, Promise<AbstractIntlMessages>>> = {};

/** Keep load failures typed so this boundary does not hide descendant errors. */
export class CatalogLoadError extends Error {
  readonly locale: CatalogLocale;
  readonly cause: unknown;

  constructor(locale: CatalogLocale, cause: unknown) {
    super(`Unable to load the ${locale} translation catalog`);
    this.name = "CatalogLoadError";
    this.locale = locale;
    this.cause = cause;
  }
}

function isCatalogLoadError(error: unknown): error is CatalogLoadError {
  return error instanceof CatalogLoadError;
}

function loadCatalog(locale: CatalogLocale): Promise<AbstractIntlMessages> {
  return loaders[locale]().then(
    (module) =>
      // Existing catalogs also contain arrays consumed with t.raw(). Preserve
      // that JSON exactly, matching the server request-config message contract.
      module.default as unknown as AbstractIntlMessages,
    (cause) => {
      throw new CatalogLoadError(locale, cause);
    }
  );
}

function getCatalog(locale: CatalogLocale): Promise<AbstractIntlMessages> {
  // Keep rejected promises until an explicit retry so a failed chunk cannot
  // trigger an unbounded automatic import loop.
  return (catalogs[locale] ??= loadCatalog(locale));
}

function clearCatalog(locale: CatalogLocale): void {
  delete catalogs[locale];
}

const recoveryCopy = {
  en: {
    title: "Translations are temporarily unavailable",
    body: "Please retry to load this page.",
    retry: "Retry",
  },
  zh: {
    title: "翻译暂时不可用",
    body: "请重试以加载页面。",
    retry: "重试",
  },
  vi: {
    title: "Bản dịch tạm thời không khả dụng",
    body: "Vui lòng thử lại để tải trang.",
    retry: "Thử lại",
  },
  es: {
    title: "Las traducciones no están disponibles temporalmente",
    body: "Vuelve a intentarlo para cargar la página.",
    retry: "Reintentar",
  },
} satisfies Record<CatalogLocale, { title: string; body: string; retry: string }>;

type CatalogErrorBoundaryProps = {
  locale: CatalogLocale;
  children: ReactNode;
};

type CatalogErrorBoundaryState = {
  error: CatalogLoadError | null;
  resetLocale: CatalogLocale;
};

/**
 * Handles only translation chunk failures. Other render errors continue to
 * the app-level boundary, while a retry clears one failed locale entry.
 */
export class CatalogErrorBoundary extends Component<
  CatalogErrorBoundaryProps,
  CatalogErrorBoundaryState
> {
  state: CatalogErrorBoundaryState = {
    error: null,
    resetLocale: this.props.locale,
  };

  static getDerivedStateFromProps(
    props: CatalogErrorBoundaryProps,
    state: CatalogErrorBoundaryState
  ): Partial<CatalogErrorBoundaryState> | null {
    if (props.locale === state.resetLocale) {
      return null;
    }

    return { error: null, resetLocale: props.locale };
  }

  static getDerivedStateFromError(error: unknown): Partial<CatalogErrorBoundaryState> {
    if (!isCatalogLoadError(error)) {
      throw error;
    }

    return { error };
  }

  private readonly handleRetry = (): void => {
    clearCatalog(this.props.locale);
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const copy = recoveryCopy[this.props.locale];

      return (
        <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-lg font-semibold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={this.handleRetry}
          >
            {copy.retry}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function CatalogProvider({ locale, children }: { locale: CatalogLocale; children: ReactNode }) {
  const messages = use(getCatalog(locale));
  // Keep this component type stable across language changes, preserving form
  // state. Other Intl configuration is inherited from the outer server provider.
  return <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>;
}

export function LocaleMessagesProvider({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const selected = locale === "en" || locale === "vi" || locale === "es" ? locale : "zh";
  return (
    <CatalogErrorBoundary locale={selected}>
      <Suspense>
        <CatalogProvider locale={selected}>{children}</CatalogProvider>
      </Suspense>
    </CatalogErrorBoundary>
  );
}
