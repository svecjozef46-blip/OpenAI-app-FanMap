import type { NextConfig } from "next";

// Map engine (src/lib/mapEngine.ts): MapLibre unless "mapbox" is asked for.
// Set here so the value is always inlined into the build, even when the
// variable is missing, and the unused engine is dropped from the bundle.
const mapEngine = process.env.NEXT_PUBLIC_MAP_ENGINE === "mapbox" ? "mapbox" : "maplibre";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_MAP_ENGINE: mapEngine },
  // Map data and label glyphs (public/data, public/fonts) carry a hash of
  // their content in the name (scripts/build-countries.mjs), so a browser
  // may keep them for a year: a visitor downloads them once, not on every
  // page or visit.
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/data/:path*", headers: immutable },
      // Label glyphs: protocol buffers (as Mapbox serves them), so the CDN
      // knows the type instead of a generic binary download.
      { source: "/fonts/:path*", headers: [...immutable, { key: "Content-Type", value: "application/x-protobuf" }] },
    ];
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
