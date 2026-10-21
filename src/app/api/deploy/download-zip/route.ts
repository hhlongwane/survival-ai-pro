import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

export async function GET() {
  const zipPath = "/tmp/survival-ai-permanent.zip";
  await fs.rm(zipPath, { force: true });

  await execFileAsync(
    "zip",
    [
      "-r",
      zipPath,
      ".",
      "-x",
      "node_modules/*",
      ".next/*",
      ".git/*",
      ".env",
      ".env.*",
      "*.log",
    ],
    { cwd: process.cwd() }
  );

  // Re-add `.env.example` cleanly since `-x .env.*` excluded it
  await execFileAsync("zip", ["-u", zipPath, ".env.example"], { cwd: process.cwd() });

  const buf = await fs.readFile(zipPath);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="survival-ai-permanent.zip"',
      "Cache-Control": "no-store",
    },
  });
}
