import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { switzer, geist } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { RuntimeAbortErrorGuard } from "@/components/runtime-abort-error-guard";
import { RuntimeAbortErrorScript } from "@/components/runtime-abort-error-script";
import { ANALYTICS_LINKER_DOMAINS, CONSENT_COOKIE, hasAnalyticsConsent } from "@/lib/analytics/google";

// Must be the same GA4 property as the marketing site, or cross-domain linking
// cannot stitch a viza.it.com visit to the app.viza.it.com purchase.
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

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

  // Opt-in only: the tag is never loaded until the applicant accepts cookies,
  // matching the gate the PostHog sink applies in `lib/analytics/events.ts`.
  const cookieStore = await cookies();
  const analyticsEnabled =
    Boolean(gaMeasurementId) && hasAnalyticsConsent(cookieStore.get(CONSENT_COOKIE)?.value);

  return (
    <html lang={locale}>
      <head>
        <Script id="redact-beta-url" strategy="beforeInteractive">
          {`
            (function () {
              function sanitizedLocation() {
                var url = new URL(window.location.href);
                url.searchParams.delete('beta');
                url.searchParams.delete('betaToken');
                return url.toString();
              }
              var cleanLocation = sanitizedLocation();
              window.__vizaAnalyticsPageLocation = sanitizedLocation;
              if (cleanLocation !== window.location.href) {
                window.history.replaceState(window.history.state, '', cleanLocation);
              }
            })();
          `}
        </Script>
        <RuntimeAbortErrorScript />
        {analyticsEnabled ? (
          <>
            <link rel="preconnect" href="https://www.googletagmanager.com" />
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
                window.gtag('js', new Date());
                window.gtag('config', '${gaMeasurementId}', {
                  linker: { domains: ${JSON.stringify(ANALYTICS_LINKER_DOMAINS)} },
                  page_location: window.__vizaAnalyticsPageLocation()
                });
              `}
            </Script>
          </>
        ) : null}
      </head>
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <RuntimeAbortErrorGuard />
          {children}
          <Toaster position="top-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
