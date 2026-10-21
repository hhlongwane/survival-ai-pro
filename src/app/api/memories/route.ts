import { db } from "@/db";
import { aiMemories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { sanitizeText } from "@/lib/engine/security";

export const dynamic = "force-dynamic";

/**
 * Full implementation of the exact `ai_memories` storage contract found in
 * `https://github.com/hhlongwane/Render/blob/main/integrations/survival-ai/supabaseClient.js`
 * (`saveMemory`, `listMemories`, `deleteMemory`).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 100, 500));
    const userId = sanitizeText(url.searchParams.get("userId") || "hhlongwane-primary", 80);

    const rows = await db
      .select()
      .from(aiMemories)
      .where(eq(aiMemories.userId, userId))
      .orderBy(desc(aiMemories.updatedAt))
      .limit(limit);

    return Response.json({
      ok: true,
      sourceSchema: "hhlongwane/Render/supabase/migrations/0001_survival_ai_storage.sql",
      memories: rows,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to list AI memories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = sanitizeText(body.userId || "hhlongwane-primary", 80);

    if (body.action === "DELETE" && body.id) {
      await db
        .delete(aiMemories)
        .where(and(eq(aiMemories.id, Number(body.id)), eq(aiMemories.userId, userId)));
      return Response.json({ ok: true, deletedId: Number(body.id) });
    }

    const memoryKey = sanitizeText(body.memoryKey || "", 160);
    if (!memoryKey) {
      return Response.json(
        { ok: false, error: "memoryKey (1..160 chars) is required." },
        { status: 400 }
      );
    }

    const content = body.content ?? {};
    const metadata = body.metadata ?? {};

    const existing = await db
      .select()
      .from(aiMemories)
      .where(and(eq(aiMemories.userId, userId), eq(aiMemories.memoryKey, memoryKey)))
      .limit(1);

    if (existing.length === 0) {
      const [created] = await db
        .insert(aiMemories)
        .values({
          userId,
          memoryKey,
          content,
          metadata,
        })
        .returning();
      return Response.json({ ok: true, memory: created, upserted: "created" });
    }

    const [updated] = await db
      .update(aiMemories)
      .set({
        content,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(aiMemories.id, existing[0].id))
      .returning();

    return Response.json({ ok: true, memory: updated, upserted: "updated" });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to save AI memory" },
      { status: 400 }
    );
  }
}
