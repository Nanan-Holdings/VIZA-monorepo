import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

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
  outputFileTracingIncludes: {
    "/api/applications/[id]/kr-annex17-pdf": ["./lib/korea-c39/templates/**"],
  },
  outputFileTracingExcludes: {
    "*": ["./public/**", "./screenshots/**"],
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
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
