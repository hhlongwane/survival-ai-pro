import {
  buildFxProCtraderOAuthLink,
  runAutonomousFxProTradingCycle,
  scanLiveFxProAndGoldOpportunities,
} from "@/lib/engine/fxpro-connector";
import {
  exchangeCtraderCodeAndDiscoverAccounts,
  readRealFxProAccountSnapshot,
} from "@/lib/engine/ctrader-live-ws";
import {
  getPublicMaskedCredentialsSummary,
  getServerSecrets,
} from "@/lib/engine/credentials-vault";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const [signals, creds, oauth, secrets] = await Promise.all([
      scanLiveFxProAndGoldOpportunities(),
      getPublicMaskedCredentialsSummary(),
      buildFxProCtraderOAuthLink(origin),
      getServerSecrets(),
    ]);

    let realAccountSnapshot = null;
    if (secrets.fxproCtraderAccessToken && secrets.fxproCtraderAccountId) {
      try {
        realAccountSnapshot = await readRealFxProAccountSnapshot(
          secrets.fxproCtraderAccessToken,
          Number(secrets.fxproCtraderAccountId),
          secrets.fxproEnvironment === "LIVE"
        );
      } catch {
        realAccountSnapshot = null;
      }
    }

    return Response.json({
      ok: true,
      fxproConfig: creds.fxpro,
      ctraderOAuth: oauth,
      realAccountSnapshot,
      liveSignals: signals,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read FxPro live status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "fxpro_autonomous"), 45, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "EXCHANGE_OAUTH_CODE" && body.codeOrUrl) {
      const linked = await exchangeCtraderCodeAndDiscoverAccounts(String(body.codeOrUrl));
      return Response.json(linked);
    }

    const result = await runAutonomousFxProTradingCycle();
    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Autonomous FxPro execution failed" },
      { status: 400 }
    );
  }
}
