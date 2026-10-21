import { getPublicMaskedCredentialsSummary } from "@/lib/engine/credentials-vault";

export const dynamic = "force-dynamic";

export async function GET() {
  const creds = await getPublicMaskedCredentialsSummary();
  const isLive = creds.paypal.liveConfigured;

  return Response.json({
    configured: Boolean(isLive || creds.paypal.sandboxConfigured),
    environment: isLive ? "live" : "sandbox",
    live_enabled: isLive,
    sandbox_api_verified: creds.paypal.sandboxConfigured,
    api_base: isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  });
}
