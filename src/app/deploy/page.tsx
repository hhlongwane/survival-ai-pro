"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  Rocket,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export default function PermanentDeployPage() {
  const [githubToken, setGithubToken] = useState("");
  const [repoName, setRepoName] = useState("survival-ai-pro");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePushToGitHub(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/deploy/github-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubToken, repoName }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || "Could not push to GitHub");
        return;
      }
      setGithubToken("");
      setResult(json);
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080C14] pb-16 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B101B]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2.5 text-emerald-400">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white sm:text-lg">
                Make Your App 100% Permanent Forever ($0 Free)
              </h1>
              <p className="text-xs text-emerald-300">
                No Vercel App to Download! Everything Works Inside Your Phone Browser
              </p>
            </div>
          </div>

          <a
            href="/"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:border-emerald-400"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6">
        {/* DIRECT PLAIN-ENGLISH ANSWER */}
        <section className="rounded-3xl border border-emerald-500/35 bg-[#111827] p-5 space-y-2">
          <h2 className="text-base font-extrabold text-white sm:text-lg">
            Do You Need to Download Vercel? <span className="text-emerald-400">NO!</span>
          </h2>
          <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
            You <strong>do NOT</strong> need to download Vercel or install any program on your
            Samsung Galaxy A33! <strong>Vercel.com</strong> is a free website you open in Chrome on
            your phone. Once we push this app into your GitHub account below, Vercel gives you a{" "}
            <strong>permanent forever address</strong> (like{" "}
            <code className="font-mono text-emerald-300">https://survival-ai-pro.vercel.app</code>)
            that <strong>never expires, never resets, never sleeps, and costs $0.00/month!</strong>
          </p>
        </section>

        {/* STEP 1: ONE-TAP PUSH ENTIRE APP TO YOUR GITHUB */}
        <section className="rounded-3xl border border-cyan-500/40 bg-[#111827] p-5 space-y-4">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-cyan-500/20 px-3 py-0.5 text-[11px] font-extrabold text-cyan-300">
              STEP 1 OF 2 — SEND FULL APP TO YOUR GITHUB IN 1 TAP
            </span>
            <h3 className="text-base font-extrabold text-white">
              Create <code className="font-mono text-cyan-300">hhlongwane/survival-ai-pro</code>{" "}
              Automatically from Your Phone
            </h3>
            <p className="text-xs text-slate-300">
              1. Tap{" "}
              <a
                href="https://github.com/settings/tokens/new?description=SurvivalAI-Permanent-Deploy&scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-amber-300 underline"
              >
                Create Quick GitHub Token ↗
              </a>{" "}
              (scroll down on GitHub &amp; tap green <strong>Generate token</strong>).
              <br />
              2. Paste that token below &amp; tap the big blue button — our server uploads all 60+
              app files straight into your GitHub in 4 seconds (while keeping your old{" "}
              <code className="font-mono">survival-ai</code> untouched!).
            </p>
          </div>

          <form onSubmit={handlePushToGitHub} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="Paste GitHub Token here (ghp_...)"
                className="rounded-xl border border-slate-700 bg-[#0B101B] px-3.5 py-3 font-mono text-xs text-white sm:col-span-2"
              />
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="survival-ai-pro"
                className="rounded-xl border border-slate-700 bg-[#0B101B] px-3.5 py-3 font-mono text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !githubToken.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-cyan-300 disabled:opacity-50"
            >
              <CloudUpload className="h-5 w-5" />
              {busy
                ? "Uploading All App Files to Your GitHub..."
                : "Push Complete App to My GitHub Now"}
            </button>
          </form>

          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 p-3.5 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                Uploaded {result.filesUploaded} Files to {result.owner}/{result.repoName}!
              </div>
              <p className="text-xs text-slate-200">
                <strong>NOW DO STEP 2 (Takes 30 Seconds in Your Browser):</strong>
                <br />
                1. Tap the green <strong>&ldquo;Launch Permanent Free App on Vercel.com&rdquo;</strong>{" "}
                button below (sign in with GitHub).
                <br />
                2. Tap <strong>Deploy</strong>, then on your Vercel project page tap{" "}
                <strong>Storage {"->"} Create Database {"->"} Neon Postgres (Free $0) {"->"} Connect</strong>{" "}
                and tap <strong>Redeploy</strong>!
                <br />
                3. Open your brand-new permanent{" "}
                <code className="font-mono text-white">https://{result.repoName}.vercel.app</code>{" "}
                on your Samsung Galaxy A33 {"->"} Chrome menu (<code className="font-mono">⋮</code>) {"->"}{" "}
                <strong>Install app</strong>! It will work forever!
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={result.vercelImportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400"
                >
                  Launch Permanent Free App on Vercel.com{" "}
                  <ExternalLink className="h-4 w-4" />
                </a>

                <a
                  href={result.renderBlueprintUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-[#0B101B] py-3.5 text-xs font-bold text-white hover:border-cyan-400"
                >
                  Or Launch on Render.com (1-Click Blueprint){" "}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* BACKUP ZIP DOWNLOAD OPTION */}
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-white">
              Want a Full Backup Copy of All Source Code Too?
            </h3>
            <p className="text-xs text-slate-400">
              Downloads <code className="font-mono text-white">survival-ai-permanent.zip</code>{" "}
              (with <code className="font-mono">vercel.json</code>,{" "}
              <code className="font-mono">render.yaml</code> &amp; auto-creating PostgreSQL tables)
              straight to your phone or PC.
            </p>
          </div>

          <a
            href="/api/deploy/download-zip"
            download="survival-ai-permanent.zip"
            className="flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
          >
            <Download className="h-4 w-4" />
            Download Full Project (.ZIP)
          </a>
        </section>
      </main>
    </div>
  );
}
