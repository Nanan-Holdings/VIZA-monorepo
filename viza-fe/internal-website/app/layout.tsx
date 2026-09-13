import type { Metadata } from "next";
import "./globals.css";
import { LocalizedToaster } from "@/components/localized-toaster";
import { switzer, geist } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { LocaleMessagesProvider } from "@/i18n/client-provider";
import { RuntimeAbortErrorGuard } from "@/components/runtime-abort-error-guard";
import { RuntimeAbortErrorScript } from "@/components/runtime-abort-error-script";

export const metadata: Metadata = {
  title: "VIZA Portal",
  description: "Visa Application Portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        <RuntimeAbortErrorScript />
      </head>
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={null}>
          <LocaleMessagesProvider locale={locale}>
            <RuntimeAbortErrorGuard />
            {children}
            <LocalizedToaster />
          </LocaleMessagesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
