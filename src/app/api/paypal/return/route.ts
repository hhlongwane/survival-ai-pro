import { NextResponse } from "next/server";
import { capturePayPalCheckoutOrder } from "@/lib/engine/paypal-live";

export const dynamic = "force-dynamic";

/**
 * Automatic PayPal Redirect Return Handler (`/api/paypal/return?token=...&mode=live`):
 * When the user approves real money on their Android phone PayPal app or browser,
 * PayPal redirects right here — automatically capturing the payment into `LIVE_CAPITAL_VAULT`
 * and sending them cleanly back into the app with confirmation!
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const mode: "live" | "sandbox" = url.searchParams.get("mode") === "sandbox" ? "sandbox" : "live";

  if (!orderId) {
    return NextResponse.redirect(new URL("/?paypal=missing_token", req.url));
  }

  const captured = await capturePayPalCheckoutOrder({ orderId, mode });
  if (captured.ok) {
    return NextResponse.redirect(
      new URL(`/?paypal=captured&mode=${mode}&order=${encodeURIComponent(orderId)}`, req.url)
    );
  }

  const errReason = "error" in captured && captured.error ? captured.error : "capture_failed";
  return NextResponse.redirect(
    new URL(`/?paypal=error&reason=${encodeURIComponent(errReason)}`, req.url)
  );
}
