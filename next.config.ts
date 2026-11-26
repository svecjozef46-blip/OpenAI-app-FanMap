import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Privacy (docs/privacy.md): when a visitor follows a link to another
  // site, that site learns only our domain, never the page or match they
  // came from. It is the browsers' default too; set explicitly so it can't
  // change under us.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
