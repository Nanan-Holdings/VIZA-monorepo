import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIZA - Visa Applications Simplified",
  description: "Manage your visa applications with ease",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}