import { getMlStatus, ModelKey, trainOnlineMlModel } from "@/lib/engine/ml-learner";
import {
  executeAlphaPortfolioDeployAndCompound,
  generateHighProfitPortfolioPlan,
} from "@/lib/engine/profit-optimizer";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [ml, profitPlan] = await Promise.all([
      getMlStatus(),
      generateHighProfitPortfolioPlan(),
    ]);
    return Response.json({
      ok: true,
      ...ml,
      profitPlan,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read ML & Alpha Optimizer state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "ml_mutation"), 45, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "DEPLOY_AND_COMPOUND") {
      const compoundResult = await executeAlphaPortfolioDeployAndCompound(
        Math.max(4, Math.min(72, Number(body.simulateHours) || 24))
      );
      // Also run experiential ML reinforcement immediately after harvesting!
      const mlLearn = await trainOnlineMlModel({
        modelKey: "ALPHA_COMPOUNDER_ML",
        epochs: 12,
      });
      return Response.json({
        ok: true,
        compoundResult,
        mlLearn,
      });
    }

    const modelKey: ModelKey =
      body.modelKey === "SURVIVAL_CORE_ML" ? "SURVIVAL_CORE_ML" : "ALPHA_COMPOUNDER_ML";
    const epochs = Math.max(4, Math.min(40, Number(body.epochs) || 16));

    const trained = await trainOnlineMlModel({ modelKey, epochs });
    const profitPlan = await generateHighProfitPortfolioPlan();

    return Response.json({
      ok: true,
      ...trained,
      profitPlan,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "ML training or portfolio compounding action failed" },
      { status: 400 }
    );
  }
}
