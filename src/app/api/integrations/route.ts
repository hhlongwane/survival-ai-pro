import { db } from "@/db";
import { brokerConnections, paymentEvents } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  createPayPalSandboxOrder,
  executeMt5DemoAction,
  initiateCTraderOAuthFlow,
  processPayPalSandboxWebhook,
} from "@/lib/engine/integrations";
import { ensureSystemInitialized } from "@/lib/engine/trading-ledger";
import { sanitizeSymbol, sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemInitialized();
    const [connections, recentPayments] = await Promise.all([
      db.select().from(brokerConnections),
      db.select().from(paymentEvents).orderBy(desc(paymentEvents.createdAt)).limit(20),
    ]);
    return Response.json({ ok: true, connections, recentPayments });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read integrations status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSystemInitialized();
    const body = await req.json();

    if (body.provider === "PAYPAL_SANDBOX_CREATE_AND_CAPTURE") {
      const amountUsd = Math.max(10, Math.min(250000, Number(body.amountUsd || 2500)));
      const idemKey =
        sanitizeText(body.idempotencyKey, 80) || `PP_SBX_${Date.now()}`;
      const order = await createPayPalSandboxOrder(amountUsd, idemKey);
      const capture = await processPayPalSandboxWebhook({
        rawBody: order.webhookPayload,
        signatureHex: order.webhookSignature,
      });
      // Also test duplicate webhook replay protection if requested!
      const replayCheck = body.verifyDuplicateProtection
        ? await processPayPalSandboxWebhook({
            rawBody: order.webhookPayload,
            signatureHex: order.webhookSignature,
          })
        : null;

      return Response.json({
        ok: capture.ok,
        order,
        capture,
        replayCheck,
      });
    }

    if (body.provider === "CTRADER_INIT_OAUTH") {
      const oauth = await initiateCTraderOAuthFlow();
      return Response.json({ ok: true, oauth });
    }

    if (body.provider === "MT5_DEMO_TEST") {
      const mt5 = await executeMt5DemoAction({
        symbol: sanitizeSymbol(body.symbol || "BTCUSD"),
        side: body.side === "SELL" ? "SELL" : "BUY",
        lots: Number(body.lots || 0.25),
        requestLiveExecution: Boolean(body.requestLiveExecution),
      });
      return Response.json({ ok: mt5.accepted, mt5 }, { status: mt5.accepted ? 200 : 403 });
    }

    return Response.json({ ok: false, error: "Unsupported integration provider action." }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Integration action failed" },
      { status: 400 }
    );
  }
}
