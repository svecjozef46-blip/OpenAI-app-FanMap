import type { MetadataRoute } from "next";

// Web app manifest: lets people "install" the site to their home screen and
// open it full-screen like an app (docs/business-case.md: PWA instead of an
// App Store app). Next.js serves this at /manifest.webmanifest and adds the
// <link rel="manifest"> tag to every page by itself — nothing to add in
// layout.tsx. Icons come from scripts/generate-icons.py.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Global Fan Map",
    short_name: "Global Fan Map",
    description: "Show which team you support and see which countries stand with you.",
    start_url: "/",
    display: "standalone",
    // Shown while the installed app starts, and around it on Android. Dark
    // to match the icon; inside the app, light/dark mode still follows the
    // visitor's own setting.
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
