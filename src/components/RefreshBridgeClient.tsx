"use client";

import React, { useState } from "react";
import { MlAndDualAppStudio } from "./MlAndDualAppStudio";
import { SimpleEasyDashboard } from "./SimpleEasyDashboard";
import { DepositModal } from "./DepositModal";

export function RefreshBridgeClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [simpleMode, setSimpleMode] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);
  const [autoPilot, setAutoPilot] = useState(false);

  async function refresh() {
    const res = await fetch("/api/dashboard?refresh=1", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setData(json);
  }

  async function runCompoundAndLearn() {
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
          )} profit!`,
        });
        await refresh();
      }
    } finally {
      setBusyLabel(null);
    }
  }

  async function quickTrade(gap: any) {
    setBusyLabel(`Starting trade on ${gap.symbol}...`);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: gap.symbol,
          structure: "HEDGED_CROSS_VENUE",
          longVenue: gap.longVenue,
          shortVenue: gap.shortVenue,
          notionalUsd: Math.min(4000, Math.max(1000, gap.positionNotionalUsd)),
          leverage: 2,
          executionMode: "PAPER",
        }),
      });
      const j = await res.json();
      setBanner({
        type: j.ok ? "ok" : "warn",
        text: j.ok
          ? `Started trade on ${gap.symbol} successfully!`
          : j.riskVerdict?.reasons?.[0] || j.error,
      });
      await refresh();
    } finally {
      setBusyLabel(null);
    }
  }

  async function closeTrade(id: number) {
    setBusyLabel("Closing trade & adding profit to balance...");
    try {
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE_POSITION", positionId: id }),
      });
      await refresh();
    } finally {
      setBusyLabel(null);
    }
  }

  React.useEffect(() => {
    if (!autoPilot) return;
    const t = setInterval(() => void runCompoundAndLearn(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPilot]);

  if (simpleMode) {
    return (
      <>
        <SimpleEasyDashboard
          data={data}
          busyLabel={busyLabel}
          banner={banner}
          onDismissBanner={() => setBanner(null)}
          autoPilotLoop={autoPilot}
          onToggleAutoPilot={() => setAutoPilot((v) => !v)}
          onRunAiCycle={runCompoundAndLearn}
          onOpenDepositModal={() => setDepositOpen(true)}
          onQuickTradeGap={quickTrade}
          onClosePosition={closeTrade}
          onHarvestAndCompound24h={runCompoundAndLearn}
          onRefresh={refresh}
          onSwitchToProMode={() => setSimpleMode(false)}
        />
        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          availableBalance={Number(data?.portfolio?.paperVaultAvailableUsd ?? 25000)}
          verifiedLiveBalance={Number(data?.portfolio?.verifiedLiveVaultUsd ?? 0)}
          onSuccess={refresh}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setSimpleMode(true)}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
        >
          Switch Back to Easy View
        </button>
      </div>
      <MlAndDualAppStudio
        mlStatus={data?.mlStatus}
        profitPlan={data?.profitPlan}
        credentialsSummary={data?.credentialsSummary}
        fxproSignals={data?.fxproSignals}
        verifiedLiveVaultUsd={Number(data?.portfolio?.verifiedLiveVaultUsd ?? 0)}
        onRefreshParent={refresh}
        standaloneMode={true}
      />
    </div>
  );
}
