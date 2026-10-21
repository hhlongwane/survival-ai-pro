import { collectMultiVenueMarketIntelligence } from "@/lib/engine/market-data";
import { evaluateFundingAndBasisOpportunity } from "@/lib/engine/funding-basis";
import { runQuantitativeBacktest } from "@/lib/engine/backtester";
import { checkRateLimit, getClientKey, sanitizeSymbol } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "crypto_analyze"), 60, 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const symbol = sanitizeSymbol(body.symbol || "BTC");
    const notionalUsd = Math.max(250, Math.min(Number(body.notionalUsd) || 10000, 1_000_000));
    const holdingHours = Math.max(1, Math.min(Number(body.holdingHours) || 48, 720));

    if (!symbol) {
      return Response.json({ ok: false, error: "Valid 'symbol' parameter is required." }, { status: 400 });
    }

    const market = await collectMultiVenueMarketIntelligence();
    const asset = market.assets.find((a) => a.symbol === symbol);

    if (!asset) {
      return Response.json(
        {
          ok: false,
          error: `Symbol '${symbol}' not available in live verified exchange universe.`,
          supportedSymbols: market.assets.map((a) => a.symbol),
        },
        { status: 404 }
      );
    }

    // Evaluate all directional funding/basis pairs for this asset
    const pairEvaluations = [];
    for (let i = 0; i < asset.venues.length; i++) {
      for (let j = 0; j < asset.venues.length; j++) {
        if (i === j) continue;
        if (asset.venues[j].instrumentType !== "PERP") continue;
        pairEvaluations.push(
          evaluateFundingAndBasisOpportunity({
            symbol: asset.symbol,
            longLeg: asset.venues[i],
            shortLeg: asset.venues[j],
            positionNotionalUsd: notionalUsd,
            holdingHours,
            leveragePerLeg: 2,
            autoTradePermittedByAsset: asset.memeSafety.autoTradePermitted,
            assetRejectionNote: asset.memeSafety.policyRule,
          })
        );
      }
    }
    pairEvaluations.sort((a, b) => b.netExpectedReturnBps - a.netExpectedReturnBps);

    const walkForwardSummary = await runQuantitativeBacktest({
      symbol: asset.symbol,
      strategyFamily: "FUNDING_BASIS_ARB",
      initialCapital: 10000,
    });

    const bestPair = pairEvaluations[0] ?? null;

    return Response.json({
      ok: true,
      analyzedAt: new Date().toISOString(),
      symbol: asset.symbol,
      displayName: asset.displayName,
      marketIntelligence: {
        spotReferencePrice: asset.spotReferencePrice,
        realizedVolAnnualizedPct: asset.realizedVolAnnualizedPct,
        marketRegime: asset.marketRegime,
        liquidityScore: asset.liquidityScore,
        dataQualityScore: asset.dataQualityScore,
        isLiveExchangeData: market.isLiveExchangeData,
      },
      memeAndManipulationSafety: asset.memeSafety,
      venues: asset.venues,
      bestFundingAndBasisEvaluation: bestPair,
      allVenuePairEvaluations: pairEvaluations,
      quantitativeValidation: {
        dataSource: walkForwardSummary.dataSource,
        candleCount: walkForwardSummary.candleCount,
        totalReturnPct: walkForwardSummary.totalReturnPct,
        outOfSampleReturnPct: walkForwardSummary.outOfSampleReturnPct,
        sharpeRatio: walkForwardSummary.sharpeRatio,
        maxDrawdownPct: walkForwardSummary.maxDrawdownPct,
        isValidatedEdge: walkForwardSummary.isValidatedEdge,
        verdictSummary: walkForwardSummary.verdictSummary,
      },
      executionPolicy: {
        liveExecutionPermitted: false,
        paperAutoTradePermitted: Boolean(bestPair?.autoTradePermitted),
        summary: asset.memeSafety.isSpeculativeMeme
          ? `${asset.symbol} is analyzed strictly as a quantitative research subject. Popularity or nominal funding never triggers auto-execution.`
          : bestPair?.verdict === "EXECUTABLE_EDGE"
            ? `Defensible net paper edge (+${bestPair.netExpectedReturnBps} bps / ${bestPair.netCapitalAdjustedAprPct}% net locked-capital APR) after all 4-leg execution costs.`
            : bestPair?.rejectionReason ?? "Insufficient cross-venue spread to overcome fees and slippage.",
      },
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Crypto analysis failed" },
      { status: 500 }
    );
  }
}
