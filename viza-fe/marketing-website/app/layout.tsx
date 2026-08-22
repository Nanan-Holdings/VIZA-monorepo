import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { switzer, geist } from "./fonts";

const gtmId = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-PK9WNC3D";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");
const portalUrl = (process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://app.viza.it.com").replace(/\/$/, "");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "VIZA",
  url: siteUrl,
  logo: `${siteUrl}/assets/viza-logo-black.svg`,
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+65-8410-6368",
      contactType: "customer support",
      areaServed: ["SG", "CN"],
      availableLanguage: ["English", "Chinese"],
    },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "VIZA",
  url: siteUrl,
  publisher: { "@id": `${siteUrl}/#organization` },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VIZA — AI-powered visa applications",
    template: "%s · VIZA",
  },
  description:
    "VIZA is an AI-powered visa agency. Apply for tourist, business, work, student, and long-term visas with expert human oversight.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "VIZA",
    title: "VIZA — AI-powered visa applications",
    description:
      "Apply for tourist, business, work, student, and long-term visas with AI guidance and expert human oversight.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href={portalUrl} />
        <Script id="data-layer-init" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];`}
        </Script>
        {gtmId ? (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
        ) : null}
        <Script id="marketing-click-tracking" strategy="afterInteractive">
          {`
            (function () {
              if (window.__vizaMarketingClickTracking) return;
              window.__vizaMarketingClickTracking = true;
              function push(event, params) {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push(Object.assign({
                  event: event,
                  page_path: window.location.pathname,
                  page_location: window.location.href
                }, params || {}));
              }
              document.addEventListener('click', function (event) {
                var target = event.target;
                if (!target || !target.closest) return;
                var anchor = target.closest('a');
                if (!anchor || !anchor.href) return;
                try {
                  var url = new URL(anchor.href);
                  var label = anchor.getAttribute('aria-label') || (anchor.textContent || '').trim();
                  var country = url.searchParams.get('country') || anchor.dataset.country || undefined;
                  if (url.hostname === 'app.viza.it.com') {
                    if (url.pathname.indexOf('/checkout/') === 0) {
                      push('checkout_start', {
                        destination_country: country,
                        payment_method: anchor.dataset.paymentMethod || url.pathname.split('/').pop()
                      });
                    } else {
                      push('portal_click', { link_text: label, destination_path: url.pathname });
                    }
                    return;
                  }
                  if (url.pathname === '/apply' || /\\/apply$/.test(url.pathname)) {
                    push('apply_start', { destination_country: country, link_text: label });
                    return;
                  }
                  if (url.protocol === 'tel:' || url.protocol === 'mailto:') {
                    push('contact_channel_click', {
                      channel: url.protocol.replace(':', ''),
                      link_text: label
                    });
                  }
                } catch (err) {}
              }, true);
            })();
          `}
        </Script>
      </head>
      <body className={`${switzer.variable} ${geist.variable} font-sans antialiased`}>
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        {children}
      </body>
    </html>
  );
}
