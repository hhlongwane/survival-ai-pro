import { db } from "@/db";
import { riskDecisions } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  evaluateOrderSafetyGates,
  getActiveRiskPolicy,
  updateRiskPolicy,
} from "@/lib/engine/risk-gate";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    const [policy, decisions] = await Promise.all([
      getActiveRiskPolicy(),
      db.select().from(riskDecisions).orderBy(desc(riskDecisions.createdAt)).limit(40),
    ]);
    return Response.json({ ok: true, policy, decisions });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read risk configuration" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSystemInitialized();
    const body = await req.json();

    if (body.action === "RUN_SAFETY_DRILL") {
      // Runs real deterministic safety-gate verification drills (Live order block + TRUMP auto-trade block + Excessive Leverage block)
      const [liveDrill, memeDrill, levDrill] = await Promise.all([
        evaluateOrderSafetyGates({
          actionType: "ORDER_ENTRY",
          clientOrderId: `DRILL_LIVE_${Date.now()}`,
          symbol: "BTC",
          executionMode: "LIVE",
          requestedNotionalUsd: 2000,
          requiredMarginUsd: 1000,
          leverage: 2,
          estimatedSlippageBps: 3,
          minVenueDepthUsd: 50000,
          quoteAgeMs: 500,
          isSpeculativeMeme: false,
          isAutonomousRequest: false,
        }),
        evaluateOrderSafetyGates({
          actionType: "AUTONOMOUS_ARB_ENTRY",
          clientOrderId: `DRILL_TRUMP_${Date.now()}`,
          symbol: "TRUMP",
          executionMode: "PAPER",
          requestedNotionalUsd: 1500,
          requiredMarginUsd: 750,
          leverage: 2,
          estimatedSlippageBps: 4,
          minVenueDepthUsd: 25000,
          quoteAgeMs: 500,
          isSpeculativeMeme: true,
          isAutonomousRequest: true,
        }),
        evaluateOrderSafetyGates({
          actionType: "ORDER_ENTRY",
          clientOrderId: `DRILL_LEV_${Date.now()}`,
          symbol: "ETH",
          executionMode: "PAPER",
          requestedNotionalUsd: 3000,
          requiredMarginUsd: 300,
          leverage: 10,
          estimatedSlippageBps: 4,
          minVenueDepthUsd: 50000,
          quoteAgeMs: 500,
          isSpeculativeMeme: false,
          isAutonomousRequest: false,
        }),
      ]);

      return Response.json({
        ok: true,
        drillsPassed: !liveDrill.approved && !memeDrill.approved && !levDrill.approved,
        results: { liveDrill, memeDrill, levDrill },
      });
    }

    const updated = await updateRiskPolicy(
      {
        killSwitchActive:
          typeof body.killSwitchActive === "boolean" ? body.killSwitchActive : undefined,
        circuitBreakerTripped:
          typeof body.circuitBreakerTripped === "boolean"
            ? body.circuitBreakerTripped
            : undefined,
        maxSinglePositionPct:
          body.maxSinglePositionPct !== undefined
            ? Math.max(5, Math.min(50, Number(body.maxSinglePositionPct)))
            : undefined,
        maxPortfolioExposurePct:
          body.maxPortfolioExposurePct !== undefined
            ? Math.max(25, Math.min(300, Number(body.maxPortfolioExposurePct)))
            : undefined,
        maxLeverage:
          body.maxLeverage !== undefined
            ? Math.max(1, Math.min(5, Number(body.maxLeverage)))
            : undefined,
        maxDrawdownPct:
          body.maxDrawdownPct !== undefined
            ? Math.max(2, Math.min(25, Number(body.maxDrawdownPct)))
            : undefined,
        maxSlippageBps:
          body.maxSlippageBps !== undefined
            ? Math.max(2, Math.min(50, Number(body.maxSlippageBps)))
            : undefined,
      },
      "operator_ui"
    );

    return Response.json({ ok: true, policy: updated });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to update risk controls" },
      { status: 400 }
    );
  }
}
