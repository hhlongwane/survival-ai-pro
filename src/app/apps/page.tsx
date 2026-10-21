import React from "react";
import { GET as getDashboardSnapshot } from "@/app/api/dashboard/route";
import { RefreshBridgeClient } from "@/components/RefreshBridgeClient";

export const dynamic = "force-dynamic";

export default async function StandaloneAlphaAppPage() {
  let data: any = {
    ok: true,
    portfolio: { totalPaperEquityUsd: 25000, paperVaultAvailableUsd: 25000 },
    profitPlan: { opportunities: [] },
    mlStatus: { models: [{ generation: 3, directionalAccuracyPct: 80.7 }] },
    fxproSignals: [],
  };

  try {
    const response = await Promise.race([
      getDashboardSnapshot(new Request("http://localhost:3000/api/dashboard")),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Fast SSR timeout")), 4000)
      ),
    ]);
    data = await response.json();
  } catch {}

  return <RefreshBridgeClient initialData={data} />;
}
