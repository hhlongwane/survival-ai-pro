import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const viewport: Viewport = {
  themeColor: "#06B6D4",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Alpha Gap AI — Standalone Crypto Gap & Machine Learning App",
  description:
    "Installable Android App #2: Real-time cross-exchange crypto gap detection, Post-Only Maker profit compounding, and online ML model training.",
  manifest: "/apps/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alpha Gap AI",
  },
  icons: {
    icon: "/icons/alpha-512.png",
    apple: "/icons/alpha-512.png",
  },
};

export default function AlphaAppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
