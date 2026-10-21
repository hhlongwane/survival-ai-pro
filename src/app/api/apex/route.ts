import {
  getApexIntelligenceSnapshot,
  runApexSovereignSuperCycle,
} from "@/lib/engine/apex-brain";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getApexIntelligenceSnapshot();
    return Response.json({ ok: true, ...snapshot });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read Apex Neural Intelligence state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "apex_supercycle"), 45, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const simulateHours = Math.max(4, Math.min(72, Number(body.simulateHours) || 24));
    const result = await runApexSovereignSuperCycle(simulateHours);
    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Apex Super-Cycle execution failed" },
      { status: 400 }
    );
  }
}
