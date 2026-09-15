import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=(), interest-cohort=()",
  },
  {
    // Observe the production dependency set before promoting this to an
    // enforcing CSP; blocking an analytics or checkout handoff at launch is
    // worse than collecting a short report-only baseline first.
    key: "Content-Security-Policy",
    // AdSense needs its whole serving chain allowlisted here or the ad code is
    // blocked outright: the loader and creatives come from googlesyndication /
    // googleadservices / doubleclick, ad slots render in cross-origin iframes
    // (frame-src), and the tag beacons to adtrafficquality.google for invalid
    // traffic detection (connect-src). img-src already allows https:.
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://app.viza.it.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://app.viza.it.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google",
      "frame-src 'self' https://www.googletagmanager.com https://*.googlesyndication.com https://*.doubleclick.net https://www.google.com https://*.adtrafficquality.google",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; "),
  },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
