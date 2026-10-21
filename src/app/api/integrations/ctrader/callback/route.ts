import { validateCTraderOAuthCallback } from "@/lib/engine/integrations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  const result = await validateCTraderOAuthCallback({ state, code });
  return Response.json(result, { status: result.status });
}
