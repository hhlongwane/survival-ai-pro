import { db } from "@/db";
import { orders, positions } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  closePositionById,
  ensureSystemInitialized,
  executeTradeOrder,
  reconcilePositionsWithLiveMarket,
} from "@/lib/engine/trading-ledger";
import { checkRateLimit, getClientKey, sanitizeSymbol, sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    await reconcilePositionsWithLiveMarket(0);
    const [allPositions, allOrders] = await Promise.all([
      db.select().from(positions).orderBy(desc(positions.openedAt)).limit(60),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(60),
    ]);

    return Response.json({
      ok: true,
      openPositions: allPositions.filter((p) => p.status === "OPEN"),
      closedPositions: allPositions.filter((p) => p.status !== "OPEN"),
      orders: allOrders,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read positions and orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "trades_mutation"), 60, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();

    if (body.action === "CLOSE_POSITION") {
      const positionId = Number(body.positionId);
      const closed = await closePositionById(
        positionId,
        sanitizeText(body.reason, 80) || "OPERATOR_MANUAL_CLOSE"
      );
      return Response.json({ ok: true, ...closed });
    }

    if (body.action === "RECONCILE_CARRY") {
      const hours = Math.max(0, Math.min(Number(body.hours) || 8, 72));
      const updated = await reconcilePositionsWithLiveMarket(hours);
      return Response.json({ ok: true, reconciledPositions: updated, simulatedHours: hours });
    }

    const symbol = sanitizeSymbol(body.symbol || "BTC");
    const result = await executeTradeOrder({
      clientOrderId:
        sanitizeText(body.clientOrderId, 96) || `ORD_${symbol}_${Date.now()}`,
      symbol,
      structure: body.structure || "HEDGED_CROSS_VENUE",
      longVenue: body.longVenue,
      shortVenue: body.shortVenue,
      notionalUsd: Number(body.notionalUsd || 2500),
      leverage: Number(body.leverage || 2),
      executionMode: body.executionMode || "PAPER",
      strategyFamily: sanitizeText(body.strategyFamily, 64) || "CROSS_VENUE_FUNDING_ARB",
      isAutonomousRequest: false,
      manualMemeResearchAck: Boolean(body.manualMemeResearchAck),
      takeProfitBps: body.takeProfitBps ? Number(body.takeProfitBps) : 40,
      stopLossBps: body.stopLossBps ? Number(body.stopLossBps) : 35,
    });

    return Response.json(
      { ok: result.accepted, ...result },
      { status: result.accepted ? 200 : 422 }
    );
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Order submission failed" },
      { status: 400 }
    );
  }
}
