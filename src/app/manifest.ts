import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=survival-core",
    name: "Survival AI — Core Command & Vault",
    short_name: "Survival AI",
    description:
      "App #1: Full Quantitative Command Desk, Capital Vault, 12 Safety Gates, Backtester, PayPal/cTrader/MT5 & Shopify Hub",
    start_url: "/?source=android_pwa_core",
    scope: "/",
    display: "standalone",
    background_color: "#090C12",
    theme_color: "#10B981",
    orientation: "portrait-primary",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scan Live Crypto Gaps",
        short_name: "Gap Radar",
        description: "Open live multi-venue crypto arbitrage gap detector",
        url: "/install",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Open App #2: Alpha Gap AI",
        short_name: "Alpha AI",
        description: "Launch High-Profit Maker Compounder & Online ML Studio",
        url: "/apps",
        icons: [{ src: "/icons/alpha-192.png", sizes: "192x192" }],
      },
    ],
  };
}
