import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const IGNORED_DIRS = new Set(["node_modules", ".next", ".git", "out", "dist"]);
const IGNORED_FILES = new Set([".env", ".env.local", ".env.production", "tsconfig.tsbuildinfo"]);

async function collectProjectFiles(rootDir: string, relDir = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(rootDir, relDir), { withFileTypes: true });
  const files: string[] = [];

  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      const sub = await collectProjectFiles(rootDir, path.posix.join(relDir, ent.name));
      files.push(...sub);
    } else if (ent.isFile()) {
      if (IGNORED_FILES.has(ent.name) || ent.name.endsWith(".log")) continue;
      if (ent.name.startsWith(".env") && ent.name !== ".env.example") continue;
      files.push(path.posix.join(relDir, ent.name));
    }
  }
  return files;
}

/**
 * 1-Tap GitHub Repository Publisher for Permanent Free Vercel / Render Hosting:
 * - Creates a BRAND-NEW separate repository (default: `survival-ai-pro` — strictly blocks touching `survival-ai`!)
 * - Uploads all clean project source code + icons in seconds via GitHub Git Data API
 * - Returns direct 1-Click Vercel Deploy URL (`https://vercel.com/new/import?s=...`)!
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.githubToken || "").trim();
    let repoName = String(body.repoName || "survival-ai-pro")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-");

    if (!token) {
      return Response.json(
        { ok: false, error: "Paste your GitHub token first." },
        { status: 400 }
      );
    }

    // Hard safety guard: NEVER allow overwriting protected `survival-ai`!
    if (repoName.toLowerCase() === "survival-ai") {
      repoName = "survival-ai-pro";
    }

    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "SurvivalAI-Cloud-Publisher/1.0",
    };

    // 1. Identify authenticated GitHub user
    const userRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
    const userJson = await userRes.json();
    if (!userRes.ok || !userJson.login) {
      return Response.json(
        {
          ok: false,
          error: `GitHub token rejected (${userJson.message || userRes.status}). Make sure you copied the full ghp_... token with 'repo' scope ticked!`,
        },
        { status: 401 }
      );
    }

    const owner: string = userJson.login;

    // 2. Check if target repo exists; if not, create it initialized with auto_init: true so Git Data API is ready immediately!
    let repoCheck = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: ghHeaders,
    });

    if (repoCheck.status === 404) {
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          name: repoName,
          description:
            "Survival AI Pro — Permanent Autonomous Crypto Gap, FxPro & Neural Trading App (Vercel + Neon Postgres Ready)",
          private: false, // Public makes Vercel Hobby + GitHub deployment 100% free & instant!
          auto_init: true,
        }),
      });
      if (!createRes.ok) {
        const errJ = await createRes.json().catch(() => ({}));
        return Response.json(
          {
            ok: false,
            error: `Could not create GitHub repo '${repoName}': ${
              errJ.message || createRes.status
            }`,
          },
          { status: 400 }
        );
      }
      // Brief pause for GitHub initial commit initialization
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 3. Get latest commit on default branch (`main`)
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
      { headers: ghHeaders }
    );
    const refJson = await refRes.json();
    const parentSha: string = refJson.object?.sha;

    // 4. Upload all project files as Git Blobs (base64 supports both UTF-8 code AND PNG app icons cleanly!)
    const rootDir = process.cwd();
    const allRelFiles = await collectProjectFiles(rootDir);

    const treeItems: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }> = [];

    // Upload in batches of 8 for fast, rate-limit-friendly parallel upload
    for (let i = 0; i < allRelFiles.length; i += 8) {
      const batch = allRelFiles.slice(i, i + 8);
      const createdBlobs = await Promise.all(
        batch.map(async (relPath) => {
          const buf = await fs.readFile(path.join(rootDir, relPath));
          const blobRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
            {
              method: "POST",
              headers: ghHeaders,
              body: JSON.stringify({
                content: buf.toString("base64"),
                encoding: "base64",
              }),
            }
          );
          const blobJson = await blobRes.json();
          if (!blobRes.ok || !blobJson.sha) {
            throw new Error(`Failed uploading ${relPath}: ${blobJson.message}`);
          }
          return {
            path: relPath,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blobJson.sha as string,
          };
        })
      );
      treeItems.push(...createdBlobs);
    }

    // 5. Create Git Tree & Commit & Update `refs/heads/main`
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ tree: treeItems }),
      }
    );
    const treeJson = await treeRes.json();

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "Deploy complete Survival AI Pro Permanent Cloud App (Vercel + Postgres Ready)",
          tree: treeJson.sha,
          parents: parentSha ? [parentSha] : [],
        }),
      }
    );
    const commitJson = await commitRes.json();

    await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: "PATCH",
      headers: ghHeaders,
      body: JSON.stringify({ sha: commitJson.sha, force: true }),
    });

    const repoUrl = `https://github.com/${owner}/${repoName}`;
    const vercelImportUrl = `https://vercel.com/new/import?s=${encodeURIComponent(repoUrl)}`;
    const renderBlueprintUrl = `https://render.com/deploy?repo=${encodeURIComponent(repoUrl)}`;

    return Response.json({
      ok: true,
      filesUploaded: treeItems.length,
      owner,
      repoName,
      repoUrl,
      vercelImportUrl,
      renderBlueprintUrl,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message ?? "GitHub push failed" },
      { status: 500 }
    );
  }
}
