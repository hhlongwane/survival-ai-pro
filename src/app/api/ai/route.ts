import { db } from "@/db";
import { aiDecisions, strategyVersions, systemConfigs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { rollbackStrategyVersion, runAutonomousAiCycle } from "@/lib/engine/autonomous-ai";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";
import { sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    const [decisions, versions, cfg] = await Promise.all([
      db.select().from(aiDecisions).orderBy(desc(aiDecisions.createdAt)).limit(40),
      db.select().from(strategyVersions).orderBy(desc(strategyVersions.createdAt)).limit(25),
      db.select().from(systemConfigs).where(eq(systemConfigs.configKey, "ai_controller")),
    ]);

    return Response.json({
      ok: true,
      controllerConfig: cfg[0]?.configValue ?? {},
      decisions,
      strategyVersions: versions,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to load AI learning status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSystemInitialized();
    const body = await req.json().catch(() => ({}));

    if (body.action === "ROLLBACK_STRATEGY") {
      const key = sanitizeText(body.strategyKey, 64) || "CROSS_VENUE_FUNDING_ARB";
      const rolled = await rollbackStrategyVersion(key);
      return Response.json({ ok: true, ...rolled });
    }

    const cycleResult = await runAutonomousAiCycle({
      simulateCarryWindowHours:
        body.simulateCarryWindowHours !== undefined
          ? Math.max(0, Math.min(48, Number(body.simulateCarryWindowHours)))
          : 8,
      maxNewTrades:
        body.maxNewTrades !== undefined
          ? Math.max(1, Math.min(4, Number(body.maxNewTrades)))
          : 2,
    });

    return Response.json({ ok: true, cycle: cycleResult });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Autonomous AI action failed" },
      { status: 400 }
    );
  }
}
