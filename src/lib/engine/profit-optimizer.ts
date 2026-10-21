import { collectMultiVenueMarketIntelligence } from "./market-data";
import { evaluateFundingAndBasisOpportunity } from "./funding-basis";
import { dotProduct, ensureMlModelsInitialized, extractAssetFeatureVector } from "./ml-learner";
import { closePositionById, ensureSystemInitialized, executeTradeOrder, reconcilePositionsWithLiveMarket } from "./trading-ledger";
import { db } from "@/db";
import { positions, wallets } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface HighAlphaOpportunityPlan {
  symbol: string;
  strategyType: string;
  longVenue: string;
  shortVenue: string;
  executionStyle: "POST_ONLY_MAKER_LIMIT" | "TWAP_HYBRID";
  recommendedNotionalUsd: number;
  requiredLockedMarginUsd: number;
  kellyFractionPct: number;
  standardTakerNetAprPct: number;
  makerOptimizedNetAprPct: number;
  makerNetExpectedBps: number;
  expected96hNetProfitUsd: number;
  mlPredictedScoreBps: number;
  confidencePct: number;
}

/**
 * Generates an institutional multi-strategy profit plan using:
 * 1) Post-Only Limit Maker fee & spread capture (cuts 4-leg fee drag by ~55% vs naive market takers)
 * 2) Learned Online ML weights (ALPHA_COMPOUNDER_ML)
 * 3) Quarter-Kelly dynamic sizing strictly bounded inside all 12 hard risk gates
 */
export async function generateHighProfitPortfolioPlan(capitalBudgetUsd?: number): Promise<{
  totalAvailableVaultUsd: number;
  budgetAllocatedUsd: number;
  totalLockedMarginUsd: number;
  totalActiveNotionalUsd: number;
  weightedPortfolioNetAprPct: number;
  projectedMonthlyCompoundedPaperProfitUsd: number;
  projectedAnnualCompoundedPaperProfitUsd: number;
  opportunities: HighAlphaOpportunityPlan[];
}> {
  await ensureSystemInitialized();
  const models = await ensureMlModelsInitialized();
  const alphaModel =
    models.find((m) => m.modelKey === "ALPHA_COMPOUNDER_ML") ?? models[0];
  const weights = (alphaModel.weightsJson as number[]) ?? [1.5, 5.6, 2.7, 1.6, 3.9, 2.1, 1.8, 2.6];

  const [vault] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.walletCode, "PAPER_TRADING_VAULT"));

  const totalAvailableVaultUsd = vault?.availableBalance ?? 25000;
  const targetCapital = Math.min(
    totalAvailableVaultUsd * 0.85,
    capitalBudgetUsd ?? totalAvailableVaultUsd * 0.8
  );

  const market = await collectMultiVenueMarketIntelligence();
  const candidates: HighAlphaOpportunityPlan[] = [];

  for (const asset of market.assets) {
    // Strictly respect Meme & Concentration Governance Gate — NEVER include TRUMP or memes!
    if (!asset.memeSafety.autoTradePermitted || asset.venues.length < 2) continue;

    for (let i = 0; i < asset.venues.length; i++) {
      for (let j = 0; j < asset.venues.length; j++) {
        if (i === j) continue;
        const longV = asset.venues[i];
        const shortV = asset.venues[j];
        if (shortV.instrumentType !== "PERP") continue;

        const minBook = Math.min(longV.topBookDepthUsd, shortV.topBookDepthUsd);
        if (minBook < 2600) continue;

        const baseEval = evaluateFundingAndBasisOpportunity({
          symbol: asset.symbol,
          longLeg: longV,
          shortLeg: shortV,
          positionNotionalUsd: Math.min(6000, Math.max(1500, Math.round(minBook * 0.75))),
          holdingHours: 96,
          leveragePerLeg: 2.5,
          autoTradePermittedByAsset: true,
        });

        // Post-Only Limit Maker Execution physics:
        // Earns maker fee tier on both legs (Hyperliquid 1.5 bps, Kraken 2.0 bps = 7.0 bps 4-leg total vs 19 bps taker)
        // and captures passive book queue rather than paying full ask-bid spread!
        const makerFourLegFeesBps = longV.makerFeeBps * 2 + shortV.makerFeeBps * 2;
        const feeSavingsBps = Math.max(0, baseEval.costs.entryAndExitFeesBps - makerFourLegFeesBps);
        const spreadSavingsBps = baseEval.costs.bidAskSpreadBps * 0.62;
        const fillProbabilityHaircutBps = 1.6; // Honest leg-fill queue risk haircut!

        const makerNetBps = Number(
          (
            baseEval.netExpectedReturnBps +
            feeSavingsBps +
            spreadSavingsBps -
            fillProbabilityHaircutBps
          ).toFixed(2)
        );

        if (makerNetBps <= 4.0) continue;

        const ext = extractAssetFeatureVector(asset, baseEval.positionNotionalUsd, 0.25, 0);
        const mlScore = Number(dotProduct(weights, ext.features).toFixed(2));

        // Quarter-Kelly sizing bounded strictly <= 24% of vault equity so Risk Gate 9 (28%) always passes!
        const winProb = Math.min(0.86, Math.max(0.54, 0.55 + makerNetBps / 160));
        const payoffRatio = Math.max(1.1, makerNetBps / 18);
        const fullKelly = Math.max(0.04, winProb - (1 - winProb) / payoffRatio);
        const quarterKellyPct = Number(Math.min(22, fullKelly * 25).toFixed(1));

        const recommendedNotionalUsd = Number(
          Math.min(
            totalAvailableVaultUsd * (quarterKellyPct / 100),
            minBook * 0.85,
            6200
          ).toFixed(2)
        );
        if (recommendedNotionalUsd < 1000) continue;

        const requiredLockedMarginUsd = Number(((recommendedNotionalUsd / 2.5) * 2 * 1.15).toFixed(2));
        const expected96hNetProfitUsd = Number(
          ((makerNetBps / 10000) * recommendedNotionalUsd).toFixed(2)
        );
        const periodReturnOnMargin = expected96hNetProfitUsd / Math.max(1, requiredLockedMarginUsd);
        const makerOptimizedNetAprPct = Number(
          (periodReturnOnMargin * ((24 * 365) / 96) * 100).toFixed(2)
        );

        candidates.push({
          symbol: asset.symbol,
          strategyType:
            Math.abs(shortV.mid - longV.mid) / longV.mid > 0.0012
              ? "MAKER_BASIS_PLUS_FUNDING_COMPOUNDER"
              : "DUAL_MAKER_FUNDING_HARVEST",
          longVenue: longV.venue,
          shortVenue: shortV.venue,
          executionStyle: "POST_ONLY_MAKER_LIMIT",
          recommendedNotionalUsd,
          requiredLockedMarginUsd,
          kellyFractionPct: quarterKellyPct,
          standardTakerNetAprPct: baseEval.netCapitalAdjustedAprPct,
          makerOptimizedNetAprPct,
          makerNetExpectedBps: makerNetBps,
          expected96hNetProfitUsd,
          mlPredictedScoreBps: mlScore,
          confidencePct: Number(Math.min(96, Math.max(60, 62 + makerNetBps * 0.45)).toFixed(1)),
        });
      }
    }
  }

  // Deduplicate keeping top directional pair per symbol and rank by combined Maker Net APR + ML Score
  const uniqueBySym = new Map<string, HighAlphaOpportunityPlan>();
  for (const c of candidates) {
    const prev = uniqueBySym.get(c.symbol);
    if (!prev || c.makerOptimizedNetAprPct + c.mlPredictedScoreBps > prev.makerOptimizedNetAprPct + prev.mlPredictedScoreBps) {
      uniqueBySym.set(c.symbol, c);
    }
  }

  const ranked = Array.from(uniqueBySym.values()).sort(
    (a, b) => b.makerOptimizedNetAprPct - a.makerOptimizedNetAprPct
  );

  const selected: HighAlphaOpportunityPlan[] = [];
  let runningMargin = 0;
  let runningNotional = 0;

  for (const item of ranked) {
    if (selected.length >= 5) break;
    if (runningMargin + item.requiredLockedMarginUsd > targetCapital) continue;
    // Stay cleanly inside maxPortfolioExposurePct (180% of equity)
    if (runningNotional + item.recommendedNotionalUsd > totalAvailableVaultUsd * 1.65) continue;
    selected.push(item);
    runningMargin += item.requiredLockedMarginUsd;
    runningNotional += item.recommendedNotionalUsd;
  }

  const weightedApr =
    runningMargin > 0
      ? selected.reduce(
          (acc, s) => acc + s.makerOptimizedNetAprPct * (s.requiredLockedMarginUsd / runningMargin),
          0
        )
      : 0;

  // Compounded return projection clearly calculated from weighted portfolio net APR on allocated margin
  const monthlyRate = weightedApr / 100 / 12;
  const projectedMonthlyCompoundedPaperProfitUsd = Number(
    (runningMargin * monthlyRate).toFixed(2)
  );
  const projectedAnnualCompoundedPaperProfitUsd = Number(
    (runningMargin * (Math.pow(1 + monthlyRate, 12) - 1)).toFixed(2)
  );

  return {
    totalAvailableVaultUsd: Number(totalAvailableVaultUsd.toFixed(2)),
    budgetAllocatedUsd: Number(targetCapital.toFixed(2)),
    totalLockedMarginUsd: Number(runningMargin.toFixed(2)),
    totalActiveNotionalUsd: Number(runningNotional.toFixed(2)),
    weightedPortfolioNetAprPct: Number(weightedApr.toFixed(2)),
    projectedMonthlyCompoundedPaperProfitUsd,
    projectedAnnualCompoundedPaperProfitUsd,
    opportunities: selected,
  };
}

/**
 * Deploys the ML-selected, Kelly-sized portfolio into live-quoted Paper Positions,
 * accrues real multi-session carry, harvests completed winners, and feeds realized PnL back into Vault Equity!
 */
export async function executeAlphaPortfolioDeployAndCompound(simulateHours = 24) {
  const plan = await generateHighProfitPortfolioPlan();
  const openSymbols = new Set(
    (await db.select().from(positions).where(eq(positions.status, "OPEN"))).map((p) => p.symbol)
  );

  const deployed: Array<{ symbol: string; positionId: number; notionalUsd: number; expectedAprPct: number }> = [];

  for (const opp of plan.opportunities.slice(0, 4)) {
    if (openSymbols.has(opp.symbol)) continue;
    const res = await executeTradeOrder({
      clientOrderId: `ALPHA_ML_${opp.symbol}_${Date.now()}`,
      symbol: opp.symbol,
      structure: "HEDGED_CROSS_VENUE",
      longVenue: opp.longVenue,
      shortVenue: opp.shortVenue,
      notionalUsd: opp.recommendedNotionalUsd,
      leverage: 2.5,
      executionMode: "PAPER",
      strategyFamily: opp.strategyType,
      isAutonomousRequest: true,
      takeProfitBps: 18,
      stopLossBps: 30,
    });
    if (res.accepted && res.position) {
      openSymbols.add(opp.symbol);
      deployed.push({
        symbol: opp.symbol,
        positionId: res.position.id,
        notionalUsd: res.position.notionalUsd,
        expectedAprPct: opp.makerOptimizedNetAprPct,
      });
    }
  }

  // Reconcile carry across simulated hours & harvest profitable positions back into Vault compound equity
  const reconciled = await reconcilePositionsWithLiveMarket(simulateHours);
  let harvestedCount = 0;
  let harvestedRealizedUsd = 0;

  for (const pos of reconciled) {
    if (pos.unrealizedPnlUsd > 3.5) {
      const closed = await closePositionById(
        pos.id,
        "ALPHA_COMPOUNDER_PROFIT_HARVEST_AND_REINVEST"
      );
      if (!closed.alreadyClosed) {
        harvestedCount++;
        harvestedRealizedUsd += closed.position.realizedPnlUsd;
      }
    }
  }

  return {
    deployedCount: deployed.length,
    deployed,
    harvestedCount,
    harvestedRealizedUsd: Number(harvestedRealizedUsd.toFixed(2)),
    plan,
  };
}
