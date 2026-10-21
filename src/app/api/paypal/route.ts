import {
  capturePayPalCheckoutOrder,
  createLiveOrSandboxPayPalCheckoutOrder,
  ensureLiveCapitalVaultExists,
} from "@/lib/engine/paypal-live";
import { getPublicMaskedCredentialsSummary } from "@/lib/engine/credentials-vault";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const [liveVault, creds] = await Promise.all([
    ensureLiveCapitalVaultExists(),
    getPublicMaskedCredentialsSummary(),
  ]);
  return Response.json({
    ok: true,
    liveVault,
    paypalStatus: creds.paypal,
  });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "paypal_live_checkout"), 45, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const requestedMode: "live" | "sandbox" | "auto" =
      body.mode === "live" || body.mode === "sandbox" ? body.mode : "auto";

    if (body.action === "CAPTURE_ORDER" && body.orderId) {
      const cap = await capturePayPalCheckoutOrder({
        orderId: String(body.orderId),
        mode: requestedMode === "live" ? "live" : "sandbox",
      });
      const httpCode = cap.ok ? 200 : "status" in cap && cap.status ? cap.status : 400;
      return Response.json(cap, { status: httpCode });
    }

    const origin = new URL(req.url).origin;
    const order = await createLiveOrSandboxPayPalCheckoutOrder({
      amountUsd: Number(body.amountUsd || 100),
      mode: requestedMode,
      returnOrigin: origin,
    });

    return Response.json(order, { status: order.status });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "PayPal checkout error" },
      { status: 400 }
    );
  }
}
