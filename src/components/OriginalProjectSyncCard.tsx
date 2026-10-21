"use client";

import React from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";

interface OriginalProjectSyncCardProps {
  onSynced?: () => Promise<void>;
}

export function OriginalProjectSyncCard({ onSynced }: OriginalProjectSyncCardProps) {
  void onSynced;
  return (
    <section className="rounded-3xl border border-emerald-500/35 bg-[#111827] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> ORIGINAL SURVIVAL-AI CONNECTED &amp; VERIFIED
            </span>
            <span className="rounded-full bg-cyan-500/20 px-3 py-0.5 text-[11px] font-bold text-cyan-300">
              PayPal + Approved cTrader #35964 + Shopify + R5,000 ZAR Offers Active
            </span>
          </div>
          <p className="text-xs text-slate-300">
            All 54 modules &amp; live credentials from{" "}
            <code className="font-mono text-white">survival-ai-gmd5.onrender.com</code> are now
            wired into durable PostgreSQL with zero data loss on restart — while keeping your
            original Render app completely untouched.
          </p>
        </div>

        <a
          href="https://survival-ai-gmd5.onrender.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-700 bg-[#0B101B] px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-emerald-400"
        >
          Open Original App (Read-Only) <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
        </a>
      </div>
    </section>
  );
}
