import {
  getPublicMaskedCredentialsSummary,
  saveEncryptedCredentials,
} from "@/lib/engine/credentials-vault";
import { checkRateLimit, getClientKey } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getPublicMaskedCredentialsSummary();
    return Response.json({ ok: true, credentials: summary });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read masked credentials status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(getClientKey(req, "credentials_vault"), 30, 60_000);
  if (!rl.allowed) {
    return Response.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const summary = await saveEncryptedCredentials(body);
    return Response.json({ ok: true, credentials: summary });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to save encrypted credentials" },
      { status: 400 }
    );
  }
}
