import { db } from "@/db";
import {
  aiDecisions,
  auditLogs,
  backtestRuns,
  brokerConnections,
  businessRecords,
  ledgerEntries,
  orders,
  positions,
  riskDecisions,
  strategyVersions,
  wallets,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { collectMultiVenueMarketIntelligence } from "@/lib/engine/market-data";
import { scanAllMarketGaps } from "@/lib/engine/funding-basis";
import { getActiveRiskPolicy } from "@/lib/engine/risk-gate";
import {
  ensureSystemInitialized,
  reconcilePositionsWithLiveMarket,
} from "@/lib/engine/trading-ledger";
import { getMlStatus } from "@/lib/engine/ml-learner";
import { generateHighProfitPortfolioPlan } from "@/lib/engine/profit-optimizer";
import { ensureLiveCapitalVaultExists } from "@/lib/engine/paypal-live";
import { getPublicMaskedCredentialsSummary } from "@/lib/engine/credentials-vault";
import { scanLiveFxProAndGoldOpportunities } from "@/lib/engine/fxpro-connector";
import { getApexIntelligenceSnapshot } from "@/lib/engine/apex-brain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSystemInitialized();
    const url = new URL(req.url);
    const forceLive = url.searchParams.get("refresh") === "1";

    await ensureLiveCapitalVaultExists();
    const [market, riskPolicy, mlStatus, profitPlan, credentialsSummary, fxproSignals, apexBrain] =
      await Promise.all([
        collectMultiVenueMarketIntelligence(forceLive),
        getActiveRiskPolicy(),
        getMlStatus(),
        generateHighProfitPortfolioPlan(),
        getPublicMaskedCredentialsSummary(),
        scanLiveFxProAndGoldOpportunities(),
        getApexIntelligenceSnapshot(),
      ]);

    await reconcilePositionsWithLiveMarket(0);

    const [
      allWallets,
      allPositions,
      recentOrders,
      recentLedger,
      recentRisk,
      recentAi,
      strats,
      recentBacktests,
      bizRecords,
      brokers,
      audits,
    ] = await Promise.all([
      db.select().from(wallets),
      db.select().from(positions).orderBy(desc(positions.openedAt)).limit(50),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(30),
      db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).limit(30),
      db.select().from(riskDecisions).orderBy(desc(riskDecisions.createdAt)).limit(25),
      db.select().from(aiDecisions).orderBy(desc(aiDecisions.createdAt)).limit(25),
      db.select().from(strategyVersions).orderBy(desc(strategyVersions.createdAt)).limit(15),
      db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt)).limit(10),
      db.select().from(businessRecords).orderBy(desc(businessRecords.createdAt)).limit(20),
      db.select().from(brokerConnections),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(30),
    ]);

    const paperVault = allWallets.find((w) => w.walletCode === "PAPER_TRADING_VAULT") ?? {
      availableBalance: 25000,
      lockedMargin: 0,
      realizedPnl: 0,
      totalDeposited: 25000,
    };

    const openPositions = allPositions.filter((p) => p.status === "OPEN");
    const closedPositions = allPositions.filter((p) => p.status !== "OPEN");
    const unrealizedPnlUsd = Number(
      openPositions.reduce((s, p) => s + p.unrealizedPnlUsd, 0).toFixed(2)
    );
    const totalAccruedFundingUsd = Number(
      allPositions.reduce((s, p) => s + p.accruedFundingUsd, 0).toFixed(2)
    );
    const totalPaperEquityUsd = Number(
      (paperVault.availableBalance + paperVault.lockedMargin + unrealizedPnlUsd).toFixed(2)
    );
    const netPaperPnlUsd = Number((paperVault.realizedPnl + unrealizedPnlUsd).toFixed(2));

    const marketGaps = scanAllMarketGaps(market.assets, 10000, 48);

    const liveCapitalVault = allWallets.find((w) => w.walletCode === "LIVE_CAPITAL_VAULT") ?? {
      availableBalance: 0,
      lockedMargin: 0,
      realizedPnl: 0,
      totalDeposited: 0,
    };

    const verifiedBusinessRevenueUsd = bizRecords
      .filter((r) => r.isVerifiedRealRevenue)
      .reduce((s, r) => s + r.netContributionUsd, 0);

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      market,
      marketGaps,
      portfolio: {
        paperVaultAvailableUsd: paperVault.availableBalance,
        paperVaultLockedMarginUsd: paperVault.lockedMargin,
        paperRealizedPnlUsd: paperVault.realizedPnl,
        paperUnrealizedPnlUsd: unrealizedPnlUsd,
        totalPaperEquityUsd,
        netPaperPnlUsd,
        totalDepositedPaperUsd: paperVault.totalDeposited,
        totalAccruedFundingUsd,
        verifiedLiveVaultUsd: liveCapitalVault.availableBalance,
        verifiedLiveBrokerBalanceUsd: null,
        verifiedBusinessRealRevenueUsd: Number(verifiedBusinessRevenueUsd.toFixed(2)),
      },
      credentialsSummary,
      fxproSignals,
      apexBrain,
      wallets: allWallets,
      openPositions,
      closedPositions,
      recentOrders,
      recentLedger,
      riskPolicy,
      recentRiskDecisions: recentRisk,
      aiDecisions: recentAi,
      strategyVersions: strats,
      backtestRuns: recentBacktests,
      businessRecords: bizRecords,
      brokerConnections: brokers,
      auditLogs: audits,
      mlStatus,
      profitPlan,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Dashboard aggregation error" },
      { status: 500 }
    );
  }
}
