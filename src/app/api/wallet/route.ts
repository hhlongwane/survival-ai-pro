import {
  depositToPaperVault,
  getVaultSummary,
  withdrawFromPaperVault,
} from "@/lib/engine/trading-ledger";
import { checkRateLimit, getClientKey, sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getVaultSummary();
    return Response.json({ ok: true, ...summary });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read vault summary" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "wallet_mutation"), 45, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const action = body.action === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT";
    const amountUsd = Number(body.amountUsd);
    const idempotencyKey =
      sanitizeText(body.idempotencyKey, 96) || `VAULT_${action}_${Date.now()}`;

    if (action === "WITHDRAW") {
      const res = await withdrawFromPaperVault({ amountUsd, idempotencyKey });
      return Response.json({ ok: true, action, ...res });
    }

    const res = await depositToPaperVault({
      amountUsd,
      idempotencyKey,
      source: "VAULT_DIRECT_SANDBOX",
      note: sanitizeText(body.note, 140) || undefined,
    });
    return Response.json({ ok: true, action, ...res });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Vault transaction failed" },
      { status: 400 }
    );
  }
}
