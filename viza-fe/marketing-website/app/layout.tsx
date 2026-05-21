import "./globals.css";
import type { Metadata } from "next";
import { switzer, geist } from "./fonts";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.com"),
  title: {
    default: "VIZA — AI-powered visa applications",
    template: "%s · VIZA",
  },
  description:
    "VIZA is an AI-powered visa agency. Apply for tourist, business, work, student, and long-term visas with expert human oversight.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
