import { runApexSovereignSuperCycle } from "@/lib/engine/apex-brain";

export const dynamic = "force-dynamic";

/**
 * Automatic Background AI Cron Endpoint (Triggered automatically by Vercel Cron in `vercel.json`):
 * Runs the full 3-Model Neural Meta-Brain + Crypto/Triangular/FxPro cycle automatically in the cloud!
 */
export async function GET() {
  try {
    const result = await runApexSovereignSuperCycle(24);
    return Response.json({
      ok: true,
      mode: "VERCEL_CLOUD_AUTONOMOUS_CRON",
      executedAt: new Date().toISOString(),
      generation: result.ensemble.generation,
      accuracyPct: result.ensemble.ensembleAccuracyPct,
      openedCount: result.openedCount,
      harvestedUsd: result.harvestedUsd,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Cloud cron execution error" },
      { status: 500 }
    );
  }
}
