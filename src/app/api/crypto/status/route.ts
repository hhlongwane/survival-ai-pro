import { collectMultiVenueMarketIntelligence } from "@/lib/engine/market-data";
import { getActiveRiskPolicy } from "@/lib/engine/risk-gate";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "crypto_status"), 120, 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    await ensureSystemInitialized();
    const [market, riskPolicy] = await Promise.all([
      collectMultiVenueMarketIntelligence(),
      getActiveRiskPolicy(),
    ]);

    return Response.json({
      ok: true,
      status: market.isLiveExchangeData ? "LIVE_MULTI_VENUE_FEED" : "DETERMINISTIC_FALLBACK_FEED",
      fetchedAt: new Date(market.fetchedAtMs).toISOString(),
      globalRegime: market.globalRegime,
      executionGovernance: {
        liveCryptoExecutionEnabled:
          riskPolicy.liveExecutionAuthorized &&
          process.env.SURVIVAL_ALLOW_LIVE_EXECUTION === "true" &&
          Boolean(process.env.KRAKEN_API_KEY || process.env.COINBASE_API_KEY),
        paperTradingEnabled: !riskPolicy.killSwitchActive && !riskPolicy.circuitBreakerTripped,
        killSwitchActive: riskPolicy.killSwitchActive,
        memeAutoTradeBlocked: true,
      },
      venues: market.venueStatuses,
      trackedSymbolsCount: market.assets.length,
      trackedSymbols: market.assets.map((a) => ({
        symbol: a.symbol,
        spotReferencePrice: a.spotReferencePrice,
        regime: a.marketRegime,
        liquidityScore: a.liquidityScore,
        classification: a.memeSafety.classification,
        autoTradePermitted: a.memeSafety.autoTradePermitted,
      })),
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read crypto market status" },
      { status: 500 }
    );
  }
}
