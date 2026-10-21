import { db } from "@/db";
import { auditLogs, ledgerEntries, orders, positions, wallets } from "@/db/schema";
import { sql } from "drizzle-orm";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`select 1`);
    await ensureSystemInitialized();

    const [walletCount, ledgerCount, orderCount, posCount, auditCount] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(wallets),
      db.select({ c: sql<number>`count(*)::int` }).from(ledgerEntries),
      db.select({ c: sql<number>`count(*)::int` }).from(orders),
      db.select({ c: sql<number>`count(*)::int` }).from(positions),
      db.select({ c: sql<number>`count(*)::int` }).from(auditLogs),
    ]);

    return Response.json({
      ok: true,
      service: "survival-ai-recreation",
      persistence: {
        engine: "PostgreSQL (Durable Transactional Ledger)",
        healthy: true,
        latencyMs: Date.now() - start,
        counts: {
          wallets: walletCount[0]?.c ?? 0,
          ledgerEntries: ledgerCount[0]?.c ?? 0,
          orders: orderCount[0]?.c ?? 0,
          positions: posCount[0]?.c ?? 0,
          auditLogs: auditCount[0]?.c ?? 0,
        },
      },
      safety: {
        liveExecutionEnabled: false,
        paperExecutionEnabled: true,
        originalRepoTouched: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Database health probe failed" },
      { status: 500 }
    );
  }
}
