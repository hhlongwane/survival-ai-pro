import { collectMultiVenueMarketIntelligence } from "@/lib/engine/market-data";
import { scanAllMarketGaps } from "@/lib/engine/funding-basis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const notionalUsd = Math.max(500, Math.min(Number(url.searchParams.get("notionalUsd")) || 10000, 500_000));
    const holdingHours = Math.max(1, Math.min(Number(url.searchParams.get("holdingHours")) || 48, 720));

    const market = await collectMultiVenueMarketIntelligence();
    const gaps = scanAllMarketGaps(market.assets, notionalUsd, holdingHours);

    return Response.json({
      ok: true,
      fetchedAt: new Date(market.fetchedAtMs).toISOString(),
      isLiveExchangeData: market.isLiveExchangeData,
      notionalUsd,
      holdingHours,
      executableCount: gaps.filter((g) => g.verdict === "EXECUTABLE_EDGE").length,
      researchBlockedCount: gaps.filter((g) => g.verdict === "RESEARCH_ONLY_NO_AUTO_TRADE").length,
      rejectedFrictionCount: gaps.filter(
        (g) => g.verdict === "REJECTED_NEGATIVE_NET_EDGE" || g.verdict === "REJECTED_THIN_LIQUIDITY"
      ).length,
      gaps,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to scan market gaps" },
      { status: 500 }
    );
  }
}
