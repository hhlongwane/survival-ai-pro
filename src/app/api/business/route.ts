import { db } from "@/db";
import { businessRecords } from "@/db/schema";
import { desc } from "drizzle-orm";
import { evaluateAndRecordBusinessOpportunity } from "@/lib/engine/integrations";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";
import { sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    const records = await db
      .select()
      .from(businessRecords)
      .orderBy(desc(businessRecords.createdAt))
      .limit(40);

    const verifiedRealRevenueUsd = records
      .filter((r) => r.isVerifiedRealRevenue)
      .reduce((s, r) => s + r.netContributionUsd, 0);

    const modeledUnitContributionUsd = records
      .filter((r) => !r.isVerifiedRealRevenue)
      .reduce((s, r) => s + r.netContributionUsd, 0);

    return Response.json({
      ok: true,
      shopifyConnected: Boolean(
        process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN
      ),
      summary: {
        verifiedRealRevenueUsd: Number(verifiedRealRevenueUsd.toFixed(2)),
        modeledUnitContributionUsd: Number(modeledUnitContributionUsd.toFixed(2)),
        activeWorkflowsCount: records.length,
        accountingSeparationRule:
          "Verified real business revenue is strictly segregated from simulated paper trading PnL and unverified store unit-economics models.",
      },
      records,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read business hub data" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSystemInitialized();
    const body = await req.json();
    const record = await evaluateAndRecordBusinessOpportunity({
      channel:
        body.channel === "DIGITAL_AUTOMATION" || body.channel === "B2B_WORKFLOW"
          ? body.channel
          : "SHOPIFY_STORE",
      title: sanitizeText(body.title, 120) || "New Shopify SKU Evaluation",
      skuOrRef: sanitizeText(body.skuOrRef, 40) || `SKU-${Date.now()}`,
      sellingPriceUsd: Math.max(1, Number(body.sellingPriceUsd || 79)),
      unitCostUsd: Math.max(0, Number(body.unitCostUsd || 28)),
      adSpendPerSaleUsd: Math.max(0, Number(body.adSpendPerSaleUsd || 18)),
      paymentFeePct: body.paymentFeePct !== undefined ? Number(body.paymentFeePct) : 2.9,
    });
    return Response.json({ ok: true, record });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to evaluate business opportunity" },
      { status: 400 }
    );
  }
}
