import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Loom's Chrome extension hosts its permission check and camera bubble in
// extension-origin iframes. Keep this scoped to Loom's published extension ID.
const LOOM_EXTENSION_ORIGIN =
  "chrome-extension://liecbddmkiiihnedobmlmillhodjkdmb";

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
 * Enforced and mirrored in the reporting policy. The App Router injects inline
 * bootstrap scripts/styles and the app talks to several third parties
 * (Supabase, Stripe Identity, Google Maps/Places). Keep frame exceptions origin-scoped;
 * connect-src is derived from the configured backend origins.
 */
function buildContentSecurityPolicy(allowSameOriginFrame = false): string {
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
    "frame-ancestors": [allowSameOriginFrame ? "'self'" : "'none'"],
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
      LOOM_EXTENSION_ORIGIN,
      "https://js.stripe.com",
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
    // Preserve first-party capture and allow Loom's user-invoked recorder.
    // Browser camera/microphone permission is still required; other embedded
    // origins cannot receive media access through an iframe's allow attribute.
    value: [
      "accelerometer=()",
      `camera=(self "${LOOM_EXTENSION_ORIGIN}")`,
      `microphone=(self "${LOOM_EXTENSION_ORIGIN}")`,
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "payment=()",
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
      {
        // Only the data-free map shell can be framed, and only by this site.
        source: "/travel-map",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: buildContentSecurityPolicy(true) },
          { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicy(true) },
        ],
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
  // Preserve the current production build policy in this narrowly scoped
  // public-safety release. Type validation remains a separate release gate.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
