import { NextResponse } from "next/server";
import { exchangeCtraderCodeAndDiscoverAccounts } from "@/lib/engine/ctrader-live-ws";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?fxpro=missing_code", req.url));
  }

  try {
    await exchangeCtraderCodeAndDiscoverAccounts(code);
    return NextResponse.redirect(new URL("/?fxpro=connected", req.url));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/?fxpro=error&msg=${encodeURIComponent(err?.message || "oauth_error")}`, req.url)
    );
  }
}
