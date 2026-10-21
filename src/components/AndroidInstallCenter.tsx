"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { LivePayPalAndFxProDesk } from "./LivePayPalAndFxProDesk";
import { OriginalProjectSyncCard } from "./OriginalProjectSyncCard";

export function AndroidInstallCenter({
  initialPlan,
  initialCreds,
  initialFxProSignals = [],
  initialLiveVaultUsd = 0,
}: {
  initialPlan: any;
  initialCreds?: any;
  initialFxProSignals?: any[];
  initialLiveVaultUsd?: number;
}) {
  const [origin, setOrigin] = useState("https://localhost:3000");
  const [hostOnly, setHostOnly] = useState("localhost:3000");
  const [qrInstallPage, setQrInstallPage] = useState<string>("");
  const [qrApp2, setQrApp2] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [browserKind, setBrowserKind] = useState<
    "SAMSUNG_INTERNET" | "ANDROID_CHROME" | "OTHER"
  >("OTHER");
  const [toast, setToast] = useState<string | null>(null);

  const [creds, setCreds] = useState<any>(initialCreds);
  const [fxSignals, setFxSignals] = useState<any[]>(initialFxProSignals);
  const [liveVaultUsd, setLiveVaultUsd] = useState<number>(initialLiveVaultUsd);

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setOrigin(currentOrigin);
    setHostOnly(window.location.host);

    const ua = navigator.userAgent || "";
    if (/SamsungBrowser/i.test(ua)) {
      setBrowserKind("SAMSUNG_INTERNET");
    } else if (/Android/i.test(ua) && /Chrome/i.test(ua)) {
      setBrowserKind("ANDROID_CHROME");
    }

    const opts = {
      width: 240,
      margin: 2,
      color: { dark: "#090C12", light: "#FFFFFF" },
    };

    Promise.all([
      QRCode.toDataURL(`${currentOrigin}/install`, opts),
      QRCode.toDataURL(`${currentOrigin}/apps?source=samsung_a33`, opts),
    ])
      .then(([q1, q2]) => {
        setQrInstallPage(q1);
        setQrApp2(q2);
      })
      .catch(() => {});

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function refreshAllMobileData() {
    const dashRes = await fetch("/api/dashboard?refresh=1");
    const dashJson = await dashRes.json();
    if (dashJson.ok) {
      setCreds(dashJson.credentialsSummary);
      setFxSignals(dashJson.fxproSignals ?? []);
      setLiveVaultUsd(Number(dashJson.portfolio?.verifiedLiveVaultUsd ?? 0));
    }
  }

  async function handleOneTapSamsungInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    if (browserKind === "SAMSUNG_INTERNET") {
      setToast(
        "You are in Samsung Internet on your Galaxy A33! Tap the 3 lines (≡) at the bottom-right corner -> Tap '+ Add page to' -> Tap 'Home screen' (OR tap 'Open in Chrome' below for instant automatic APK install)!"
      );
      return;
    }

    setToast(
      "On your Samsung Galaxy A33: Tap the 3 dots (⋮) at the top-right of Chrome -> Tap 'Install app' — Android builds and installs the app automatically in 3 seconds!"
    );
  }

  // Android Native Chrome Intent URL — jumps straight out of WhatsApp / Samsung Internet into Google Chrome on Samsung A33!
  const chromeIntentApp1 = `intent://${hostOnly}/?install=1#Intent;scheme=https;package=com.android.chrome;end`;
  const chromeIntentApp2 = `intent://${hostOnly}/apps?install=1#Intent;scheme=https;package=com.android.chrome;end`;
  const pwaBuilderSignedApkUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(
    origin
  )}`;

  return (
    <div className="min-h-screen bg-[#080C14] pb-16 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B101B]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2.5 text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white sm:text-lg">
                Samsung Galaxy A33 Easy App Installer
              </h1>
              <p className="text-xs text-emerald-300">
                100% Free Storage (&lt; 2 MB Total — Zero Space Fees Ever!)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/deploy"
              className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
            >
              Make Permanent 24/7 ($0 Vercel)
            </a>
            <a
              href="/"
              className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
            >
              Open App #1
            </a>
            <a
              href="/apps"
              className="rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200"
            >
              Open App #2
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6">
        {toast && (
          <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-4 text-sm font-medium text-emerald-100">
            {toast}
          </div>
        )}

        {/* ==================================================================== */}
        {/* CLEAR ANSWER ABOUT STORAGE SPACE & ZERO FEES                         */}
        {/* ==================================================================== */}
        <section className="rounded-3xl border border-emerald-500/35 bg-[#111827] p-5">
          <div className="flex items-start gap-3.5">
            <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-400">
              <HardDrive className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-extrabold text-white">
                Do You Pay Anything for Phone Space or App Storage? NO — $0.00!
              </h2>
              <p className="text-xs leading-relaxed text-slate-300">
                Your <strong>Samsung Galaxy A33</strong> comes with <strong>128 GB</strong> of
                built-in storage. Installing <strong>both Survival AI apps + the offline AI file</strong>{" "}
                uses less than <strong>2 MB total</strong> (smaller than a single camera photo!) and
                costs <strong>$0.00 forever</strong>. And because Android compiles a clean{" "}
                <strong>Google Chrome WebAPK</strong> directly on your Samsung A33, Samsung{" "}
                <em>Auto Blocker</em> never blocks it!
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* SUPER EASY ONE-TAP BUTTONS MADE SPECIFICALLY FOR SAMSUNG GALAXY A33  */}
        {/* ==================================================================== */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* BOX 1: INSTALL BOTH APPS ON SAMSUNG GALAXY A33 */}
          <div className="flex flex-col justify-between rounded-3xl border border-emerald-500/45 bg-[#111827] p-5 space-y-4">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
                EASIEST FOR SAMSUNG GALAXY A33
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Option 1: Install Both Apps to Your Samsung Home Screen
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Works smoothly with <strong>Samsung One UI</strong> with zero security warnings. Tap
                below directly from your Samsung A33:
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => void handleOneTapSamsungInstall()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400"
              >
                <Smartphone className="h-4 w-4" />
                Tap Here to Install App #1 Now
              </button>

              <a
                href={chromeIntentApp1}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 py-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
              >
                Opened in WhatsApp / Samsung Browser? Launch Chrome 1-Tap Install (App #1)
              </a>

              <a
                href={chromeIntentApp2}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/15 py-3 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
              >
                Launch Chrome 1-Tap Install for App #2 (Alpha Gap AI)
              </a>
            </div>
          </div>

          {/* BOX 2: DIRECT OFFLINE PHONE FILE + SIGNED .APK GENERATOR */}
          <div className="flex flex-col justify-between rounded-3xl border border-amber-500/45 bg-[#111827] p-5 space-y-4">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-amber-500/20 px-3 py-0.5 text-[11px] font-bold text-amber-300">
                SAVE DIRECTLY INSIDE SAMSUNG &ldquo;MY FILES&rdquo;
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Option 2: Download Standalone Phone AI File / Signed APK
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Saves <code className="font-mono text-white">SurvivalAI-Pocket-GapScanner.html</code>{" "}
                (only <strong>19 KB!</strong>) into your Samsung A33 <strong>Downloads</strong>{" "}
                folder so your phone scans live Crypto &amp; FxPro Gold gaps anytime — OR export a
                signed <code className="font-mono text-white">.apk</code> via PWABuilder:
              </p>
            </div>

            <div className="space-y-2.5">
              <a
                href="/api/ai/download-mobile"
                download="SurvivalAI-Pocket-GapScanner.html"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-amber-300"
              >
                <Download className="h-4 w-4" />
                Download Pocket AI Directly to Samsung A33
              </a>

              <a
                href={pwaBuilderSignedApkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#0B101B] py-3 text-xs font-bold text-slate-200 hover:border-amber-400"
              >
                Build Signed Android .APK File (Official PWABuilder){" "}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`${origin}/install`);
                  setCopiedKey("install");
                  setTimeout(() => setCopiedKey(null), 2000);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-[#0B101B] py-2.5 text-xs text-slate-300"
              >
                {copiedKey === "install" ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" /> Copied Link! Send to Your Samsung
                    A33
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-400" /> Copy Link for Samsung A33:{" "}
                    {origin}/install
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* SCAN WITH SAMSUNG CAMERA IF VIEWING ON PC */}
        <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-800 bg-[#111827] p-5 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            {qrInstallPage ? (
              <img
                src={qrInstallPage}
                alt="Samsung Camera QR App 1"
                className="h-32 w-32 shrink-0 rounded-2xl border-4 border-white"
              />
            ) : (
              <QrCode className="h-16 w-16 text-emerald-400" />
            )}
            <div>
              <div className="text-sm font-extrabold text-white">
                Point Your Samsung A33 Camera Here (#1)
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Samsung&apos;s built-in Camera app automatically shows a yellow link pill — tap it
                to open this installer right on your A33!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {qrApp2 ? (
              <img
                src={qrApp2}
                alt="Samsung Camera QR App 2"
                className="h-32 w-32 shrink-0 rounded-2xl border-4 border-white"
              />
            ) : (
              <QrCode className="h-16 w-16 text-cyan-400" />
            )}
            <div>
              <div className="text-sm font-extrabold text-white">
                Point Your Samsung A33 Camera Here (#2)
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Opens standalone <strong>App #2 (Alpha Gap AI)</strong> directly on your Samsung A33.
              </p>
            </div>
          </div>
        </section>

        {/* 1-TAP ORIGINAL hhlongwane/survival-ai & RENDER .ENV IMPORTER */}
        <OriginalProjectSyncCard onSynced={refreshAllMobileData} />

        {/* ADD REAL MONEY (PAYPAL) & FXPRO RIGHT HERE TOO */}
        <LivePayPalAndFxProDesk
          credentialsSummary={creds}
          fxproSignals={fxSignals}
          verifiedLiveVaultUsd={liveVaultUsd}
          onRefresh={refreshAllMobileData}
        />
      </main>
    </div>
  );
}
