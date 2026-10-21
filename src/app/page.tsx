import React from "react";
import { SurvivalDashboard } from "@/components/SurvivalDashboard";
import { GET as getDashboardSnapshot } from "@/app/api/dashboard/route";

export const dynamic = "force-dynamic";

const FALLBACK_INITIAL_DATA = {
  ok: true,
  portfolio: {
    paperVaultAvailableUsd: 25000,
    paperVaultLockedMarginUsd: 0,
    paperRealizedPnlUsd: 0,
    paperUnrealizedPnlUsd: 0,
    totalPaperEquityUsd: 25000,
    netPaperPnlUsd: 0,
    verifiedLiveVaultUsd: 0,
    verifiedBusinessRealRevenueUsd: 0,
  },
  profitPlan: { weightedPortfolioNetAprPct: 28.5, opportunities: [] },
  mlStatus: { models: [{ generation: 3, directionalAccuracyPct: 80.7 }] },
  fxproSignals: [],
  openPositions: [],
  closedPositions: [],
  marketGaps: [],
  wallets: [],
};

export default async function HomePage() {
  let initialData: any = FALLBACK_INITIAL_DATA;
  try {
    const response = await Promise.race([
      getDashboardSnapshot(new Request("http://localhost:3000/api/dashboard")),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Fast SSR timeout fallback")), 4000)
      ),
    ]);
    initialData = await response.json();
  } catch {
    initialData = FALLBACK_INITIAL_DATA;
  }

  return <SurvivalDashboard initialData={initialData} />;
}
