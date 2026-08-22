import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n";
import { CatalogueProvider } from "@/components/CatalogueProvider";
import { getPublishedCatalogue } from "@/lib/public-catalogue";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const [messages, catalogue] = await Promise.all([getMessages(), getPublishedCatalogue()]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CatalogueProvider entries={catalogue}>{children}</CatalogueProvider>
    </NextIntlClientProvider>
  );
}
