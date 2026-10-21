"use client";

import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  availableBalance: number;
  verifiedLiveBalance?: number;
  onSuccess: () => Promise<void>;
}

export function DepositModal({
  open,
  onClose,
  availableBalance,
  verifiedLiveBalance = 0,
  onSuccess,
}: DepositModalProps) {
  const [mode, setMode] = useState<
    "PAYPAL_LIVE_REAL" | "SANDBOX_DIRECT" | "PAYPAL_SANDBOX" | "WITHDRAW"
  >("PAYPAL_LIVE_REAL");
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setApproveUrl(null);
    const numeric = Number(amount);

    try {
      if (mode === "PAYPAL_LIVE_REAL") {
        const res = await fetch("/api/paypal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "auto",
            amountUsd: numeric,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "PayPal checkout error");
        }
        setApproveUrl(json.approveUrl);
        setFeedback({
          ok: true,
          msg: `Official PayPal Order #${json.orderId} (${json.mode.toUpperCase()} Gateway) created! Tap the green button below to open PayPal Checkout on your phone!`,
        });
      } else if (mode === "PAYPAL_SANDBOX") {
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "PAYPAL_SANDBOX_CREATE_AND_CAPTURE",
            amountUsd: numeric,
            verifyDuplicateProtection: true,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "PayPal Sandbox flow failed");
        }
        setFeedback({
          ok: true,
          msg: `PayPal Sandbox Order ${json.order.event.externalOrderId} verified & $${numeric.toLocaleString()} credited to Paper Vault.`,
        });
      } else {
        const res = await fetch("/api/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: mode === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT",
            amountUsd: numeric,
            note: "Operator Vault Allocation via Command Dashboard",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Vault transaction failed");
        }
        setFeedback({
          ok: true,
          msg:
            mode === "WITHDRAW"
              ? `Withdrew $${numeric.toLocaleString()} from Paper Trading Vault.`
              : `Credited $${numeric.toLocaleString()} to Paper Trading Vault (Ledger #${json.ledgerEntry.id}).`,
        });
      }
      await onSuccess();
    } catch (err: any) {
      setFeedback({ ok: false, msg: err?.message || "Transaction rejected" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#101624] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Add Real Money (PayPal Live) or Fund Paper Vault
              </h2>
              <p className="text-xs text-slate-400">
                Verified Live Vault:{" "}
                <span className="font-mono font-bold text-white">
                  ${verifiedLiveBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>{" "}
                • Paper Vault:{" "}
                <span className="font-mono text-emerald-300">
                  ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setMode("PAYPAL_LIVE_REAL")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 font-semibold transition ${
              mode === "PAYPAL_LIVE_REAL"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            PayPal LIVE ($)
          </button>
          <button
            type="button"
            onClick={() => setMode("SANDBOX_DIRECT")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 font-medium transition ${
              mode === "SANDBOX_DIRECT"
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            }`}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Paper Vault
          </button>
          <button
            type="button"
            onClick={() => setMode("PAYPAL_SANDBOX")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 font-medium transition ${
              mode === "PAYPAL_SANDBOX"
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            PayPal Test
          </button>
          <button
            type="button"
            onClick={() => setMode("WITHDRAW")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 font-medium transition ${
              mode === "WITHDRAW"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            }`}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Withdraw
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">
              {mode === "PAYPAL_LIVE_REAL"
                ? "Real Live Deposit Amount (USD via https://api-m.paypal.com)"
                : "Amount (USD)"}
            </label>
            <input
              type="number"
              min="5"
              max="100000"
              step="5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0A0E17] px-3.5 py-2.5 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[25, 100, 250, 500, 2500, 10000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-300 hover:border-slate-600 hover:text-white"
                >
                  +${preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                feedback.ok
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-500/45 bg-amber-500/15 text-amber-100"
              }`}
            >
              <div>{feedback.msg}</div>
              {approveUrl && (
                <a
                  href={approveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Open Official PayPal Checkout to Pay <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading
                ? "Connecting..."
                : mode === "PAYPAL_LIVE_REAL"
                  ? "Create Live PayPal Checkout Order"
                  : mode === "PAYPAL_SANDBOX"
                    ? "Run PayPal Sandbox Capture"
                    : mode === "WITHDRAW"
                      ? "Execute Vault Withdrawal"
                      : "Credit Paper Capital"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
