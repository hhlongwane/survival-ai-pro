import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#10B981",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Survival AI — Dual-App Autonomous Quant, ML Learning & Arbitrage Suite",
  description:
    "Installable Dual-App Suite: Survival AI Core Desk + Alpha Compounder ML Lab with live multi-venue crypto arbitrage, online gradient descent & bandit learning, walk-forward backtesting, fail-closed safety gates, and read-only Original Project Bridge.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Survival AI",
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-512.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090C12] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
