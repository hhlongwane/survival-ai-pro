"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowUpRight,
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  Coins,
  Database,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { EquityChart } from "./EquityChart";
import { DepositModal } from "./DepositModal";
import { MlAndDualAppStudio } from "./MlAndDualAppStudio";
import { SimpleEasyDashboard } from "./SimpleEasyDashboard";

type TabId =
  | "overview"
  | "ml_apps"
  | "markets"
  | "backtest"
  | "vault"
  | "risk_ai"
  | "business_system";

export function SurvivalDashboard({ initialData }: { initialData: any }) {
  const [data, setData] = useState<any>(initialData);
  const [simpleMode, setSimpleMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [depositOpen, setDepositOpen] = useState(false);
  const [autoPilotLoop, setAutoPilotLoop] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(
    null
  );

  // Market Gap & Deep Research controls
  const [scanNotional, setScanNotional] = useState(10000);
  const [scanHoldHours, setScanHoldHours] = useState(48);
  const [customGaps, setCustomGaps] = useState<any[] | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [deepAnalysis, setDeepAnalysis] = useState<any | null>(null);

  // Manual Order Ticket controls
  const [orderSymbol, setOrderSymbol] = useState("BTC");
  const [orderStructure, setOrderStructure] = useState<
    "HEDGED_CROSS_VENUE" | "SPOT_PERP_CARRY" | "DIRECTIONAL_LONG" | "DIRECTIONAL_SHORT"
  >("HEDGED_CROSS_VENUE");
  const [orderNotional, setOrderNotional] = useState("4000");
  const [orderLeverage, setOrderLeverage] = useState("2");
  const [orderMode, setOrderMode] = useState<"PAPER" | "LIVE">("PAPER");
  const [memeAck, setMemeAck] = useState(false);

  // Backtester controls
  const [btSymbol, setBtSymbol] = useState("BTC");
  const [btStrategy, setBtStrategy] = useState("FUNDING_BASIS_ARB");
  const [btCapital, setBtCapital] = useState("10000");
  const [btFeeBps, setBtFeeBps] = useState("4.0");
  const [btSlipBps, setBtSlipBps] = useState("2.5");
  const [btResult, setBtResult] = useState<any | null>(null);

  // Business SKU Evaluator controls
  const [skuTitle, setSkuTitle] = useState("Solar LiFePO4 1200W Inverter Bundle");
  const [skuCode, setSkuCode] = useState("SHP-SOLAR-1200");
  const [skuPrice, setSkuPrice] = useState("649");
  const [skuCost, setSkuCost] = useState("390");
  const [skuAd, setSkuAd] = useState("65");

  // Integration workbench output
  const [integrationLog, setIntegrationLog] = useState<string | null>(null);

  const refreshDashboard = useCallback(async (forceLive = false) => {
    try {
      const res = await fetch(`/api/dashboard${forceLive ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch {
      // Preserve last valid snapshot safely
    }
  }, []);

  const runAiCycle = useCallback(async () => {
    setBusyLabel("Running 12-Step Autonomous AI Cycle...");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateCarryWindowHours: 8, maxNewTrades: 2 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "AI cycle error");
      setBanner({
        type: "ok",
        text: `${json.cycle.cycleId}: Scanned ${json.cycle.scannedMarkets} live markets, found ${json.cycle.executableGapsCount} positive-net-edge gaps, executed ${json.cycle.executedPaperOrders.length} paper arbitrage hedges, and enforced meme safety gates (${json.cycle.memeResearchBlockedCount} blocked).`,
      });
      await refreshDashboard(true);
    } catch (err: any) {
      setBanner({ type: "err", text: err?.message || "Failed to execute AI cycle" });
    } finally {
      setBusyLabel(null);
    }
  }, [refreshDashboard]);

  // Live Auto-Pilot interval when operator enables Auto-Pilot Loop
  useEffect(() => {
    if (!autoPilotLoop) return;
    const id = setInterval(() => {
      void runAiCycle();
    }, 18000);
    return () => clearInterval(id);
  }, [autoPilotLoop, runAiCycle]);

  // Load initial deep symbol analysis & initial walk-forward backtest once on mount
  useEffect(() => {
    void (async () => {
      try {
        const [aRes, bRes] = await Promise.all([
          fetch("/api/crypto/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: "BTC", notionalUsd: 10000, holdingHours: 48 }),
          }),
          fetch("/api/backtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: "BTC", strategyFamily: "FUNDING_BASIS_ARB" }),
          }),
        ]);
        const [aJson, bJson] = await Promise.all([aRes.json(), bRes.json()]);
        if (aJson.ok) setDeepAnalysis(aJson);
        if (bJson.ok) setBtResult(bJson.result);
      } catch {
        // Non-blocking
      }
    })();
  }, []);

  async function inspectSymbol(sym: string) {
    setSelectedSymbol(sym);
    setOrderSymbol(sym);
    setBusyLabel(`Analyzing ${sym} across venues...`);
    try {
      const res = await fetch("/api/crypto/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: sym,
          notionalUsd: scanNotional,
          holdingHours: scanHoldHours,
        }),
      });
      const json = await res.json();
      if (json.ok) setDeepAnalysis(json);
    } finally {
      setBusyLabel(null);
    }
  }

  async function rescanCustomGaps() {
    setBusyLabel("Recalculating PR #15 multi-leg costs & slippage...");
    try {
      const res = await fetch(
        `/api/crypto/gaps?notionalUsd=${scanNotional}&holdingHours=${scanHoldHours}`
      );
      const json = await res.json();
      if (json.ok) setCustomGaps(json.gaps);
    } finally {
      setBusyLabel(null);
    }
  }

  async function quickExecuteGap(gap: any) {
    setBusyLabel(`Executing ${gap.symbol} paper hedge...`);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: gap.symbol,
          structure:
            gap.strategyFamily === "SPOT_PERP_CASH_CARRY"
              ? "SPOT_PERP_CARRY"
              : "HEDGED_CROSS_VENUE",
          longVenue: gap.longVenue,
          shortVenue: gap.shortVenue,
          notionalUsd: Math.min(5000, Math.max(1500, gap.positionNotionalUsd * 0.4)),
          leverage: 2,
          executionMode: "PAPER",
          strategyFamily: gap.strategyFamily,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setBanner({
          type: "warn",
          text: `Risk Gate Blocked ${gap.symbol}: ${
            json.riskVerdict?.reasons?.join(" | ") || json.error
          }`,
        });
      } else {
        setBanner({
          type: "ok",
          text: `Filled Paper Hedge on ${gap.symbol} (${gap.longVenue} Long / ${gap.shortVenue} Short) — Position #${json.position.id}.`,
        });
      }
      await refreshDashboard();
    } finally {
      setBusyLabel(null);
    }
  }

  async function submitManualTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusyLabel(`Submitting ${orderMode} order through 12 Safety Gates...`);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: orderSymbol,
          structure: orderStructure,
          notionalUsd: Number(orderNotional),
          leverage: Number(orderLeverage),
          executionMode: orderMode,
          manualMemeResearchAck: memeAck,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setBanner({
          type: "warn",
          text: `Blocked by ${json.riskVerdict?.blockedGate || "RISK_GATE"}: ${
            json.riskVerdict?.reasons?.join(" ") || json.error
          }`,
        });
      } else {
        setBanner({
          type: "ok",
          text: `Order #${json.order.id} FILLED in PAPER Vault (${orderSymbol} $${Number(
            orderNotional
          ).toLocaleString()}).`,
        });
      }
      await refreshDashboard();
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleSimulateCarry(hours: number) {
    setBusyLabel(`Reconciling +${hours}h live venue mark & funding settlement...`);
    try {
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RECONCILE_CARRY", hours }),
      });
      setBanner({
        type: "ok",
        text: `Accrued +${hours}h hourly funding payments & live bid/ask mark-to-market across all open positions.`,
      });
      await refreshDashboard();
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleClosePosition(posId: number) {
    setBusyLabel(`Closing Position #${posId} & settling double-entry ledger...`);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE_POSITION", positionId: posId }),
      });
      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "ok",
          text: `Closed Position #${posId} — Net Realized PnL $${json.position.realizedPnlUsd.toFixed(
            2
          )} settled to Paper Trading Vault.`,
        });
      }
      await refreshDashboard();
    } finally {
      setBusyLabel(null);
    }
  }

  async function runBacktestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusyLabel(`Running walk-forward backtest + 3 stress scenarios on ${btSymbol}...`);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: btSymbol,
          strategyFamily: btStrategy,
          initialCapital: Number(btCapital),
          feeBpsPerSide: Number(btFeeBps),
          slippageBpsPerSide: Number(btSlipBps),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setBtResult(json.result);
        await refreshDashboard();
      }
    } finally {
      setBusyLabel(null);
    }
  }

  async function toggleRiskFlag(field: "killSwitchActive" | "circuitBreakerTripped", nextVal: boolean) {
    setBusyLabel("Updating durable risk policy...");
    try {
      await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextVal }),
      });
      setBanner({
        type: nextVal ? "warn" : "ok",
        text: `${field} set to ${String(nextVal)} in PostgreSQL system_configs.`,
      });
      await refreshDashboard();
    } finally {
      setBusyLabel(null);
    }
  }

  async function runSafetyDrill() {
    setBusyLabel("Executing 3-vector safety gate verification drill...");
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RUN_SAFETY_DRILL" }),
      });
      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "ok",
          text: `Safety Gate Drill Passed (${String(
            json.drillsPassed
          )}): Blocked unauthorized LIVE order, autonomous TRUMP trade, and 10x leverage breach — all persisted to audit trail.`,
        });
        await refreshDashboard();
      }
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCompound24hAndLearn() {
    setBusyLabel(
      "Apex 3-Brain Neural AI scanning 97 Crypto coins + EUR/USD Loops + FxPro Gold, rotating capital & learning..."
    );
    try {
      const res = await fetch("/api/apex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateHours: 24 }),
      });
      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "ok",
          text: `Apex Neural v${json.ensemble.generation} (${json.ensemble.ensembleAccuracyPct}% Accuracy): Opened ${json.openedCount} consensus crypto trades, dispatched ${json.fxproDispatched} FxPro trades, and added +$${json.harvestedUsd.toFixed(
            2
          )} profit to your balance!`,
        });
        await refreshDashboard(true);
      }
    } finally {
      setBusyLabel(null);
    }
  }

  const portfolio = data?.portfolio ?? {};
  const gapsToShow = customGaps ?? data?.marketGaps ?? [];
  const openPositions = data?.openPositions ?? [];
  const closedPositions = data?.closedPositions ?? [];

  if (simpleMode) {
    return (
      <>
        <SimpleEasyDashboard
          data={data}
          busyLabel={busyLabel}
          banner={banner}
          onDismissBanner={() => setBanner(null)}
          autoPilotLoop={autoPilotLoop}
          onToggleAutoPilot={() => setAutoPilotLoop((v) => !v)}
          onRunAiCycle={runAiCycle}
          onOpenDepositModal={() => setDepositOpen(true)}
          onQuickTradeGap={quickExecuteGap}
          onClosePosition={handleClosePosition}
          onHarvestAndCompound24h={handleCompound24hAndLearn}
          onRefresh={() => refreshDashboard(true)}
          onSwitchToProMode={() => setSimpleMode(false)}
        />
        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          availableBalance={Number(portfolio.paperVaultAvailableUsd ?? 25000)}
          verifiedLiveBalance={Number(portfolio.verifiedLiveVaultUsd ?? 0)}
          onSuccess={() => refreshDashboard(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#090C12] text-slate-100">
      {/* TOP COMMAND HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0B0F18]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  SURVIVAL AI
                </h1>
                <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
                  INDEPENDENT RECREATION v2.0
                </span>
                <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                  PAPER VAULT ACTIVE • LIVE ORDERS LOCKED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live Kraken + Hyperliquid + Coinbase Feeds • PR #15 Multi-Leg Funding/Basis Engine •
                PostgreSQL Double-Entry Ledger
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setSimpleMode(true)}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
            >
              Switch to Easy View
            </button>
            <a
              href="/install"
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25"
            >
              <AppWindow className="h-4 w-4 text-amber-300" />
              Install on Android / Download AI
            </a>

            <a
              href="/apps"
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
            >
              <AppWindow className="h-4 w-4 text-cyan-400" />
              App #2: Alpha Gap AI
            </a>

            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
            >
              <Wallet className="h-4 w-4" />
              Deposit / Fund Vault
            </button>

            <button
              onClick={() => void runAiCycle()}
              disabled={Boolean(busyLabel)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Run Autonomous AI Cycle
            </button>

            <button
              onClick={() => setAutoPilotLoop((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                autoPilotLoop
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
            >
              <Bot className="h-4 w-4" />
              {autoPilotLoop ? "Auto-Pilot ON (18s)" : "Auto-Pilot OFF"}
            </button>

            <button
              onClick={() => void refreshDashboard(true)}
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:border-slate-600 hover:text-white"
              title="Refresh live exchange feeds"
            >
              <RefreshCw className={`h-4 w-4 ${busyLabel ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* NAVIGATION WORKSPACE BAR */}
        <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6">
          {[
            { id: "overview", label: "Command Overview", icon: TrendingUp },
            { id: "ml_apps", label: "Dual Apps, ML Learning & Compounder", icon: Brain },
            { id: "markets", label: "Market Gaps & Deep Research", icon: Search },
            { id: "backtest", label: "Backtest & Stress Lab", icon: BarChart3 },
            { id: "vault", label: "Capital Vault & Ledger", icon: Coins },
            { id: "risk_ai", label: "Risk Gates, AI & Rollback", icon: ShieldCheck },
            { id: "business_system", label: "Shopify, Brokers & System Audit", icon: Briefcase },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabId)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition ${
                  active
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        {/* STATUS / ACTION FEEDBACK BANNER */}
        {(busyLabel || banner) && (
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
              busyLabel
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                : banner?.type === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : banner?.type === "warn"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            <span className="font-medium">{busyLabel || banner?.text}</span>
            {banner && !busyLabel && (
              <button
                onClick={() => setBanner(null)}
                className="text-slate-400 underline hover:text-white"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* EXECUTIVE KPI STRIP (STRICT ACCOUNTING SEPARATION VISIBLE AT ALL TIMES) */}
        <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-800/90 bg-[#101623] p-4">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>PAPER VAULT TOTAL EQUITY</span>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                SIMULATED
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
              $
              {Number(portfolio.totalPaperEquityUsd ?? 25000).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400 tabular-nums">
              Free Cash: $
              {Number(portfolio.paperVaultAvailableUsd ?? 25000).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#101623] p-4">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>NET PAPER TRADING PNL</span>
              <span className="font-mono text-[10px] text-cyan-300">AFTER ALL FEES</span>
            </div>
            <div
              className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                Number(portfolio.netPaperPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {Number(portfolio.netPaperPnlUsd ?? 0) >= 0 ? "+" : ""}$
              {Number(portfolio.netPaperPnlUsd ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400 tabular-nums">
              Realized: ${Number(portfolio.paperRealizedPnlUsd ?? 0).toFixed(2)} • Funding: $
              {Number(portfolio.totalAccruedFundingUsd ?? 0).toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#101623] p-4">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>LOCKED MARGIN & OPEN LEGS</span>
              <span className="font-mono text-[10px] text-slate-300">
                {openPositions.length} ACTIVE
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-cyan-300 tabular-nums">
              $
              {Number(portfolio.paperVaultLockedMarginUsd ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Split-collateral + 20% anti-liquidation buffer
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#101623] p-4">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>VERIFIED REAL BUSINESS INCOME</span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                REAL LEDGER
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
              $
              {Number(portfolio.verifiedBusinessRealRevenueUsd ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Strictly segregated from paper PnL & models
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#101623] p-4">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>SAFETY GATE & VENUE MESH</span>
              {data?.riskPolicy?.killSwitchActive ? (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">
                  KILL SWITCH ON
                </span>
              ) : (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  12 GATES ARMED
                </span>
              )}
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-emerald-300">
              {
                (data?.market?.venueStatuses ?? []).filter((v: any) => v.status === "ONLINE")
                  .length
              }
              /{(data?.market?.venueStatuses ?? []).length} Feeds Live
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Regime: {data?.market?.globalRegime?.replace(/_/g, " ") || "ACTIVE"}
            </div>
          </div>
        </section>

        {/* ======================================================================== */}
        {/* TAB 1B: DUAL APPS, ONLINE ML LEARNING & PROFIT COMPOUNDER STUDIO         */}
        {/* ======================================================================== */}
        {activeTab === "ml_apps" && (
          <MlAndDualAppStudio
            mlStatus={data?.mlStatus}
            profitPlan={data?.profitPlan}
            credentialsSummary={data?.credentialsSummary}
            fxproSignals={data?.fxproSignals}
            verifiedLiveVaultUsd={Number(portfolio.verifiedLiveVaultUsd ?? 0)}
            onRefreshParent={() => refreshDashboard(true)}
          />
        )}

        {/* ======================================================================== */}
        {/* TAB 1: COMMAND OVERVIEW                                                  */}
        {/* ======================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <MlAndDualAppStudio
              mlStatus={data?.mlStatus}
              profitPlan={data?.profitPlan}
              credentialsSummary={data?.credentialsSummary}
              fxproSignals={data?.fxproSignals}
              verifiedLiveVaultUsd={Number(portfolio.verifiedLiveVaultUsd ?? 0)}
              onRefreshParent={() => refreshDashboard(true)}
            />
            {/* TOP LIVE MARKET GAPS TABLE */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Live Multi-Venue Market Gaps & PR #15 Execution-Aware Arbitrage Scanner
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time cross-venue perpetual funding & spot-perp basis across Hyperliquid,
                    Kraken Futures, and Kraken Spot — net of 4-leg fees, spreads, slippage,
                    convergence decay, and split collateral lockup.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("markets")}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    Deep Research & TRUMP Audit <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pr-3">Asset</th>
                      <th className="py-2.5 px-3">Hedged Route (Long / Short)</th>
                      <th className="py-2.5 px-3 text-right">Entry Prices</th>
                      <th className="py-2.5 px-3 text-right">Gross APR</th>
                      <th className="py-2.5 px-3 text-right">All-In Friction</th>
                      <th className="py-2.5 px-3 text-right">Net Capital APR</th>
                      <th className="py-2.5 px-3">PR #15 Verdict</th>
                      <th className="py-2.5 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {gapsToShow.slice(0, 10).map((g: any) => (
                      <tr key={g.opportunityKey} className="hover:bg-slate-800/25">
                        <td className="py-3 pr-3 font-sans font-semibold text-white">
                          <button
                            onClick={() => {
                              void inspectSymbol(g.symbol);
                              setActiveTab("markets");
                            }}
                            className="flex items-center gap-1.5 hover:text-emerald-300"
                          >
                            <span>{g.symbol}</span>
                            {g.verdict === "RESEARCH_ONLY_NO_AUTO_TRADE" && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                                MEME LOCK
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="text-emerald-300">{g.longVenue}</span>
                          {" -> "}
                          <span className="text-cyan-300">{g.shortVenue}</span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          ${g.longEntryPrice} / ${g.shortEntryPrice}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          {g.grossNotionalAprPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-amber-300">
                          -{g.costs.totalFrictionBps.toFixed(1)} bps
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            g.netCapitalAdjustedAprPct > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {g.netCapitalAdjustedAprPct > 0 ? "+" : ""}
                          {g.netCapitalAdjustedAprPct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                              g.verdict === "EXECUTABLE_EDGE"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : g.verdict === "RESEARCH_ONLY_NO_AUTO_TRADE"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {g.verdict}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right font-sans">
                          {g.verdict === "EXECUTABLE_EDGE" ? (
                            <button
                              onClick={() => void quickExecuteGap(g)}
                              className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950"
                            >
                              Execute Paper Hedge
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                void inspectSymbol(g.symbol);
                                setActiveTab("markets");
                              }}
                              className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-500"
                            >
                              Inspect Reason
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ACTIVE PAPER POSITIONS DESK + RECENT AI DECISIONS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Open Paper & Delta-Neutral Arbitrage Positions ({openPositions.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Live mark-to-market against current Hyperliquid & Kraken bid/ask books
                    </p>
                  </div>
                  <button
                    onClick={() => void handleSimulateCarry(8)}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Reconcile +8h Funding Carry
                  </button>
                </div>

                {openPositions.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No open paper positions yet. Click{" "}
                    <button
                      onClick={() => void runAiCycle()}
                      className="font-semibold text-cyan-300 underline"
                    >
                      Run Autonomous AI Cycle
                    </button>{" "}
                    or execute any positive-edge gap above to open live-quoted hedged paper
                    positions.
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="py-2">Symbol</th>
                          <th className="py-2">Venues</th>
                          <th className="py-2 text-right">Notional</th>
                          <th className="py-2 text-right">Accrued Carry</th>
                          <th className="py-2 text-right">Unrealized PnL</th>
                          <th className="py-2 text-right">Settle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                        {openPositions.map((pos: any) => (
                          <tr key={pos.id}>
                            <td className="py-2.5 font-sans font-semibold text-white">
                              {pos.symbol}{" "}
                              <span className="text-[10px] font-normal text-slate-400">
                                #{pos.id}
                              </span>
                            </td>
                            <td className="py-2.5 text-[11px] text-slate-300">
                              {pos.longVenue} / {pos.shortVenue}
                            </td>
                            <td className="py-2.5 text-right text-slate-200">
                              ${pos.notionalUsd.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right text-cyan-300">
                              ${pos.accruedFundingUsd.toFixed(3)}
                            </td>
                            <td
                              className={`py-2.5 text-right font-semibold ${
                                pos.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {pos.unrealizedPnlUsd >= 0 ? "+" : ""}$
                              {pos.unrealizedPnlUsd.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right font-sans">
                              <button
                                onClick={() => void handleClosePosition(pos.id)}
                                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:border-emerald-400 hover:text-emerald-300"
                              >
                                Close & Realize
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* AUTONOMOUS AI TELEMETRY FEED */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
                <h3 className="text-sm font-semibold text-white">
                  Autonomous AI Decision & Learning Stream
                </h3>
                <p className="text-xs text-slate-400">
                  Auditable predictions, meme safety blocks & reconciliations
                </p>
                <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {(data?.aiDecisions ?? []).length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      Run an Autonomous AI Cycle to populate decision telemetry.
                    </p>
                  ) : (
                    (data?.aiDecisions ?? []).slice(0, 8).map((d: any) => (
                      <div
                        key={d.id}
                        className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-cyan-300">
                            {d.symbol} • {d.decisionType}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            Conf {d.confidenceScore}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                          {d.reasoning}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* TAB 2: MARKET GAPS & DEEP CRYPTO RESEARCH (INCLUDING TRUMP AUDIT)        */}
        {/* ======================================================================== */}
        {activeTab === "markets" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* SIZING & HOLDING HORIZON SENSITIVITY BAR */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      PR #15 Execution-Aware Sizing & Holding Horizon Scanner
                    </h2>
                    <p className="text-xs text-slate-400">
                      Test how orderbook depth impact & amortized multi-leg fees change net return
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400">Notional (USD)</label>
                      <select
                        value={scanNotional}
                        onChange={(e) => setScanNotional(Number(e.target.value))}
                        className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 font-mono text-xs text-white"
                      >
                        <option value={2500}>$2,500</option>
                        <option value={10000}>$10,000</option>
                        <option value={50000}>$50,000</option>
                        <option value={150000}>$150,000 (Depth Stress)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400">Holding Period</label>
                      <select
                        value={scanHoldHours}
                        onChange={(e) => setScanHoldHours(Number(e.target.value))}
                        className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-1.5 font-mono text-xs text-white"
                      >
                        <option value={8}>8 Hours</option>
                        <option value={24}>24 Hours</option>
                        <option value={48}>48 Hours</option>
                        <option value={168}>7 Days (168h)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => void rescanCustomGaps()}
                      className="mt-4 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      Re-Evaluate All Markets
                    </button>
                  </div>
                </div>

                {/* QUICK ASSET PILLS INCLUDING TRUMP & MEMES */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  {(data?.market?.assets ?? []).map((a: any) => (
                    <button
                      key={a.symbol}
                      onClick={() => void inspectSymbol(a.symbol)}
                      className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                        selectedSymbol === a.symbol
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                          : a.memeSafety?.isSpeculativeMeme
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-200 hover:border-amber-400"
                            : "border-slate-800 bg-[#0B0F19] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {a.symbol} ${a.spotReferencePrice}
                    </button>
                  ))}
                </div>
              </div>

              {/* DEEP SYMBOL ANALYSIS OUTPUT */}
              {deepAnalysis && (
                <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {deepAnalysis.displayName} ({deepAnalysis.symbol}) — Multi-Venue Intelligence
                      </h3>
                      <p className="text-xs text-slate-400">
                        Spot Ref:{" "}
                        <span className="font-mono text-white">
                          ${deepAnalysis.marketIntelligence.spotReferencePrice}
                        </span>{" "}
                        • Realized Vol:{" "}
                        <span className="font-mono text-cyan-300">
                          {deepAnalysis.marketIntelligence.realizedVolAnnualizedPct}%
                        </span>{" "}
                        • Regime:{" "}
                        <span className="font-mono text-emerald-300">
                          {deepAnalysis.marketIntelligence.marketRegime}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold ${
                        deepAnalysis.memeAndManipulationSafety.isSpeculativeMeme
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {deepAnalysis.memeAndManipulationSafety.classification}
                    </span>
                  </div>

                  {/* MEME & CONCENTRATION SAFETY CARD */}
                  <div
                    className={`rounded-xl border p-4 text-xs ${
                      deepAnalysis.memeAndManipulationSafety.isSpeculativeMeme
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                        : "border-slate-800 bg-[#0B0F19] text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        Token Safety, Concentration & Manipulation Risk Score:{" "}
                        {deepAnalysis.memeAndManipulationSafety.manipulationRiskScore}/100
                      </span>
                      <span>
                        Auto-Trade Allowed:{" "}
                        {String(deepAnalysis.memeAndManipulationSafety.autoTradePermitted)}
                      </span>
                    </div>
                    <p className="mt-1.5 opacity-90">
                      {deepAnalysis.memeAndManipulationSafety.concentrationWarning}
                    </p>
                    <p className="mt-1 font-medium text-amber-300">
                      {deepAnalysis.memeAndManipulationSafety.policyRule}
                    </p>
                  </div>

                  {/* VENUE ORDERBOOK & FUNDING COMPARISON */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="py-2">Venue</th>
                          <th className="py-2 text-right">Bid / Ask</th>
                          <th className="py-2 text-right">Spread</th>
                          <th className="py-2 text-right">Book Depth</th>
                          <th className="py-2 text-right">1h Funding</th>
                          <th className="py-2 text-right">Pred Next 1h</th>
                          <th className="py-2 text-right">24h Vol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                        {deepAnalysis.venues.map((v: any) => (
                          <tr key={v.venue}>
                            <td className="py-2.5 font-sans font-medium text-white">{v.venue}</td>
                            <td className="py-2.5 text-right text-slate-300">
                              ${v.bid.toFixed(v.bid < 5 ? 4 : 2)} / $
                              {v.ask.toFixed(v.ask < 5 ? 4 : 2)}
                            </td>
                            <td className="py-2.5 text-right text-slate-300">{v.spreadBps} bps</td>
                            <td className="py-2.5 text-right text-cyan-300">
                              ${Math.round(v.topBookDepthUsd).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right text-emerald-300">
                              {(v.hourlyFundingRate * 10000).toFixed(3)} bps
                            </td>
                            <td className="py-2.5 text-right text-amber-300">
                              {(v.predictedHourlyFundingRate * 10000).toFixed(3)} bps
                            </td>
                            <td className="py-2.5 text-right text-slate-400">
                              ${Math.round(v.volume24hUsd / 1_000_000).toLocaleString()}M
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PR #15 FRICTION WATERFALL */}
                  {deepAnalysis.bestFundingAndBasisEvaluation && (
                    <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4 text-xs">
                      <h4 className="font-semibold text-white">
                        PR #15 Multi-Leg Cost Breakdown ({deepAnalysis.bestFundingAndBasisEvaluation.longVenue}{" "}
                        Long / {deepAnalysis.bestFundingAndBasisEvaluation.shortVenue} Short)
                      </h4>
                      <div className="mt-3 grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
                        <div>
                          <div className="text-[10px] text-slate-400">Gross Return</div>
                          <div className="text-emerald-300">
                            +{deepAnalysis.bestFundingAndBasisEvaluation.grossTotalReturnBps} bps
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">4-Leg Fees + Spread</div>
                          <div className="text-rose-300">
                            -
                            {(
                              deepAnalysis.bestFundingAndBasisEvaluation.costs.entryAndExitFeesBps +
                              deepAnalysis.bestFundingAndBasisEvaluation.costs.bidAskSpreadBps
                            ).toFixed(2)}{" "}
                            bps
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Impact + Carry Haircuts</div>
                          <div className="text-amber-300">
                            -
                            {(
                              deepAnalysis.bestFundingAndBasisEvaluation.costs.totalFrictionBps -
                              deepAnalysis.bestFundingAndBasisEvaluation.costs.entryAndExitFeesBps -
                              deepAnalysis.bestFundingAndBasisEvaluation.costs.bidAskSpreadBps
                            ).toFixed(2)}{" "}
                            bps
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Net Expected Edge</div>
                          <div className="font-bold text-white">
                            {deepAnalysis.bestFundingAndBasisEvaluation.netExpectedReturnBps} bps (
                            {deepAnalysis.bestFundingAndBasisEvaluation.netCapitalAdjustedAprPct}%
                            APR)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ORDER EXECUTION TICKET (WITH LIVE SAFETY GATE TESTING) */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 h-fit">
              <h3 className="text-sm font-semibold text-white">
                Order Execution Ticket & Safety Gate Verifier
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Execute Paper Trades against live orderbooks — or test submitting an unauthorized
                LIVE order to verify fail-closed safety behavior.
              </p>

              <form onSubmit={submitManualTicket} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="text-slate-300">Asset Symbol</label>
                  <select
                    value={orderSymbol}
                    onChange={(e) => setOrderSymbol(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-white"
                  >
                    {(data?.market?.assets ?? []).map((a: any) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} — ${a.spotReferencePrice}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300">Execution Structure</label>
                  <select
                    value={orderStructure}
                    onChange={(e) => setOrderStructure(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 text-white"
                  >
                    <option value="HEDGED_CROSS_VENUE">
                      Delta-Neutral Cross-Venue Funding Arbitrage
                    </option>
                    <option value="SPOT_PERP_CARRY">Spot Long + Perp Short Cash & Carry</option>
                    <option value="DIRECTIONAL_LONG">Directional Long (Live Ask + Impact)</option>
                    <option value="DIRECTIONAL_SHORT">Directional Short (Live Bid - Impact)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300">Notional (USD)</label>
                    <input
                      type="number"
                      value={orderNotional}
                      onChange={(e) => setOrderNotional(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300">Leverage</label>
                    <input
                      type="number"
                      step="0.5"
                      value={orderLeverage}
                      onChange={(e) => setOrderLeverage(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300">Execution Mode</label>
                  <select
                    value={orderMode}
                    onChange={(e) => setOrderMode(e.target.value as "PAPER" | "LIVE")}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-white"
                  >
                    <option value="PAPER">PAPER / SANDBOX VAULT (Active)</option>
                    <option value="LIVE">LIVE EXCHANGE ORDER (Locked by Safety Gate)</option>
                  </select>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#0B0F19] p-2.5 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={memeAck}
                    onChange={(e) => setMemeAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Manual Speculative Override (required ONLY for manual paper tests on meme
                    research tokens like TRUMP; autonomous AI remains hard-blocked).
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Submit Order Through 12 Safety Gates
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* TAB 3: QUANTITATIVE BACKTESTING & STRESS LAB                             */}
        {/* ======================================================================== */}
        {activeTab === "backtest" && (
          <div className="space-y-6">
            <form
              onSubmit={runBacktestSubmit}
              className="grid grid-cols-1 gap-3.5 rounded-2xl border border-slate-800/90 bg-[#101623] p-5 sm:grid-cols-6"
            >
              <div>
                <label className="text-xs text-slate-400">Symbol</label>
                <select
                  value={btSymbol}
                  onChange={(e) => setBtSymbol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-xs text-white"
                >
                  {["BTC", "ETH", "SOL", "XRP", "LINK", "AVAX", "DOGE"].map((s) => (
                    <option key={s} value={s}>
                      {s}-USD (Hourly)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">Strategy Family</label>
                <select
                  value={btStrategy}
                  onChange={(e) => setBtStrategy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 text-xs text-white"
                >
                  <option value="FUNDING_BASIS_ARB">Funding & Basis Arbitrage Harvest</option>
                  <option value="CROSS_VENUE_MOMENTUM">Cross-Venue EMA + Volume Momentum</option>
                  <option value="BOLLINGER_MEAN_REVERSION">Bollinger Z-Score Mean Reversion</option>
                  <option value="REGIME_VOLATILITY_BREAKOUT">Donchian Regime Breakout</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Fee / Side (bps)</label>
                <input
                  type="number"
                  step="0.5"
                  value={btFeeBps}
                  onChange={(e) => setBtFeeBps(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Slippage (bps)</label>
                <input
                  type="number"
                  step="0.5"
                  value={btSlipBps}
                  onChange={(e) => setBtSlipBps(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Run Walk-Forward Test
                </button>
              </div>
            </form>

            {btResult && (
              <div className="space-y-6 rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs text-cyan-300">
                      DATA SOURCE: {btResult.dataSource} ({btResult.candleCount} Hourly Bars • Zero
                      Look-Ahead Fill at Next Bar Open)
                    </span>
                    <h3 className="mt-1 text-sm font-semibold text-white">
                      {btResult.verdictSummary}
                    </h3>
                  </div>
                  <span
                    className={`rounded-lg px-3 py-1 font-mono text-xs font-semibold ${
                      btResult.isValidatedEdge
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {btResult.isValidatedEdge ? "VALIDATED PAPER EDGE" : "UNVALIDATED / CAUTION"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono sm:grid-cols-6">
                  {[
                    { label: "Total Net Return", val: `${btResult.totalReturnPct}%` },
                    { label: "30% Out-of-Sample", val: `${btResult.outOfSampleReturnPct}%` },
                    { label: "Sharpe / Sortino", val: `${btResult.sharpeRatio} / ${btResult.sortinoRatio}` },
                    { label: "Max Drawdown", val: `-${btResult.maxDrawdownPct}%` },
                    { label: "Win Rate / Trades", val: `${btResult.winRatePct}% (${btResult.totalTrades})` },
                    { label: "Fees Deducted", val: `$${btResult.totalFeesUsd}` },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3"
                    >
                      <div className="font-sans text-[11px] text-slate-400">{m.label}</div>
                      <div className="mt-1 text-sm font-bold text-white">{m.val}</div>
                    </div>
                  ))}
                </div>

                <EquityChart
                  points={btResult.equityCurve}
                  initialCapital={btResult.initialCapital}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4">
                    <h4 className="text-xs font-semibold text-white">
                      Adverse Market Stress Scenarios
                    </h4>
                    <div className="mt-3 space-y-2.5 text-xs">
                      {btResult.stressTests.map((st: any) => (
                        <div
                          key={st.scenarioName}
                          className="flex items-center justify-between border-b border-slate-800/70 pb-2"
                        >
                          <div>
                            <div className="font-medium text-slate-200">{st.scenarioName}</div>
                            <div className="text-[11px] text-slate-400">{st.description}</div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-white">{st.returnPct}%</div>
                            <div className="text-[10px] text-rose-400">
                              MaxDD -{st.maxDrawdownPct}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4">
                    <h4 className="text-xs font-semibold text-white">
                      Parameter Sensitivity Neighborhood (Anti-Overfitting Check)
                    </h4>
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                      {btResult.sensitivityGrid.map((cell: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-800 bg-[#101623] p-2.5"
                        >
                          <div className="text-[10px] text-slate-400">
                            LB:{cell.lookbackPeriod} / TH:{cell.signalThreshold}
                          </div>
                          <div
                            className={`mt-1 font-semibold ${
                              cell.totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {cell.totalReturnPct}% (SR {cell.sharpeRatio})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================== */}
        {/* TAB 4: CAPITAL VAULT, ORDERS & AUDITABLE DOUBLE-ENTRY LEDGER             */}
        {/* ======================================================================== */}
        {activeTab === "vault" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(data?.wallets ?? []).map((w: any) => (
                <div
                  key={w.id}
                  className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-cyan-300">{w.walletCode}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                      {w.isSimulated ? "SANDBOX / PAPER" : "VERIFIED REAL"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{w.name}</p>
                  <div className="mt-3 font-mono text-2xl font-bold text-white">
                    ${w.availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-400">
                    Locked Margin: ${w.lockedMargin.toFixed(2)} • Realized PnL: $
                    {w.realizedPnl.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* DOUBLE-ENTRY LEDGER */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">
                    Append-Only Auditable Ledger Entries
                  </h3>
                  <button
                    onClick={() => setDepositOpen(true)}
                    className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950"
                  >
                    + Deposit / Withdraw
                  </button>
                </div>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto text-xs">
                  {(data?.recentLedger ?? []).map((l: any) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-[#0B0F19] p-3"
                    >
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-white">
                          #{l.id} • {l.entryType} ({l.direction})
                        </div>
                        <div className="text-[11px] text-slate-400">{l.description}</div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div
                          className={
                            l.direction === "CREDIT" ? "text-emerald-400" : "text-amber-300"
                          }
                        >
                          {l.direction === "CREDIT" ? "+" : "-"}${l.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Bal: ${l.balanceAfter.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ORDER LIFECYCLE & CLOSED TRADE HISTORY */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5">
                <h3 className="border-b border-slate-800 pb-3 text-sm font-semibold text-white">
                  Order Execution & Rejection Lifecycle ({(data?.recentOrders ?? []).length})
                </h3>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto text-xs">
                  {(data?.recentOrders ?? []).map((o: any) => (
                    <div
                      key={o.id}
                      className="rounded-lg border border-slate-800/80 bg-[#0B0F19] p-3"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-white">
                          {o.symbol} • {o.side} ({o.executionMode})
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            o.status === "FILLED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        Notional: ${o.requestedNotionalUsd} • Fill: ${o.filledPrice ?? "—"} • Fee: $
                        {o.feeUsd}
                      </div>
                      {o.rejectionReason && (
                        <div className="mt-1 text-[11px] text-rose-300">{o.rejectionReason}</div>
                      )}
                    </div>
                  ))}
                  {closedPositions.length > 0 && (
                    <div className="pt-2 text-[11px] text-slate-400">
                      Closed Settled Positions: {closedPositions.length} total settled into Vault.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* TAB 5: RISK CONTROLS, AI LEARNING & STRATEGY ROLLBACK                    */}
        {/* ======================================================================== */}
        {activeTab === "risk_ai" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Fail-Closed Risk Controls & Emergency Kill Switch
                  </h3>
                  <p className="text-xs text-slate-400">
                    Autonomous AI is hard-blocked from modifying any safety parameter.
                  </p>
                </div>
                <button
                  onClick={() => void runSafetyDrill()}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Run 3-Vector Safety Gate Drill
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  onClick={() =>
                    void toggleRiskFlag("killSwitchActive", !data?.riskPolicy?.killSwitchActive)
                  }
                  className={`rounded-xl border p-3.5 text-left transition ${
                    data?.riskPolicy?.killSwitchActive
                      ? "border-rose-500 bg-rose-500/20 text-rose-200"
                      : "border-slate-800 bg-[#0B0F19] text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <div className="font-semibold">Emergency Stop / Kill Switch</div>
                  <div className="mt-1 font-mono text-[11px]">
                    State: {data?.riskPolicy?.killSwitchActive ? "ACTIVE (ALL BLOCKED)" : "ARMED"}
                  </div>
                </button>

                <button
                  onClick={() =>
                    void toggleRiskFlag(
                      "circuitBreakerTripped",
                      !data?.riskPolicy?.circuitBreakerTripped
                    )
                  }
                  className={`rounded-xl border p-3.5 text-left transition ${
                    data?.riskPolicy?.circuitBreakerTripped
                      ? "border-amber-500 bg-amber-500/20 text-amber-200"
                      : "border-slate-800 bg-[#0B0F19] text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <div className="font-semibold">Volatility Circuit Breaker</div>
                  <div className="mt-1 font-mono text-[11px]">
                    State: {data?.riskPolicy?.circuitBreakerTripped ? "TRIPPED" : "NOMINAL"}
                  </div>
                </button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
                {(data?.recentRiskDecisions ?? []).map((rd: any) => (
                  <div
                    key={rd.id}
                    className="rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold text-white">
                        {rd.symbol} ({rd.executionMode}) — ${rd.requestedNotionalUsd}
                      </span>
                      <span
                        className={rd.approved ? "text-emerald-400" : "text-rose-400 font-semibold"}
                      >
                        {rd.approved ? "APPROVED" : `BLOCKED: ${rd.blockedGate}`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {(rd.reasonsJson ?? []).join(" ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* STRATEGY VERSIONING & ROLLBACK */}
            <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Auditable Strategy Versions & Parameter Rollback Lineage
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tracks autonomous tuning and enables instant deterministic rollback
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/ai", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ROLLBACK_STRATEGY",
                        strategyKey: "CROSS_VENUE_FUNDING_ARB",
                      }),
                    });
                    const j = await res.json();
                    setBanner({
                      type: j.ok ? "ok" : "warn",
                      text: j.ok
                        ? `Rolled back to verified version v${j.restoredVersion.versionNumber}.`
                        : j.error,
                    });
                    await refreshDashboard();
                  }}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rollback Last Change
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {(data?.strategyVersions ?? []).map((sv: any) => (
                  <div
                    key={sv.id}
                    className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold text-cyan-300">
                        {sv.strategyKey} • v{sv.versionNumber}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          sv.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {sv.isActive ? "ACTIVE" : sv.rolledBack ? "ROLLED BACK" : "ARCHIVED"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300">{sv.changeReason}</p>
                    <div className="mt-1.5 font-mono text-[10px] text-slate-400">
                      Params: {JSON.stringify(sv.parametersJson)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* TAB 6: SHOPIFY & BUSINESS HUB, BROKER ADAPTERS & SYSTEM AUDIT            */}
        {/* ======================================================================== */}
        {activeTab === "business_system" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* SHOPIFY & BUSINESS UNIT ECONOMICS HUB */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  Shopify & Business Revenue Hub (Preserved & Segregated)
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/business", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        channel: "SHOPIFY_STORE",
                        title: skuTitle,
                        skuOrRef: skuCode,
                        sellingPriceUsd: Number(skuPrice),
                        unitCostUsd: Number(skuCost),
                        adSpendPerSaleUsd: Number(skuAd),
                      }),
                    });
                    const j = await res.json();
                    if (j.ok) {
                      setBanner({
                        type: "ok",
                        text: `Evaluated Shopify SKU ${j.record.skuOrRef}: Net Contribution $${j.record.netContributionUsd}/unit (${j.record.status}) — strictly segregated from verified revenue.`,
                      });
                      await refreshDashboard();
                    }
                  }}
                  className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-800 bg-[#0B0F19] p-3.5 text-xs"
                >
                  <input
                    value={skuTitle}
                    onChange={(e) => setSkuTitle(e.target.value)}
                    placeholder="Product Title"
                    className="col-span-2 rounded border border-slate-700 bg-[#101623] px-2.5 py-1.5 text-white"
                  />
                  <input
                    value={skuPrice}
                    onChange={(e) => setSkuPrice(e.target.value)}
                    placeholder="Price USD"
                    className="rounded border border-slate-700 bg-[#101623] px-2.5 py-1.5 font-mono text-white"
                  />
                  <input
                    value={skuCost}
                    onChange={(e) => setSkuCost(e.target.value)}
                    placeholder="COGS USD"
                    className="rounded border border-slate-700 bg-[#101623] px-2.5 py-1.5 font-mono text-white"
                  />
                  <input
                    value={skuAd}
                    onChange={(e) => setSkuAd(e.target.value)}
                    placeholder="Ad CAC USD"
                    className="rounded border border-slate-700 bg-[#101623] px-2.5 py-1.5 font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="rounded bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Evaluate SKU Margin
                  </button>
                </form>

                <div className="space-y-2.5 text-xs">
                  {(data?.businessRecords ?? []).map((b: any) => (
                    <div
                      key={b.id}
                      className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{b.title}</span>
                        <span className="font-mono text-emerald-300">
                          +${b.netContributionUsd}/unit ({b.roasMultiple}x ROAS)
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{b.notes}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* BROKER & PAYMENT INTEGRATIONS INTERACTIVE TESTBENCH */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#101623] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  Payments & Broker Integrations (PayPal Sandbox, cTrader OAuth, MT5 Demo, Fomo)
                </h3>

                {integrationLog && (
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 font-mono text-[11px] text-cyan-200">
                    {integrationLog}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={async () => {
                      const r = await fetch("/api/integrations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ provider: "CTRADER_INIT_OAUTH" }),
                      });
                      const j = await r.json();
                      // Verify callback with generated CSRF state token!
                      const cb = await fetch(
                        `/api/integrations/ctrader/callback?state=${j.oauth.state}&code=auth_demo_9941`
                      );
                      const cbJson = await cb.json();
                      setIntegrationLog(
                        `cTrader OAuth CSRF State Verified: ${cbJson.valid} | Masked Token: ${cbJson.maskedToken} | ${cbJson.note}`
                      );
                      await refreshDashboard();
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-medium text-white hover:border-cyan-400"
                  >
                    Test cTrader OAuth + CSRF Callback
                  </button>

                  <button
                    onClick={async () => {
                      const r = await fetch("/api/integrations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          provider: "MT5_DEMO_TEST",
                          symbol: "BTCUSD",
                          side: "BUY",
                          lots: 0.5,
                        }),
                      });
                      const j = await r.json();
                      setIntegrationLog(
                        `MT5 Demo Ticket ${j.mt5.ticketId}: ${j.mt5.side} ${j.mt5.lots} ${j.mt5.symbol} @ $${j.mt5.fillPrice} (${j.mt5.accountMode})`
                      );
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-medium text-white hover:border-emerald-400"
                  >
                    Test MT5 Demo Order Execution
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {(data?.brokerConnections ?? []).map((c: any) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-800 bg-[#0B0F19] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{c.displayName}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                          {c.environmentMode} • {c.connectionStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{c.statusSummary}</p>
                      {c.blockerNotice && (
                        <p className="mt-1 text-[11px] text-amber-300/90">
                          Blocker / Policy: {c.blockerNotice}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        availableBalance={Number(portfolio.paperVaultAvailableUsd ?? 25000)}
        verifiedLiveBalance={Number(portfolio.verifiedLiveVaultUsd ?? 0)}
        onSuccess={() => refreshDashboard(false)}
      />
    </div>
  );
}
