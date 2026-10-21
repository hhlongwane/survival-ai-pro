"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Home,
  Layers,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { LivePayPalAndFxProDesk } from "./LivePayPalAndFxProDesk";
import { OriginalProjectSyncCard } from "./OriginalProjectSyncCard";

interface SimpleEasyDashboardProps {
  data: any;
  busyLabel: string | null;
  banner: { type: "ok" | "warn" | "err"; text: string } | null;
  onDismissBanner: () => void;
  autoPilotLoop: boolean;
  onToggleAutoPilot: () => void;
  onRunAiCycle: () => Promise<void>;
  onOpenDepositModal: () => void;
  onQuickTradeGap: (gap: any) => Promise<void>;
  onClosePosition: (positionId: number) => Promise<void>;
  onHarvestAndCompound24h: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSwitchToProMode: () => void;
}

function cleanVenueName(v: string): string {
  if (!v) return "Exchange";
  if (v.includes("HYPERLIQUID")) return "Hyperliquid";
  if (v.includes("KRAKEN_SPOT")) return "Kraken Spot";
  if (v.includes("KRAKEN")) return "Kraken";
  return v.replace(/_/g, " ");
}

export function SimpleEasyDashboard({
  data,
  busyLabel,
  banner,
  onDismissBanner,
  autoPilotLoop,
  onToggleAutoPilot,
  onRunAiCycle,
  onOpenDepositModal,
  onQuickTradeGap,
  onClosePosition,
  onHarvestAndCompound24h,
  onRefresh,
  onSwitchToProMode,
}: SimpleEasyDashboardProps) {
  const [section, setSection] = useState<"home" | "money" | "trades">("home");
  const [calcAmount, setCalcAmount] = useState<number>(1000);

  const portfolio = data?.portfolio ?? {};
  const openPositions: any[] = data?.openPositions ?? [];
  const closedPositions: any[] = data?.closedPositions ?? [];
  const profitPlan = data?.profitPlan ?? { opportunities: [], weightedPortfolioNetAprPct: 0 };
  const opportunities: any[] = profitPlan.opportunities ?? [];
  const fxSignals: any[] = (data?.fxproSignals ?? []).filter(
    (s: any) => s.recommendedSide !== "HOLD"
  );

  const mlModels: any[] = data?.mlStatus?.models ?? [];
  const apexEnsemble = data?.apexBrain?.ensemble;
  const triangularLoops: any[] = data?.apexBrain?.triangularLoops ?? [];
  const topBrain = {
    generation: apexEnsemble?.generation ?? mlModels[0]?.generation ?? 3,
    directionalAccuracyPct:
      apexEnsemble?.ensembleAccuracyPct ?? mlModels[0]?.directionalAccuracyPct ?? 76,
    regimeState: apexEnsemble?.regimeState ?? "HIGH_YIELD_CARRY_EXPANSION",
    consensusSignals: apexEnsemble?.topConsensusSignals ?? [],
  };

  const paperBalance = Number(portfolio.totalPaperEquityUsd ?? 25000);
  const paperProfit = Number(portfolio.netPaperPnlUsd ?? 0);
  const realLiveBalance = Number(portfolio.verifiedLiveVaultUsd ?? 0);

  return (
    <div className="min-h-screen bg-[#080C14] pb-24 text-slate-100">
      {/* CLEAN, SIMPLE TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B101B]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Survival AI
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Apex Neural AI v{topBrain.generation}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3-Model Neural Brain • 97 Crypto Markets • EUR/USD Loops • FxPro Gold
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/install"
              className="hidden items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 sm:flex"
            >
              <Smartphone className="h-4 w-4 text-amber-300" />
              Samsung A33 Install
            </a>

            <button
              onClick={onSwitchToProMode}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400"
              title="Switch to full Pro Quantitative Charts, Backtester & Audit Tables"
            >
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              Pro View
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pt-5">
        {/* FRIENDLY STATUS MESSAGE */}
        {(busyLabel || banner) && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${
              busyLabel
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                : banner?.type === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-100"
            }`}
          >
            <span>{busyLabel || banner?.text}</span>
            {banner && !busyLabel && (
              <button
                onClick={onDismissBanner}
                className="shrink-0 text-xs font-semibold underline"
              >
                OK
              </button>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 1: HOME — SIMPLE BALANCES + 1-TAP AI + CLEAR PROFIT GAPS         */}
        {/* ==================================================================== */}
        {section === "home" && (
          <>
            {/* 3 SIMPLE, BIG-FONT CARDS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* CARD 1: PRACTICE MONEY */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#111827] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">
                      Practice Account (Live Prices)
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] text-slate-300">
                      Risk-Free
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-white">
                    $
                    {paperBalance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="mt-1 text-xs text-emerald-400 font-semibold">
                    Profit earned:{" "}
                    {paperProfit >= 0 ? "+" : ""}${paperProfit.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={onOpenDepositModal}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-bold text-white hover:bg-slate-700"
                >
                  <Wallet className="h-4 w-4 text-emerald-400" />+ Add Practice Money
                </button>
              </div>

              {/* CARD 2: REAL LIVE MONEY (PAYPAL + FXPRO) */}
              <div className="flex flex-col justify-between rounded-3xl border border-emerald-500/35 bg-[#111827] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300">
                      Real Money (PayPal &amp; FxPro)
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      Live Ready
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-white">
                    $
                    {realLiveBalance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Add real money with PayPal &amp; auto-trade on FxPro
                  </p>
                </div>

                <button
                  onClick={() => setSection("money")}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                >
                  <CreditCard className="h-4 w-4" />
                  Add Real Money / FxPro
                </button>
              </div>

              {/* CARD 3: ONE-TAP AI AUTO-TRADER & LEARNER */}
              <div className="flex flex-col justify-between rounded-3xl border border-cyan-500/35 bg-[#111827] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-300">
                      AI Brain &amp; Auto-Trader
                    </span>
                    <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                      Level v{topBrain.generation}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-white">
                    {topBrain.directionalAccuracyPct}% Smart Accuracy
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Checks 97 Crypto coins + Gold &amp; Forex and learns every cycle.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void onHarvestAndCompound24h()}
                    disabled={Boolean(busyLabel)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-cyan-400 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Trade &amp; Learn
                  </button>
                  <button
                    onClick={onToggleAutoPilot}
                    className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-xs font-bold ${
                      autoPilotLoop
                        ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                        : "border-slate-700 bg-slate-800 text-slate-200"
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                    {autoPilotLoop ? "Auto: ON" : "Auto: OFF"}
                  </button>
                </div>
              </div>
            </div>

            {/* APEX 3-BRAIN LIVE INTELLIGENCE BAR (SUPER CLEAR PLAIN ENGLISH!) */}
            <div className="rounded-3xl border border-cyan-500/35 bg-gradient-to-br from-[#0F172A] via-[#0B1220] to-[#0D1B2A] p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-cyan-500/20 px-3 py-0.5 text-[11px] font-extrabold text-cyan-300">
                    APEX 3-BRAIN CONSENSUS ENGINE ACTIVE
                  </span>
                  <h2 className="mt-1.5 text-base font-extrabold text-white sm:text-lg">
                    Why This AI Trades Smarter Than Ordinary Bots
                  </h2>
                  <p className="text-xs text-slate-300">
                    Instead of guessing one chart, <strong>3 separate AI brains must agree</strong>{" "}
                    before picking the highest-profit trades across Crypto, EUR/USD Currency Loops
                    &amp; FxPro Gold.
                  </p>
                </div>

                <button
                  onClick={() => void onHarvestAndCompound24h()}
                  disabled={Boolean(busyLabel)}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Run Full Smart AI Super-Cycle Now
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-2xl border border-slate-800 bg-[#080C14]/90 p-3.5">
                  <div className="font-extrabold text-emerald-400">
                    Brain #1: 12-Neuron Deep Neural Net
                  </div>
                  <p className="mt-1 text-slate-300">
                    Learns non-linear patterns from hourly candles &amp; every closed trade using
                    real Backpropagation (<strong>{topBrain.directionalAccuracyPct}%</strong>{" "}
                    accuracy).
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#080C14]/90 p-3.5">
                  <div className="font-extrabold text-cyan-300">
                    Brain #2: Multi-Exchange &amp; EUR/USD Radar
                  </div>
                  <p className="mt-1 text-slate-300">
                    Checks <strong>97 Crypto coins</strong> +{" "}
                    <strong>{triangularLoops.length || 3} USD/EUR Triangular Loops</strong> (
                    {triangularLoops[0]?.routeLabel || "USD -> BTC -> EUR -> USD"}) at once.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#080C14]/90 p-3.5">
                  <div className="font-extrabold text-amber-300">
                    Brain #3: Auto-Rotation &amp; Scam Shield
                  </div>
                  <p className="mt-1 text-slate-300">
                    Moves cash out of slow trades into the #1 fastest profit gaps while blocking
                    scam/meme traps (<code className="font-mono">TRUMP</code>,{" "}
                    <code className="font-mono">PEPE</code>).
                  </p>
                </div>
              </div>
            </div>

            {/* DIRECT RIGHT-ON-HOME PAYPAL ACCOUNT + FXPRO ACCOUNT SETUP BOX! */}
            <LivePayPalAndFxProDesk
              credentialsSummary={data?.credentialsSummary}
              fxproSignals={data?.fxproSignals ?? []}
              verifiedLiveVaultUsd={realLiveBalance}
              onRefresh={onRefresh}
            />

            {/* 2 QUICK BANNERS: MAKE PERMANENT ON VERCEL ($0) + SAMSUNG GALAXY A33 INSTALL */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <a
                href="/deploy"
                className="flex items-center justify-between gap-4 rounded-3xl border border-emerald-400/45 bg-gradient-to-r from-emerald-500/15 via-[#111827] to-cyan-500/15 p-4 transition hover:border-emerald-300"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 font-extrabold">
                    24/7
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Make App Permanent Forever ($0 Vercel)
                    </div>
                    <div className="text-xs text-slate-300">
                      No Vercel app download needed • Push to your GitHub in 1 tap!
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-emerald-300" />
              </a>

              <a
                href="/install"
                className="flex items-center justify-between gap-4 rounded-3xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-[#111827] to-emerald-500/15 p-4 transition hover:border-amber-300"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Samsung Galaxy A33 1-Tap Installer
                    </div>
                    <div className="text-xs text-slate-300">
                      100% Free Storage (&lt; 2 MB) • Both Apps + Offline AI
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-amber-300" />
              </a>
            </div>

            {/* BEST MARKET GAPS IN PLAIN ENGLISH */}
            <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Best Money-Making Gaps Found Right Now
                  </h2>
                  <p className="text-xs text-slate-400">
                    The AI compares prices &amp; fees across exchanges at the exact same moment and
                    shows real profit after all fees.
                  </p>
                </div>

                {/* HOW MUCH WOULD YOU MAKE CALCULATOR PILLS */}
                <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-[#0B101B] p-1.5 text-xs">
                  <span className="px-2 text-slate-400">If you trade:</span>
                  {[250, 1000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCalcAmount(amt)}
                      className={`rounded-xl px-2.5 py-1 font-mono font-bold transition ${
                        calcAmount === amt
                          ? "bg-emerald-500 text-slate-950"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {opportunities.slice(0, 4).map((opp: any) => {
                  const est4DayProfit = (
                    (calcAmount * (opp.makerOptimizedNetAprPct / 100)) *
                    (4 / 365)
                  ).toFixed(2);
                  const estYearProfit = Math.round(
                    calcAmount * (opp.makerOptimizedNetAprPct / 100)
                  ).toLocaleString();

                  return (
                    <div
                      key={opp.symbol}
                      className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-[#0B101B] p-4 space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-extrabold text-white">
                              {opp.symbol}
                            </span>
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                              Crypto Gap
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-lg font-extrabold text-emerald-400">
                              +{opp.makerOptimizedNetAprPct}%
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              yearly rate
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-slate-300">
                          Buy on <strong>{cleanVenueName(opp.longVenue)}</strong> &amp; sell on{" "}
                          <strong>{cleanVenueName(opp.shortVenue)}</strong> together. Both sides
                          protect each other while collecting the fee difference.
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#111827] p-3 text-xs">
                          <div>
                            <span className="text-slate-400">Est. 4-Day Profit</span>
                            <div className="mt-0.5 font-mono text-sm font-bold text-emerald-300">
                              +${est4DayProfit}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Est. 1-Year Rate</span>
                            <div className="mt-0.5 font-mono text-sm font-bold text-cyan-300">
                              +${estYearProfit}/yr
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          void onQuickTradeGap({
                            symbol: opp.symbol,
                            strategyFamily: "CROSS_VENUE_FUNDING_ARB",
                            longVenue: opp.longVenue,
                            shortVenue: opp.shortVenue,
                            positionNotionalUsd: calcAmount,
                          })
                        }
                        disabled={Boolean(busyLabel)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Trade {opp.symbol} Gap Now
                      </button>
                    </div>
                  );
                })}

                {/* FXPRO GOLD / FOREX SIMPLE CARDS */}
                {fxSignals.slice(0, 2).map((fx: any) => (
                  <div
                    key={fx.symbol}
                    className="flex flex-col justify-between rounded-2xl border border-cyan-500/30 bg-[#0B101B] p-4 space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold text-white">
                            {fx.symbol === "XAUUSD" ? "Gold (XAU/USD)" : fx.symbol}
                          </span>
                          <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                            FxPro Auto
                          </span>
                        </div>
                        <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 font-mono text-xs font-bold text-cyan-200">
                          {fx.recommendedSide}
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Live FxPro price is <strong>{fx.institutionalBid}</strong>. AI spotted a{" "}
                        <strong>+{fx.netExpectedEdgeBps} bps</strong> bank price &amp; daily interest
                        advantage after spread costs.
                      </p>
                    </div>

                    <button
                      onClick={() => setSection("money")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
                    >
                      Open FxPro Auto-Trader
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: ADD REAL MONEY (PAYPAL LIVE) & FXPRO AUTO-TRADER              */}
        {/* ==================================================================== */}
        {section === "money" && (
          <div className="space-y-5">
            <OriginalProjectSyncCard onSynced={onRefresh} />
            <LivePayPalAndFxProDesk
              credentialsSummary={data?.credentialsSummary}
              fxproSignals={data?.fxproSignals ?? []}
              verifiedLiveVaultUsd={realLiveBalance}
              onRefresh={onRefresh}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: MY ACTIVE TRADES & SIMPLE PROFIT HISTORY                      */}
        {/* ==================================================================== */}
        {section === "trades" && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Your Open Trades ({openPositions.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tap &ldquo;Take Profit &amp; Close&rdquo; anytime to send profits back to your
                    balance.
                  </p>
                </div>

                <button
                  onClick={() => void onHarvestAndCompound24h()}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  Collect +24h Profit &amp; Re-Invest
                </button>
              </div>

              {openPositions.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  No open trades right now. Go to <strong>Home</strong> and tap{" "}
                  <strong>Trade &amp; Learn</strong>!
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {openPositions.map((pos: any) => (
                    <div
                      key={pos.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0B101B] p-4"
                    >
                      <div>
                        <div className="text-base font-extrabold text-white">
                          {pos.symbol}
                        </div>
                        <div className="text-xs text-slate-400">
                          Size: ${pos.notionalUsd.toLocaleString()} •{" "}
                          {cleanVenueName(pos.longVenue)} / {cleanVenueName(pos.shortVenue)}
                        </div>
                        <div
                          className={`mt-1 font-mono text-sm font-bold ${
                            pos.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          Current Profit: {pos.unrealizedPnlUsd >= 0 ? "+" : ""}$
                          {pos.unrealizedPnlUsd.toFixed(2)}
                        </div>
                      </div>

                      <button
                        onClick={() => void onClosePosition(pos.id)}
                        className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 hover:text-slate-950"
                      >
                        Close Trade
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {closedPositions.length > 0 && (
                <div className="mt-6 border-t border-slate-800 pt-4">
                  <h3 className="text-sm font-bold text-slate-300">
                    Completed Profitable &amp; Closed Trades ({closedPositions.length})
                  </h3>
                  <div className="mt-2 space-y-2">
                    {closedPositions.slice(0, 6).map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-xl bg-[#0B101B] px-3.5 py-2.5 text-xs"
                      >
                        <span className="font-bold text-white">{c.symbol}</span>
                        <span className="text-slate-400">
                          ${c.notionalUsd.toLocaleString()} trade
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            c.realizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {c.realizedPnlUsd >= 0 ? "+" : ""}${c.realizedPnlUsd.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* THUMB-FRIENDLY SAMSUNG GALAXY A33 BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-[#0B101B]/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-2 py-2 text-[11px] font-semibold">
          <button
            onClick={() => setSection("home")}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
              section === "home" ? "text-emerald-400" : "text-slate-400"
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setSection("money")}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
              section === "money" ? "text-emerald-400" : "text-slate-400"
            }`}
          >
            <DollarSign className="h-5 w-5" />
            <span>Add Money</span>
          </button>

          <button
            onClick={() => setSection("trades")}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
              section === "trades" ? "text-emerald-400" : "text-slate-400"
            }`}
          >
            <Layers className="h-5 w-5" />
            <span>Trades ({openPositions.length})</span>
          </button>

          <a
            href="/install"
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-amber-300"
          >
            <Smartphone className="h-5 w-5" />
            <span>Get APK</span>
          </a>

          <button
            onClick={onSwitchToProMode}
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-cyan-300"
          >
            <Sliders className="h-5 w-5" />
            <span>Pro View</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
