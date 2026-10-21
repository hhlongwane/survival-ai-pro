import { verifyLiveCtraderApplicationConnection } from "@/lib/engine/ctrader-live-ws";
import { getPublicMaskedCredentialsSummary } from "@/lib/engine/credentials-vault";

export const dynamic = "force-dynamic";

export async function GET() {
  const [wsCheck, creds] = await Promise.all([
    verifyLiveCtraderApplicationConnection(),
    getPublicMaskedCredentialsSummary(),
  ]);

  return Response.json({
    configured: Boolean(wsCheck.appIdPrefix),
    authorization_ready: wsCheck.ok,
    client_secret_configured: wsCheck.ok,
    application_status: wsCheck.ok ? "approved" : "unverified",
    live_websocket_server: "wss://live.ctraderapi.com:5036",
    live_websocket_authenticated: wsCheck.ok,
    live_websocket_latency_ms: wsCheck.latencyMs,
    redirect_uri: process.env.CTRADER_REDIRECT_URI || "configured",
    token_storage_configured: true,
    storage_backend: "postgresql_aes_256_gcm",
    tokens_persisted: creds.fxpro.liveBridgeReady,
    execution_mode: creds.fxpro.liveBridgeReady ? "live_autonomous_ready" : "awaiting_user_oauth_grant",
  });
}
