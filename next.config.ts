import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both packages read from their own on-disk layout (playwright-core's
  // browsers.json, @sparticuz/chromium's bundled binary under bin/) - letting
  // Next.js's bundler relocate/tree-shake them breaks that, so keep them external.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // playwright-core/@sparticuz/chromium need non-JS files at runtime that
  // Next.js's default file tracing doesn't pick up automatically.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/playwright-core/**", "./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
