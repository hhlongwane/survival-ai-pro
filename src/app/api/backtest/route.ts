import { db } from "@/db";
import { backtestRuns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { QuantStrategyFamily, runQuantitativeBacktest } from "@/lib/engine/backtester";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";
import { sanitizeSymbol } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    const runs = await db
      .select()
      .from(backtestRuns)
      .orderBy(desc(backtestRuns.createdAt))
      .limit(15);
    return Response.json({ ok: true, runs });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read backtest runs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSystemInitialized();
    const body = await req.json().catch(() => ({}));
    const symbol = sanitizeSymbol(body.symbol || "BTC");
    const validFamilies: QuantStrategyFamily[] = [
      "FUNDING_BASIS_ARB",
      "CROSS_VENUE_MOMENTUM",
      "BOLLINGER_MEAN_REVERSION",
      "REGIME_VOLATILITY_BREAKOUT",
    ];
    const strategyFamily: QuantStrategyFamily = validFamilies.includes(body.strategyFamily)
      ? body.strategyFamily
      : "FUNDING_BASIS_ARB";

    const result = await runQuantitativeBacktest({
      symbol,
      strategyFamily,
      initialCapital: Math.max(1000, Math.min(Number(body.initialCapital) || 10000, 1_000_000)),
      feeBpsPerSide: body.feeBpsPerSide !== undefined ? Number(body.feeBpsPerSide) : undefined,
      slippageBpsPerSide:
        body.slippageBpsPerSide !== undefined ? Number(body.slippageBpsPerSide) : undefined,
      leverage: body.leverage !== undefined ? Number(body.leverage) : 2,
    });

    const [saved] = await db
      .insert(backtestRuns)
      .values({
        strategyFamily: result.strategyFamily,
        symbol: result.symbol,
        dataSource: result.dataSource,
        candleCount: result.candleCount,
        initialCapital: result.initialCapital,
        finalEquity: result.finalEquity,
        totalReturnPct: result.totalReturnPct,
        benchmarkReturnPct: result.benchmarkReturnPct,
        inSampleReturnPct: result.inSampleReturnPct,
        outOfSampleReturnPct: result.outOfSampleReturnPct,
        maxDrawdownPct: result.maxDrawdownPct,
        sharpeRatio: result.sharpeRatio,
        sortinoRatio: result.sortinoRatio,
        winRatePct: result.winRatePct,
        profitFactor: result.profitFactor,
        expectancyUsd: result.expectancyUsd,
        totalTrades: result.totalTrades,
        totalFeesUsd: result.totalFeesUsd,
        isValidatedEdge: result.isValidatedEdge,
        verdictSummary: result.verdictSummary,
        equityCurveJson: result.equityCurve,
        stressTestsJson: result.stressTests,
        sensitivityJson: result.sensitivityGrid,
      })
      .returning();

    return Response.json({ ok: true, result, savedId: saved.id });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Backtest execution failed" },
      { status: 400 }
    );
  }
}
