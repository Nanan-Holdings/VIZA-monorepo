import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { switzer, geist } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <RuntimeAbortErrorScript />
      </head>
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <RuntimeAbortErrorGuard />
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
