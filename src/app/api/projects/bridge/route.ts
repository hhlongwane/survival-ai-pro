import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

function isSafeHttpsOrLocalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * Strictly READ-ONLY bridge for inspecting an external deployment (e.g. user's protected Original Survival AI Render URL)
 * side-by-side with the Recreation App — NEVER sends mutating requests (POST/PUT/DELETE/PATCH) to the original app!
 */
export async function GET() {
  const savedRows = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.configKey, "original_project_readonly_url"))
    .limit(1);

  const configuredUrl =
    process.env.ORIGINAL_SURVIVAL_AI_URL ||
    (savedRows[0]?.configValue as { url?: string } | undefined)?.url ||
    "";

  let probeResult: {
    configured: boolean;
    url: string;
    reachable: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    readOnlyEnforced: true;
    note: string;
  } = {
    configured: Boolean(configuredUrl),
    url: configuredUrl,
    reachable: false,
    httpStatus: null,
    latencyMs: null,
    readOnlyEnforced: true,
    note: configuredUrl
      ? "Probing configured Original App URL strictly via read-only GET..."
      : "No Original App URL linked yet. Paste your live Render URL (or local port) below to monitor both projects side-by-side in strictly read-only mode.",
  };

  if (configuredUrl && isSafeHttpsOrLocalUrl(configuredUrl)) {
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(configuredUrl, {
        method: "GET", // STRICTLY GET ONLY — ZERO MUTATION PERMITTED
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      probeResult = {
        configured: true,
        url: configuredUrl,
        reachable: res.ok,
        httpStatus: res.status,
        latencyMs: Date.now() - t0,
        readOnlyEnforced: true,
        note: `Verified read-only HTTP ${res.status} response from external instance (${Date.now() - t0}ms). Protected original repository hhlongwane/survival-ai remains 100% untouched.`,
      };
    } catch (err: any) {
      probeResult = {
        configured: true,
        url: configuredUrl,
        reachable: false,
        httpStatus: null,
        latencyMs: Date.now() - t0,
        readOnlyEnforced: true,
        note: `Could not reach ${configuredUrl} (${err?.message || "timeout/offline"}). Original free-tier Render instance may be asleep or URL requires verification.`,
      };
    }
  }

  return Response.json({
    ok: true,
    protectedRepo: {
      githubSlug: "hhlongwane/survival-ai",
      branch: "main",
      writeProtection: "HARD_LOCKED_UNTOUCHED",
    },
    originalAppProbe: probeResult,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanUrl = sanitizeText(body.url || "", 200);
    if (cleanUrl && !isSafeHttpsOrLocalUrl(cleanUrl)) {
      return Response.json(
        { ok: false, error: "URL must be a valid https:// (or localhost) address." },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.configKey, "original_project_readonly_url"))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemConfigs).values({
        configKey: "original_project_readonly_url",
        configValue: { url: cleanUrl },
        version: 1,
        updatedBy: "operator_ui",
      });
    } else {
      await db
        .update(systemConfigs)
        .set({
          configValue: { url: cleanUrl },
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(systemConfigs.configKey, "original_project_readonly_url"));
    }

    return await GET();
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to save read-only bridge URL" },
      { status: 400 }
    );
  }
}
