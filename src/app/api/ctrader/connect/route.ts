import { NextResponse } from "next/server";
import { getOfficialFxProOAuthAuthorizeUrl } from "@/lib/engine/ctrader-live-ws";

export const dynamic = "force-dynamic";

export async function GET() {
  const oauth = await getOfficialFxProOAuthAuthorizeUrl();
  return NextResponse.redirect(oauth.authorizeUrl, 307);
}
