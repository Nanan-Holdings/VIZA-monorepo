import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Best-effort origin ("https://host:port") from a possibly-empty env URL. */
function originFromEnv(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Baseline Content-Security-Policy for the portal (ARCH-HEADERS-01).
 *
 * Shipped as report-only on purpose: the App Router injects inline bootstrap
 * scripts/styles and the app talks to several third parties (Supabase, Stripe,
 * Google Maps/Places), so an over-tight enforced policy would break the app and
 * could block a concurrent deploy. Report-only surfaces violations without
 * enforcing; ops can promote it to `Content-Security-Policy` once the reported
 * set is confirmed. connect-src is derived from the configured backend origins.
 */
function buildContentSecurityPolicy(): string {
  const supabaseOrigin = originFromEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const agentBackendOrigin = originFromEnv(process.env.NEXT_PUBLIC_AGENT_BACKEND_URL);
  const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https:/, "wss:") : null;

  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseWs,
    agentBackendOrigin,
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://maps.googleapis.com",
    "https://places.googleapis.com",
    "https://api.stripe.com",
  ].filter(Boolean) as string[];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    // App Router hydration relies on inline scripts; dev additionally needs eval.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://js.stripe.com",
      "https://maps.googleapis.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "blob:"],
    "connect-src": Array.from(new Set(connectSrc)),
    "frame-src": [
      "'self'",
      "https://js.stripe.com",
      "https://checkout.stripe.com",
      "https://hooks.stripe.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "report-uri": ["/api/csp-report"],
    "report-to": ["csp-endpoint"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Camera + microphone are used by passport/photo capture and interview
    // practice, so allow them for our own origin; disable the rest by default.
    value: [
      "accelerometer=()",
      "camera=(self)",
      "microphone=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "payment=(self)",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
  { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicy() },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.1:3000",
    "localhost",
    "localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ],
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
        pathname: "/wiki/Special:FilePath/**",
      },
    ],
  },
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  outputFileTracingExcludes: {
    "*": ["./public/**", "./screenshots/**"],
  },
  async headers() {
    return [
      {
        // Apply the security baseline to every route.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return [
      // Travel imagery lives in Supabase Storage (bucket travel-images);
      // /travel/* URLs are preserved for code, DB rows, and cached clients.
      // afterFiles semantics: anything still in public/travel (e.g. the
      // fallback svg) is served locally and wins over this proxy.
      {
        source: "/travel/:path*",
        destination:
          "https://oyjxdzsoejraedqghndi.supabase.co/storage/v1/object/public/travel-images/:path*",
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
};

export default withNextIntl(nextConfig);
