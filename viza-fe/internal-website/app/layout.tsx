import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { switzer, geist } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

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
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
