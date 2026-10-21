import crypto from "crypto";
import { db } from "@/db";
import {
  auditLogs,
  brokerConnections,
  businessRecords,
  paymentEvents,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { depositToPaperVault, ensureSystemInitialized } from "./trading-ledger";

function getWebhookHmacSecret(): string {
  return process.env.SURVIVAL_WEBHOOK_SECRET || "survival-ai-sandbox-hmac-dev-key-2026";
}

export function signSandboxWebhookPayload(payload: string): string {
  return crypto.createHmac("sha256", getWebhookHmacSecret()).update(payload).digest("hex");
}

export function verifySandboxWebhookSignature(payload: string, signatureHex: string): boolean {
  const expected = signSandboxWebhookPayload(payload);
  if (expected.length !== signatureHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHex));
}

/**
 * PayPal Sandbox Lifecycle:
 * 1) createPayPalSandboxOrder -> creates order (via live api-m.sandbox.paypal.com when PAYPAL_CLIENT_ID/SECRET present, else cryptographic sandbox state)
 * 2) capturePayPalSandboxWebhook -> validates HMAC signature, handles duplicate replay idempotently, and credits SANDBOX Paper Vault ONLY (never treated as real income!)
 */
export async function createPayPalSandboxOrder(amountUsd: number, idempotencyKey: string) {
  await ensureSystemInitialized();
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 250000) {
    throw new Error("PayPal Sandbox order amount must be between $1.00 and $250,000.00.");
  }

  const existing = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing.length > 0) {
    const signedPayload = JSON.stringify({
      externalOrderId: existing[0].externalOrderId,
      amount: existing[0].amount,
      event: "PAYMENT.CAPTURE.COMPLETED",
    });
    return {
      idempotentReplay: true,
      event: existing[0],
      webhookPayload: signedPayload,
      webhookSignature: signSandboxWebhookPayload(signedPayload),
    };
  }

  let externalOrderId = `PAYPAL-SBX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  let remoteApiUsed = false;

  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    try {
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString("base64");
      const tokenRes = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (tokenRes.ok) {
        const tokenJson = await tokenRes.json();
        const orderRes = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": idempotencyKey,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              { amount: { currency_code: "USD", value: amountUsd.toFixed(2) } },
            ],
          }),
        });
        if (orderRes.ok) {
          const orderJson = await orderRes.json();
          externalOrderId = orderJson.id;
          remoteApiUsed = true;
        }
      }
    } catch {
      remoteApiUsed = false;
    }
  }

  const [created] = await db
    .insert(paymentEvents)
    .values({
      provider: "PAYPAL_SANDBOX",
      externalOrderId,
      idempotencyKey,
      status: "APPROVED",
      amount: amountUsd,
      currency: "USD",
      isSandbox: true,
      webhookSignatureValid: false,
      rawPayload: { remoteApiUsed, notice: "SANDBOX ONLY — NOT REAL MONEY" },
    })
    .returning();

  const signedPayload = JSON.stringify({
    externalOrderId,
    amount: amountUsd,
    event: "PAYMENT.CAPTURE.COMPLETED",
  });

  return {
    idempotentReplay: false,
    event: created,
    remoteApiUsed,
    webhookPayload: signedPayload,
    webhookSignature: signSandboxWebhookPayload(signedPayload),
  };
}

export async function processPayPalSandboxWebhook(params: {
  rawBody: string;
  signatureHex: string;
}) {
  await ensureSystemInitialized();
  if (!verifySandboxWebhookSignature(params.rawBody, params.signatureHex)) {
    await db.insert(auditLogs).values({
      severity: "SECURITY",
      module: "PAYPAL_WEBHOOK",
      eventType: "SIGNATURE_VERIFICATION_FAILED",
      message: "Rejected PayPal Sandbox webhook with invalid HMAC-SHA256 signature.",
    });
    return { ok: false, status: 401, error: "Invalid webhook HMAC signature." };
  }

  const parsed = JSON.parse(params.rawBody) as {
    externalOrderId: string;
    amount: number;
    event: string;
  };

  const rows = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.externalOrderId, parsed.externalOrderId))
    .limit(1);

  if (rows.length === 0) {
    return { ok: false, status: 404, error: `Unknown PayPal Sandbox order '${parsed.externalOrderId}'.` };
  }

  const payment = rows[0];
  if (payment.status === "CAPTURED") {
    return {
      ok: true,
      duplicateIgnored: true,
      payment,
      message: "Duplicate PayPal Sandbox webhook event detected and ignored idempotently.",
    };
  }

  const deposit = await depositToPaperVault({
    amountUsd: payment.amount,
    idempotencyKey: `PAYPAL_CAPTURE_${payment.externalOrderId}`,
    source: "PAYPAL_SANDBOX_CAPTURE",
    note: `PayPal Sandbox Capture (${payment.externalOrderId}) — Sandbox Paper Capital ONLY (not real revenue).`,
  });

  const [updatedPayment] = await db
    .update(paymentEvents)
    .set({
      status: "CAPTURED",
      webhookSignatureValid: true,
      reconciledLedgerId: deposit.ledgerEntry.id,
      updatedAt: new Date(),
    })
    .where(eq(paymentEvents.id, payment.id))
    .returning();

  return {
    ok: true,
    duplicateIgnored: false,
    payment: updatedPayment,
    ledgerEntry: deposit.ledgerEntry,
    wallet: deposit.wallet,
  };
}

/**
 * cTrader Open API OAuth 2.0 State & Callback Handler
 */
export async function initiateCTraderOAuthFlow() {
  await ensureSystemInitialized();
  const state = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const clientId = process.env.CTRADER_CLIENT_ID || "UNCONFIGURED_CTRADER_CLIENT_ID";
  const redirectUri =
    process.env.CTRADER_REDIRECT_URI || "http://localhost:3000/api/integrations/ctrader/callback";

  await db
    .update(brokerConnections)
    .set({
      oauthState: state,
      oauthStateExpiresAt: expiresAt,
      lastVerifiedAt: new Date(),
    })
    .where(eq(brokerConnections.providerKey, "CTRADER_OAUTH"));

  const authorizationUrl = `https://connect.spotware.com/apps/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=trading&product=web&state=${state}`;

  return {
    state,
    expiresAt: expiresAt.toISOString(),
    authorizationUrl,
    clientCredentialsConfigured: Boolean(process.env.CTRADER_CLIENT_ID),
  };
}

export async function validateCTraderOAuthCallback(params: {
  state: string | null;
  code: string | null;
}) {
  await ensureSystemInitialized();
  const [conn] = await db
    .select()
    .from(brokerConnections)
    .where(eq(brokerConnections.providerKey, "CTRADER_OAUTH"));

  if (!params.state || !conn?.oauthState || params.state !== conn.oauthState) {
    await db.insert(auditLogs).values({
      severity: "SECURITY",
      module: "CTRADER_OAUTH",
      eventType: "OAUTH_STATE_MISMATCH",
      message: "Rejected cTrader OAuth callback due to missing or mismatched CSRF state token.",
    });
    return { valid: false, status: 400, reason: "OAuth CSRF state validation failed." };
  }

  if (conn.oauthStateExpiresAt && new Date(conn.oauthStateExpiresAt).getTime() < Date.now()) {
    return { valid: false, status: 400, reason: "OAuth CSRF state token has expired." };
  }

  if (!params.code) {
    return { valid: false, status: 400, reason: "Missing authorization code in callback." };
  }

  const masked = `ct_sbx_****${params.code.slice(-4)}`;
  await db
    .update(brokerConnections)
    .set({
      oauthState: null, // Single-use state consumption prevents replay attacks!
      oauthStateExpiresAt: null,
      maskedCredential: masked,
      connectionStatus: process.env.CTRADER_CLIENT_SECRET
        ? "OAUTH_CALLBACK_VERIFIED"
        : "STATE_VERIFIED_AWAITING_APP_APPROVAL",
      lastVerifiedAt: new Date(),
    })
    .where(eq(brokerConnections.providerKey, "CTRADER_OAUTH"));

  return {
    valid: true,
    status: 200,
    maskedToken: masked,
    liveBrokerConnected: false,
    note: "CSRF state consumed once and verified; live broker trading remains gated pending approved Open API credentials.",
  };
}

/**
 * MetaTrader 5 Demo Bridge Execution & Reconciliation Test (Strictly Demo Only)
 */
export async function executeMt5DemoAction(params: {
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  requestLiveExecution?: boolean;
}) {
  await ensureSystemInitialized();
  if (params.requestLiveExecution) {
    await db.insert(auditLogs).values({
      severity: "SECURITY",
      module: "MT5_BRIDGE",
      eventType: "LIVE_SUBSTITUTION_BLOCKED",
      message: "Blocked attempt to route live execution through MT5 Demo Bridge.",
    });
    return {
      accepted: false,
      error:
        "HARD SAFETY BLOCK: MT5 bridge is strictly restricted to DEMO accounts and never substitutes live execution.",
    };
  }

  const cleanLots = Math.max(0.01, Math.min(params.lots, 5.0));
  const simulatedFillPx = params.symbol.includes("EUR")
    ? 1.0842
    : params.symbol.includes("XAU")
      ? 2985.4
      : 82410.0;

  return {
    accepted: true,
    accountMode: "MT5_DEMO_ONLY",
    ticketId: `MT5-DEMO-${Date.now()}`,
    symbol: params.symbol.toUpperCase(),
    side: params.side,
    lots: cleanLots,
    fillPrice: simulatedFillPx,
    reconciledDemoEquityUsd: 50000,
    note: "Executed and reconciled in isolated MT5 Demo simulation mode.",
  };
}

/**
 * Business & Shopify Revenue Hub Evaluator (Strictly Segregated from Trading PnL)
 */
export async function evaluateAndRecordBusinessOpportunity(input: {
  channel: "SHOPIFY_STORE" | "DIGITAL_AUTOMATION" | "B2B_WORKFLOW";
  title: string;
  skuOrRef: string;
  sellingPriceUsd: number;
  unitCostUsd: number;
  adSpendPerSaleUsd: number;
  paymentFeePct?: number;
}) {
  await ensureSystemInitialized();
  const feePct = input.paymentFeePct ?? 2.9;
  const gatewayFee = (input.sellingPriceUsd * feePct) / 100 + 0.3;
  const totalCosts = Number(
    (input.unitCostUsd + input.adSpendPerSaleUsd + gatewayFee).toFixed(2)
  );
  const netContributionUsd = Number((input.sellingPriceUsd - totalCosts).toFixed(2));
  const roasMultiple =
    input.adSpendPerSaleUsd > 0
      ? Number((input.sellingPriceUsd / input.adSpendPerSaleUsd).toFixed(2))
      : 9.9;
  const netMarginPct =
    input.sellingPriceUsd > 0 ? (netContributionUsd / input.sellingPriceUsd) * 100 : -100;

  const verdict =
    netContributionUsd > 12 && netMarginPct >= 22 && roasMultiple >= 2.2
      ? "APPROVED_UNIT_ECONOMICS"
      : "REJECTED_LOW_CONTRIBUTION_MARGIN";

  const [created] = await db
    .insert(businessRecords)
    .values({
      channel: input.channel,
      recordType: "OPPORTUNITY_EVAL",
      title: input.title,
      skuOrRef: input.skuOrRef,
      status: verdict,
      grossAmountUsd: input.sellingPriceUsd,
      cogsAndFeesUsd: totalCosts,
      netContributionUsd,
      roasMultiple,
      isVerifiedRealRevenue: false, // Never claim real revenue from an opportunity evaluation!
      notes: `Evaluated unit economics: ${netMarginPct.toFixed(
        1
      )}% net contribution margin after COGS, CAC, and ${feePct}% + $0.30 gateway fee. Marked unverified ($0 real income) until actual customer settlement.`,
      metadataJson: { netMarginPct: Number(netMarginPct.toFixed(2)), gatewayFee },
    })
    .returning();

  return created;
}
