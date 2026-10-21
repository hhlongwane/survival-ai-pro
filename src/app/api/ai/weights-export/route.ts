import { getMlStatus } from "@/lib/engine/ml-learner";
import { generateHighProfitPortfolioPlan } from "@/lib/engine/profit-optimizer";

export const dynamic = "force-dynamic";

export async function GET() {
  const [ml, profitPlan] = await Promise.all([
    getMlStatus(),
    generateHighProfitPortfolioPlan(),
  ]);

  const payload = JSON.stringify(
    {
      package: "survival-ai-trained-quant-brain",
      exportedAt: new Date().toISOString(),
      models: ml.models,
      liveHighProfitPortfolioPlan: profitPlan,
    },
    null,
    2
  );

  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="survival-ai-trained-brain.json"',
      "Cache-Control": "no-store",
    },
  });
}
