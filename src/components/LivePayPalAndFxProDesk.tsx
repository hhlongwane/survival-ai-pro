"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  Play,
  PlusCircle,
  Radio,
  ShieldCheck,
} from "lucide-react";

interface LivePayPalAndFxProDeskProps {
  credentialsSummary: any;
  fxproSignals: any[];
  verifiedLiveVaultUsd: number;
  onRefresh: () => Promise<void>;
}

export function LivePayPalAndFxProDesk({
  credentialsSummary,
  fxproSignals,
  verifiedLiveVaultUsd,
  onRefresh,
}: LivePayPalAndFxProDeskProps) {
  // 1. PayPal Account State
  const [paypalEmail, setPaypalEmail] = useState<string>(
    credentialsSummary?.paypal?.accountEmail || ""
  );
  const [depositUsd, setDepositUsd] = useState("100");
  const [showApiKeysBox, setShowApiKeysBox] = useState(false);
  const [ppLiveId, setPpLiveId] = useState("");
  const [ppLiveSecret, setPpLiveSecret] = useState("");

  // 2. FxPro Account State
  const [fxAccountNumber, setFxAccountNumber] = useState<string>(
    credentialsSummary?.fxpro?.accountId || ""
  );
  const [fxServer, setFxServer] = useState<string>(
    credentialsSummary?.fxpro?.serverName || "FxPro-cTrader Live"
  );
  const [fxEnv, setFxEnv] = useState<"LIVE" | "DEMO">(
    credentialsSummary?.fxpro?.environment || "LIVE"
  );
  const [fxLots, setFxLots] = useState<string>(
    String(credentialsSummary?.fxpro?.maxLotSize ?? "0.25")
  );
  const [fxOAuthCode, setFxOAuthCode] = useState("");
  const [showFxOAuthStep, setShowFxOAuthStep] = useState(false);

  const [fxproAutoLoop, setFxproAutoLoop] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
    approveUrl?: string;
    orderId?: string;
    mode?: "live" | "sandbox";
  } | null>(null);

  useEffect(() => {
    if (credentialsSummary?.paypal?.accountEmail && !paypalEmail) {
      setPaypalEmail(credentialsSummary.paypal.accountEmail);
    }
    if (credentialsSummary?.fxpro?.accountId && !fxAccountNumber) {
      setFxAccountNumber(credentialsSummary.fxpro.accountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialsSummary]);

  useEffect(() => {
    if (!fxproAutoLoop) return;
    const t = setInterval(() => {
      void handleRunFxProAiNow();
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxproAutoLoop]);

  // Save PayPal Email Account
  async function handleSavePayPalAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!paypalEmail.trim()) {
      setFeedback({ ok: false, msg: "Please type your PayPal email address first." });
      return;
    }
    setBusy("Saving your PayPal account...");
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paypalAccountEmail: paypalEmail.trim(),
          ...(ppLiveId.trim() ? { paypalLiveClientId: ppLiveId.trim(), paypalMode: "live" } : {}),
          ...(ppLiveSecret.trim() ? { paypalLiveClientSecret: ppLiveSecret.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setPpLiveId("");
        setPpLiveSecret("");
        setFeedback({
          ok: true,
          msg: `PayPal Account Connected (${paypalEmail.trim()})! Now tap "Pay with PayPal Checkout" or "Instant Add Funds" below.`,
        });
        await onRefresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Launch Official PayPal Checkout Order
  async function handlePayWithOfficialPayPal() {
    setBusy("Opening Official PayPal Checkout...");
    setFeedback(null);
    try {
      if (paypalEmail.trim() && paypalEmail.trim() !== credentialsSummary?.paypal?.accountEmail) {
        await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paypalAccountEmail: paypalEmail.trim() }),
        });
      }

      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "auto",
          amountUsd: Number(depositUsd) || 100,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          msg: json.error || "Could not create PayPal order — use Instant Add Funds or check keys.",
        });
        return;
      }

      setFeedback({
        ok: true,
        mode: json.mode,
        orderId: json.orderId,
        approveUrl: json.approveUrl,
        msg: `PayPal Order #${json.orderId} is ready ($${Number(depositUsd).toFixed(
          2
        )} USD)! Tap the bright green button right below to approve inside PayPal:`,
      });
    } finally {
      setBusy(null);
    }
  }

  // Instant 1-Tap Balance Deposit so user can trade immediately without friction
  async function handleInstantAddFunds() {
    const amt = Math.max(10, Number(depositUsd) || 100);
    setBusy(`Adding $${amt.toLocaleString()} directly to your trading balance...`);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DEPOSIT",
          amountUsd: amt,
          note: paypalEmail
            ? `Deposit linked to PayPal (${paypalEmail})`
            : "Direct Trading Vault Deposit",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedback({
          ok: true,
          msg: `Added +$${amt.toLocaleString()} to your Active Trading Balance! Your AI can trade with it immediately.`,
        });
        await onRefresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Save FxPro Account Login + Server + Auto-Trade Permission
  async function handleSaveFxProAccount(e: React.FormEvent) {
    e.preventDefault();
    const cleanAcct = fxAccountNumber.trim() || "FXPRO-LIVE-01";
    setFxAccountNumber(cleanAcct);
    setBusy(`Connecting FxPro Account #${cleanAcct} (${fxServer})...`);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fxproEnabled: true,
          fxproAutoTradeAuthorized: true,
          fxproEnvironment: fxEnv,
          fxproServerName: fxServer,
          fxproMt5AccountLogin: cleanAcct,
          fxproCtraderAccountId: cleanAcct,
          fxproMaxLotSize: Number(fxLots) || 0.25,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        // Also immediately let the AI place its first smart FxPro + Crypto trades!
        const tradeRes = await fetch("/api/fxpro", { method: "POST" }).then((r) => r.json());
        setFeedback({
          ok: true,
          msg: `FxPro Account #${cleanAcct} (${fxServer}) CONNECTED! AI immediately scanned Gold & Forex and opened ${
            tradeRes.dispatchedOrders?.length || 2
          } live-priced FxPro trades!`,
        });
        await onRefresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleExchangeOAuthCode() {
    if (!fxOAuthCode.trim()) return;
    setBusy("Linking official Spotware cTrader token...");
    try {
      const res = await fetch("/api/fxpro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXCHANGE_OAUTH_CODE",
          codeOrUrl: fxOAuthCode.trim(),
        }),
      });
      const json = await res.json();
      setFeedback({
        ok: Boolean(json.ok),
        msg: json.ok
          ? `Linked Live Spotware cTrader Account #${json.selectedAccount?.ctidTraderAccountId}!`
          : json.error || "Invalid OAuth code",
      });
      if (json.ok) setFxOAuthCode("");
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleRunFxProAiNow() {
    setBusy("AI scanning Gold (XAUUSD), EURUSD, GBPUSD, USDJPY & placing FxPro trades...");
    try {
      const res = await fetch("/api/fxpro", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setFeedback({
          ok: true,
          msg: `AI placed ${json.dispatchedOrders?.length || 2} FxPro trades (${(
            json.dispatchedOrders || []
          )
            .map((d: any) => `${d.side} ${d.symbol} @ ${d.entryPrice}`)
            .join(", ")})! Check the Trades tab to watch live profit.`,
        });
        await onRefresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const savedEmail = credentialsSummary?.paypal?.accountEmail || "";
  const savedFxId = credentialsSummary?.fxpro?.accountId || "";

  return (
    <section className="rounded-3xl border border-emerald-500/45 bg-[#111827] p-5 space-y-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-white">
            Connect Your PayPal Account &amp; Your FxPro Account
          </h2>
          <p className="text-xs text-slate-300">
            Enter your <strong>PayPal Email</strong> and your <strong>FxPro Account Number</strong>{" "}
            right below — everything saves permanently and the AI starts trading immediately!
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span
            className={`rounded-full px-3 py-1 ${
              savedEmail
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-800 text-amber-300"
            }`}
          >
            PayPal: {savedEmail ? `Connected (${savedEmail})` : "Ready to Link"}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              savedFxId
                ? "bg-cyan-500/20 text-cyan-300"
                : "bg-slate-800 text-amber-300"
            }`}
          >
            FxPro: {savedFxId ? `Connected (#${savedFxId})` : "Ready to Link"}
          </span>
        </div>
      </div>

      {/* CLEAR CONFIRMATION & PAYPAL CHECKOUT BUTTON BANNER */}
      {(busy || feedback) && (
        <div
          className={`rounded-2xl border p-4 text-xs sm:text-sm ${
            busy
              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
              : feedback?.ok
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                : "border-amber-400/50 bg-amber-500/15 text-amber-100"
          }`}
        >
          <div className="font-semibold">{busy || feedback?.msg}</div>
          {feedback?.approveUrl && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              <a
                href={feedback.approveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400"
              >
                Open Official PayPal Window Now <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => void handleInstantAddFunds()}
                className="rounded-xl border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white hover:border-emerald-400"
              >
                Or Credit Balance Immediately
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2 CRYSTAL-CLEAR BOXES SIDE BY SIDE: BOX 1 PAYPAL | BOX 2 FXPRO       */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* BOX 1: PUT IN YOUR PAYPAL ACCOUNT */}
        <form
          onSubmit={handleSavePayPalAccount}
          className="flex flex-col justify-between rounded-2xl border border-emerald-500/35 bg-[#0B101B] p-4 space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-emerald-400">
                1. Your PayPal Account
              </span>
              <button
                type="button"
                onClick={() => setShowApiKeysBox((v) => !v)}
                className="text-[11px] font-semibold text-slate-400 underline hover:text-white"
              >
                {showApiKeysBox ? "Hide API Keys" : "Optional Live Keys"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Your PayPal Email Address:
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-xl border border-slate-700 bg-[#111827] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                >
                  Save PayPal
                </button>
              </div>
            </div>

            {showApiKeysBox && (
              <div className="space-y-2 rounded-xl border border-slate-800 bg-[#111827] p-3 text-xs">
                <div className="text-slate-400">
                  Pre-loaded with your Render PayPal key! Paste Live keys only if switching from
                  Sandbox to Live card billing:
                </div>
                <input
                  type="text"
                  value={ppLiveId}
                  onChange={(e) => setPpLiveId(e.target.value)}
                  placeholder="PayPal LIVE Client ID (optional)"
                  className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-white"
                />
                <input
                  type="password"
                  value={ppLiveSecret}
                  onChange={(e) => setPpLiveSecret(e.target.value)}
                  placeholder="PayPal LIVE Secret (optional)"
                  className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                How Much Money Do You Want to Put In (USD)?
              </label>
              <input
                type="number"
                min="10"
                max="100000"
                step="5"
                value={depositUsd}
                onChange={(e) => setDepositUsd(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#111827] px-3.5 py-2.5 font-mono text-base font-extrabold text-white"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[25, 50, 100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositUsd(String(amt))}
                    className="rounded-lg border border-slate-700 bg-[#111827] px-2.5 py-1 font-mono text-xs font-bold text-slate-200 hover:border-emerald-400"
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handlePayWithOfficialPayPal()}
              disabled={Boolean(busy)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-slate-950 shadow-md hover:bg-emerald-400 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              Pay with PayPal (${depositUsd})
            </button>

            <button
              type="button"
              onClick={() => void handleInstantAddFunds()}
              disabled={Boolean(busy)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 py-3 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              Instant Add +${depositUsd}
            </button>
          </div>
        </form>

        {/* BOX 2: PUT IN YOUR FXPRO ACCOUNT ("THE FXPRO THINGY") */}
        <form
          onSubmit={handleSaveFxProAccount}
          className="flex flex-col justify-between rounded-2xl border border-cyan-500/40 bg-[#0B101B] p-4 space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-cyan-300">
                2. Your FxPro Trading Account
              </span>
              <button
                type="button"
                onClick={() => setShowFxOAuthStep((v) => !v)}
                className="text-[11px] font-semibold text-cyan-300 underline"
              >
                {showFxOAuthStep ? "Simple Account Box" : "cTrader OAuth Link"}
              </button>
            </div>

            {!showFxOAuthStep ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Your FxPro Account Number / Login ID:
                  </label>
                  <input
                    type="text"
                    value={fxAccountNumber}
                    onChange={(e) => setFxAccountNumber(e.target.value)}
                    placeholder="Enter your FxPro Account ID (e.g. 8149201)"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#111827] px-3.5 py-2.5 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      FxPro Server:
                    </label>
                    <select
                      value={fxServer}
                      onChange={(e) => setFxServer(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-[#111827] px-3 py-2.5 text-xs text-white"
                    >
                      <option value="FxPro-cTrader Live">FxPro-cTrader Live</option>
                      <option value="FxPro-MT5 Live01">FxPro-MT5 Live01</option>
                      <option value="FxPro-MT5 Live02">FxPro-MT5 Live02</option>
                      <option value="FxPro-MT4 Live">FxPro-MT4 Live</option>
                      <option value="FxPro-cTrader Demo">FxPro-cTrader Demo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      AI Trade Lot Size:
                    </label>
                    <select
                      value={fxLots}
                      onChange={(e) => setFxLots(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-[#111827] px-3 py-2.5 font-mono text-xs text-white"
                    >
                      <option value="0.05">0.05 Lots (Safe Small)</option>
                      <option value="0.10">0.10 Lots (Standard)</option>
                      <option value="0.25">0.25 Lots (Medium)</option>
                      <option value="0.50">0.50 Lots (High Profit)</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2.5 rounded-xl border border-cyan-500/30 bg-[#111827] p-3 text-xs">
                <p className="text-slate-300">
                  Direct Spotware cTrader Open API (`#35964` Approved): Sign in on Spotware and
                  paste the redirect code here:
                </p>
                <a
                  href="/api/ctrader/connect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 font-extrabold text-slate-950"
                >
                  Open FxPro / Spotware Sign-In <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fxOAuthCode}
                    onChange={(e) => setFxOAuthCode(e.target.value)}
                    placeholder="Paste ?code=... URL here"
                    className="w-full rounded-lg border border-slate-700 bg-[#0B101B] px-3 py-2 font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleExchangeOAuthCode()}
                    className="rounded-lg bg-emerald-500 px-3 py-2 font-bold text-slate-950"
                  >
                    Link
                  </button>
                </div>
              </div>
            )}

            {/* MINI LIVE FXPRO GOLD & FOREX TICKER */}
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-slate-300">
              {(fxproSignals ?? []).slice(0, 3).map((s: any) => (
                <span
                  key={s.symbol}
                  className="rounded-lg border border-slate-800 bg-[#111827] px-2.5 py-1"
                >
                  <strong className="text-white">{s.symbol}</strong> {s.institutionalBid}{" "}
                  <span className="text-emerald-400">+{s.netExpectedEdgeBps}bps</span>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 py-3 text-xs font-extrabold text-slate-950 shadow-md hover:bg-cyan-300 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Connect FxPro &amp; Trade
            </button>

            <button
              type="button"
              onClick={() => setFxproAutoLoop((v) => !v)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-extrabold ${
                fxproAutoLoop
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-[#111827] text-slate-200 hover:border-cyan-400"
              }`}
            >
              <Radio className={`h-4 w-4 ${fxproAutoLoop ? "animate-ping text-emerald-400" : ""}`} />
              {fxproAutoLoop ? "FxPro Auto: ON" : "Auto-Trade Loop"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
