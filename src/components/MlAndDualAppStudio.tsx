"use client";

import React, { useEffect, useState } from "react";
import {
  AppWindow,
  Brain,
  CheckCircle2,
  Download,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  Lock,
  Play,
  Radio,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { LivePayPalAndFxProDesk } from "./LivePayPalAndFxProDesk";

interface MlAndDualAppStudioProps {
  mlStatus: any;
  profitPlan: any;
  credentialsSummary?: any;
  fxproSignals?: any[];
  verifiedLiveVaultUsd?: number;
  onRefreshParent: () => Promise<void>;
  standaloneMode?: boolean;
}

export function MlAndDualAppStudio({
  mlStatus,
  profitPlan,
  credentialsSummary,
  fxproSignals = [],
  verifiedLiveVaultUsd = 0,
  onRefreshParent,
  standaloneMode = false,
}: MlAndDualAppStudioProps) {
  const [localMl, setLocalMl] = useState<any>(mlStatus);
  const [localPlan, setLocalPlan] = useState<any>(profitPlan);
  const [selectedModel, setSelectedModel] = useState<"ALPHA_COMPOUNDER_ML" | "SURVIVAL_CORE_ML">(
    "ALPHA_COMPOUNDER_ML"
  );
  const [epochs, setEpochs] = useState(16);
  const [continuousLearn, setContinuousLearn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Dual-Project Bridge state
  const [bridgeData, setBridgeData] = useState<any>(null);
  const [originalUrlInput, setOriginalUrlInput] = useState("");

  // Native PWA Install Prompt capture
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    setLocalMl(mlStatus);
  }, [mlStatus]);

  useEffect(() => {
    setLocalPlan(profitPlan);
  }, [profitPlan]);

  useEffect(() => {
    // Register PWA Service Worker cleanly
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Load read-only bridge status
    fetch("/api/projects/bridge")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setBridgeData(j);
          if (j.originalAppProbe?.url) setOriginalUrlInput(j.originalAppProbe.url);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstallPwa() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstallHelp((v) => !v);
    }
  }

  async function handleTrainModel() {
    setBusy(`Training ${selectedModel} (${epochs} Gradient Descent Epochs + LinUCB Bandit)...`);
    try {
      const res = await fetch("/api/ml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelKey: selectedModel, epochs }),
      });
      const json = await res.json();
      if (json.ok) {
        const refreshed = await fetch("/api/ml").then((r) => r.json());
        if (refreshed.ok) {
          setLocalMl({
            models: refreshed.models,
            recentTrainingRuns: refreshed.recentTrainingRuns,
          });
          setLocalPlan(refreshed.profitPlan);
        }
        setStatusMsg(json.trainingRun.notes);
        await onRefreshParent();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDeployAndCompound() {
    setBusy(
      "Deploying Quarter-Kelly Maker Arbitrage Portfolio, accruing 24h carry, harvesting profits & retraining ML..."
    );
    try {
      const res = await fetch("/api/ml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DEPLOY_AND_COMPOUND", simulateHours: 24 }),
      });
      const json = await res.json();
      if (json.ok) {
        const refreshed = await fetch("/api/ml").then((r) => r.json());
        if (refreshed.ok) {
          setLocalMl({
            models: refreshed.models,
            recentTrainingRuns: refreshed.recentTrainingRuns,
          });
          setLocalPlan(refreshed.profitPlan);
        }
        setStatusMsg(
          `Portfolio Compounded: Opened ${json.compoundResult.deployedCount} hedged positions, harvested ${json.compoundResult.harvestedCount} profitable positions (+$${json.compoundResult.harvestedRealizedUsd.toFixed(
            2
          )} realized into Paper Vault), and evolved ALPHA_COMPOUNDER_ML to Gen v${json.mlLearn.model.generation}!`
        );
        await onRefreshParent();
      }
    } finally {
      setBusy(null);
    }
  }

  // Continuous autonomous learning + compounding loop when enabled
  useEffect(() => {
    if (!continuousLearn) return;
    const timer = setInterval(() => {
      void handleDeployAndCompound();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousLearn]);

  async function saveOriginalReadOnlyBridge(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Probing Original App URL in strictly Read-Only GET mode...");
    try {
      const res = await fetch("/api/projects/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: originalUrlInput }),
      });
      const json = await res.json();
      setBridgeData(json);
    } finally {
      setBusy(null);
    }
  }

  const models: any[] = localMl?.models ?? [];
  const activeModelObj =
    models.find((m) => m.modelKey === selectedModel) ?? models[0] ?? null;
  const recentRuns: any[] = localMl?.recentTrainingRuns ?? [];
  const latestRunForSelected =
    recentRuns.find((r) => r.modelKey === selectedModel) ?? recentRuns[0] ?? null;
  const lossCurve: Array<{ epoch: number; trainLoss: number; valLoss: number }> =
    latestRunForSelected?.lossCurveJson ?? [];

  return (
    <div className="space-y-6">
      {(busy || statusMsg) && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {busy || statusMsg}
        </div>
      )}

      {/* LIVE PAYPAL REAL-MONEY GATEWAY + FXPRO AUTONOMOUS BROKER AI */}
      <LivePayPalAndFxProDesk
        credentialsSummary={credentialsSummary}
        fxproSignals={fxproSignals}
        verifiedLiveVaultUsd={verifiedLiveVaultUsd}
        onRefresh={onRefreshParent}
      />

      {/* ======================================================================== */}
      {/* 1. DUAL-APP LAUNCHER & PROTECTED ORIGINAL PROJECT ACCESS HUB             */}
      {/* ======================================================================== */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
              <AppWindow className="h-3.5 w-3.5" /> DUAL-PROJECT & INSTALLABLE APP LAUNCHER
            </span>
            <h2 className="mt-1.5 text-base font-bold text-white">
              Access Both Projects & Install Standalone Desktop / Mobile Apps
            </h2>
            <p className="text-xs text-slate-400">
              Install directly to macOS, Windows, iOS, or Android as native standalone apps — while
              monitoring your protected original repository (`hhlongwane/survival-ai`) safely in
              read-only mode.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a
              href="/install"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" />
              Android QR Installer & Download AI
            </a>
            <a
              href="/api/ai/download-mobile"
              download="SurvivalAI-Pocket-GapScanner.html"
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
            >
              <Download className="h-4 w-4 text-amber-300" />
              Download Pocket AI (.html)
            </a>
            {!standaloneMode ? (
              <a
                href="/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25"
              >
                Open App #2 in Dedicated Window <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <a
                href="/"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:border-emerald-400"
              >
                Switch to App #1 (Core Command Desk) <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {showInstallHelp && (
          <div className="mt-4 rounded-xl border border-cyan-500/35 bg-[#0B0F19] p-4 text-xs text-slate-200">
            <div className="font-semibold text-cyan-300">
              How to Open Both Apps Directly on Your Phone or Computer:
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>
                <strong>Chrome / Edge / Brave (Windows, Mac, Android):</strong> Click the{" "}
                <span className="font-mono text-white">Install Survival AI</span> icon on the right
                side of your browser address bar (or Menu {"->"} <em>Install App</em>). Both{" "}
                <strong>App 1: Survival Core</strong> and <strong>App 2: Alpha Lab (`/apps`)</strong>{" "}
                appear as native app shortcuts!
              </li>
              <li>
                <strong>iPhone / iPad (Safari):</strong> Tap <strong>Share</strong> {"->"}{" "}
                <strong>Add to Home Screen</strong> — launches fullscreen with custom icon and zero
                browser bars.
              </li>
              <li>
                <strong>Accessing Original `hhlongwane/survival-ai`:</strong> Your original GitHub
                repository is private & protected on GitHub (`https://github.com/hhlongwane/survival-ai`).
                Paste its live Render URL below to monitor & launch both apps side-by-side!
              </li>
            </ul>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* CARD 1: RECREATION CORE APP */}
          <div className="rounded-xl border border-emerald-500/35 bg-[#0B0F19] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-emerald-400">
                APP #1 • SURVIVAL AI RECREATION
              </span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                LIVE AT /
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-300">
              Complete independent fullstack platform: 97 live crypto markets, PR #15 multi-leg
              arbitrage engine, Capital Vault, 12 Safety Gates, Backtester, PayPal/cTrader/MT5 &
              Shopify Hub.
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
              <span className="font-mono text-slate-400">ML Brain: SURVIVAL_CORE_ML</span>
              <a href="/" className="font-semibold text-emerald-300 hover:underline">
                Open Core Desk {"->"}
              </a>
            </div>
          </div>

          {/* CARD 2: ALPHA COMPOUNDER APP */}
          <div className="rounded-xl border border-cyan-500/35 bg-[#0B0F19] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-cyan-400">
                APP #2 • ALPHA COMPOUNDER LAB
              </span>
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                LIVE AT /apps
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-300">
              High-velocity Post-Only Maker Execution + Quarter-Kelly Portfolio Compounder +
              Continuous Online Gradient Descent & Multi-Arm Bandit Learning Engine.
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
              <span className="font-mono text-slate-400">ML Brain: ALPHA_COMPOUNDER_ML</span>
              <a href="/apps" className="font-semibold text-cyan-300 hover:underline">
                Launch Alpha App {"->"}
              </a>
            </div>
          </div>

          {/* CARD 3: PROTECTED ORIGINAL PROJECT BRIDGE */}
          <div className="rounded-xl border border-amber-500/35 bg-[#0B0F19] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-mono font-semibold text-amber-300">
                <Lock className="h-3.5 w-3.5" /> ORIGINAL PROJECT BRIDGE
              </span>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                READ-ONLY SAFE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              Repo: <code className="font-mono text-white">hhlongwane/survival-ai</code> (100%
              untouched). Link your live Render URL to launch & ping health side-by-side:
            </p>
            <form onSubmit={saveOriginalReadOnlyBridge} className="mt-2 flex gap-1.5">
              <input
                type="url"
                value={originalUrlInput}
                onChange={(e) => setOriginalUrlInput(e.target.value)}
                placeholder="https://your-original-app.onrender.com"
                className="w-full rounded border border-slate-700 bg-[#101623] px-2.5 py-1 font-mono text-[11px] text-white"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
              >
                Link & Check
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {bridgeData?.originalAppProbe?.configured
                  ? bridgeData.originalAppProbe.reachable
                    ? `Online (HTTP ${bridgeData.originalAppProbe.httpStatus})`
                    : "Configured (Asleep / Unreachable)"
                  : "Awaiting Render URL"}
              </span>
              <div className="flex gap-2.5">
                {bridgeData?.originalAppProbe?.url && (
                  <a
                    href={bridgeData.originalAppProbe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-300 hover:underline"
                  >
                    Open Live Render {"->"}
                  </a>
                )}
                <a
                  href="https://github.com/hhlongwane/survival-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <GitBranch className="h-3 w-3" /> GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* 2. HIGH-PROFIT MAKER-LIMIT & QUARTER-KELLY PORTFOLIO OPTIMIZER           */}
      {/* ======================================================================== */}
      {localPlan && (
        <div className="rounded-2xl border border-emerald-500/35 bg-[#101623] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Smart Maker-Limit & Quarter-Kelly Multi-Market Profit Compounder
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Captures real live cross-venue funding & basis gaps using Post-Only Maker Limit
                execution (~60% lower 4-leg fee drag than market takers) while enforcing all 12
                risk safety gates.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => void handleDeployAndCompound()}
                disabled={Boolean(busy)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Deploy Optimal Portfolio & Compound +24h Carry
              </button>

              <button
                onClick={() => setContinuousLearn((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                  continuousLearn
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                <Radio className={`h-3.5 w-3.5 ${continuousLearn ? "animate-ping text-emerald-400" : ""}`} />
                {continuousLearn ? "Auto-Learn & Compound ON (15s)" : "Auto-Learn & Compound OFF"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3.5 font-mono sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5">
              <div className="font-sans text-[11px] text-slate-400">
                Weighted Portfolio Net APR
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-400">
                +{localPlan.weightedPortfolioNetAprPct}% APR
              </div>
              <div className="font-sans text-[10px] text-slate-500">
                Net of maker fees, spreads & funding decay
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5">
              <div className="font-sans text-[11px] text-slate-400">
                Active Hedged Notional / Margin
              </div>
              <div className="mt-1 text-xl font-bold text-white">
                ${localPlan.totalActiveNotionalUsd.toLocaleString()}
              </div>
              <div className="font-sans text-[10px] text-cyan-300">
                Locked Collateral: ${localPlan.totalLockedMarginUsd.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5">
              <div className="font-sans text-[11px] text-slate-400">
                Est. 30-Day Compounded Paper Yield
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-300">
                +${localPlan.projectedMonthlyCompoundedPaperProfitUsd.toLocaleString()}
              </div>
              <div className="font-sans text-[10px] text-slate-500">
                On current vault allocation (if spreads persist)
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5">
              <div className="font-sans text-[11px] text-slate-400">
                Est. 12-Month Compounded Paper Yield
              </div>
              <div className="mt-1 text-xl font-bold text-cyan-300">
                +${localPlan.projectedAnnualCompoundedPaperProfitUsd.toLocaleString()}
              </div>
              <div className="font-sans text-[10px] text-amber-300/90">
                Simulated Paper Yield — Never Guaranteed
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2">Asset</th>
                  <th className="py-2">Maker Route (Long / Short)</th>
                  <th className="py-2 text-right">Quarter-Kelly Size</th>
                  <th className="py-2 text-right">Naive Taker APR</th>
                  <th className="py-2 text-right">Maker-Optimized Net APR</th>
                  <th className="py-2 text-right">ML Predicted Score</th>
                  <th className="py-2 text-right">Est. 96h Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {(localPlan.opportunities ?? []).map((opp: any) => (
                  <tr key={opp.symbol} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-sans font-bold text-white">{opp.symbol}</td>
                    <td className="py-2.5 text-slate-300">
                      <span className="text-emerald-300">{opp.longVenue}</span> {"->"}{" "}
                      <span className="text-cyan-300">{opp.shortVenue}</span>
                    </td>
                    <td className="py-2.5 text-right text-white">
                      ${opp.recommendedNotionalUsd.toLocaleString()} ({opp.kellyFractionPct}%)
                    </td>
                    <td className="py-2.5 text-right text-slate-400">
                      {opp.standardTakerNetAprPct}%
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">
                      +{opp.makerOptimizedNetAprPct}%
                    </td>
                    <td className="py-2.5 text-right text-cyan-300">
                      +{opp.mlPredictedScoreBps} bps
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-300">
                      +${opp.expected96hNetProfitUsd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* 3. TRUE ONLINE MACHINE LEARNING STUDIO (WEIGHTS, LOSS CURVE & BANDIT)    */}
      {/* ======================================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Online Gradient Descent & Walk-Forward Neural/Ridge Trainer
                </h3>
                <p className="text-xs text-slate-400">
                  Learns feature weights from real hourly candles + live spreads + closed trades
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 font-mono text-xs text-white"
              >
                <option value="ALPHA_COMPOUNDER_ML">ALPHA_COMPOUNDER_ML (App 2)</option>
                <option value="SURVIVAL_CORE_ML">SURVIVAL_CORE_ML (App 1)</option>
              </select>
              <button
                onClick={() => void handleTrainModel()}
                disabled={Boolean(busy)}
                className="flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Train {epochs} Epochs
              </button>
            </div>
          </div>

          {activeModelObj && (
            <>
              <div className="grid grid-cols-4 gap-2.5 font-mono text-xs">
                <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-2.5">
                  <div className="font-sans text-[10px] text-slate-400">Generation</div>
                  <div className="mt-0.5 text-sm font-bold text-cyan-300">
                    Gen v{activeModelObj.generation}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-2.5">
                  <div className="font-sans text-[10px] text-slate-400">Samples Learned</div>
                  <div className="mt-0.5 text-sm font-bold text-white">
                    {activeModelObj.trainSamplesCount.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-2.5">
                  <div className="font-sans text-[10px] text-slate-400">OOS Hit Rate</div>
                  <div className="mt-0.5 text-sm font-bold text-emerald-400">
                    {activeModelObj.directionalAccuracyPct}%
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F19] p-2.5">
                  <div className="font-sans text-[10px] text-slate-400">Val MSE Loss</div>
                  <div className="mt-0.5 text-sm font-bold text-amber-300">
                    {Number(activeModelObj.valMseLoss).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* LEARNED FEATURE WEIGHT BAR VISUALIZER */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5 text-xs">
                <div className="font-semibold text-white">
                  Learned Quantitative Feature Weights (Persisted in PostgreSQL `ml_models`):
                </div>
                {(activeModelObj.featureNamesJson as string[]).map((fname, idx) => {
                  const w = Number((activeModelObj.weightsJson as number[])[idx] ?? 0);
                  const pct = Math.min(100, Math.abs(w) * 14);
                  return (
                    <div key={fname} className="space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-slate-300">{fname}</span>
                        <span className={w >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {w >= 0 ? "+" : ""}
                          {w.toFixed(4)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            w >= 0 ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* LINUCB CONTEXTUAL BANDIT STRATEGY ALLOCATOR + EPOCH LOSS CURVE */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3.5">
            <Layers className="h-4 w-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                LinUCB Multi-Arm Bandit Capital Allocator & Loss History
              </h3>
              <p className="text-xs text-slate-400">
                Balances exploration vs exploitation across all 5 strategy families automatically
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {((activeModelObj?.banditArmsJson as any[]) ?? []).map((arm) => (
              <div
                key={arm.armKey}
                className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-sans font-semibold text-white">{arm.label}</span>
                  <span className="text-emerald-300">
                    {arm.allocationWeightPct}% Capital Share
                  </span>
                </div>
                <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
                  <span>Observations: {arm.pulls}</span>
                  <span>Mean Net Reward: +{arm.meanRewardBps} bps</span>
                  <span className="text-cyan-300">UCB Score: {arm.ucbScore}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${Math.min(100, arm.allocationWeightPct * 1.8)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {lossCurve.length > 1 && (
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5 text-xs">
              <div className="flex justify-between font-mono text-[11px] text-slate-300">
                <span>Epoch 0 Val Loss: {lossCurve[0].valLoss}</span>
                <span className="text-emerald-400">
                  Epoch {lossCurve[lossCurve.length - 1].epoch} Val Loss:{" "}
                  {lossCurve[lossCurve.length - 1].valLoss}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
