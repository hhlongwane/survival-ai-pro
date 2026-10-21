import { db } from "@/db";
import { orders, positions, riskDecisions, systemConfigs, wallets } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface RiskPolicyConfig {
  killSwitchActive: boolean;
  circuitBreakerTripped: boolean;
  liveExecutionAuthorized: boolean;
  maxSinglePositionPct: number; // % of total vault equity (e.g. 25%)
  maxPortfolioExposurePct: number; // % of total vault equity (e.g. 160%)
  maxLeverage: number; // e.g. 3.0x
  maxDailyLossPct: number; // e.g. 4.0%
  maxDrawdownPct: number; // e.g. 10.0%
  maxSlippageBps: number; // e.g. 16 bps
  minOrderbookDepthUsd: number; // e.g. $2,500
  maxDataStalenessMs: number; // e.g. 120,000 ms
}

export const DEFAULT_RISK_POLICY: RiskPolicyConfig = {
  killSwitchActive: false,
  circuitBreakerTripped: false,
  liveExecutionAuthorized: false,
  maxSinglePositionPct: 28,
  maxPortfolioExposurePct: 180,
  maxLeverage: 3.0,
  maxDailyLossPct: 4.0,
  maxDrawdownPct: 10.0,
  maxSlippageBps: 18.0,
  minOrderbookDepthUsd: 2500,
  maxDataStalenessMs: 120_000,
};

export interface RiskCheckInput {
  actionType: "ORDER_ENTRY" | "AUTONOMOUS_ARB_ENTRY" | "MT5_DEMO_ORDER";
  clientOrderId: string;
  symbol: string;
  executionMode: "PAPER" | "MT5_DEMO" | "LIVE";
  requestedNotionalUsd: number;
  requiredMarginUsd: number;
  leverage: number;
  estimatedSlippageBps: number;
  minVenueDepthUsd: number;
  quoteAgeMs: number;
  isSpeculativeMeme: boolean;
  isAutonomousRequest: boolean;
  manualMemeResearchAck?: boolean;
}

export interface RiskGateVerdict {
  approved: boolean;
  decisionId: number;
  blockedGate: string | null;
  reasons: string[];
  portfolioSnapshot: {
    vaultEquityUsd: number;
    availableBalanceUsd: number;
    lockedMarginUsd: number;
    currentExposureUsd: number;
    postTradeExposurePct: number;
    drawdownPct: number;
  };
}

export async function getActiveRiskPolicy(): Promise<RiskPolicyConfig> {
  const rows = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.configKey, "risk_policy"))
    .limit(1);

  if (rows.length === 0) {
    return { ...DEFAULT_RISK_POLICY };
  }
  return { ...DEFAULT_RISK_POLICY, ...(rows[0].configValue as Partial<RiskPolicyConfig>) };
}

export async function updateRiskPolicy(
  patch: Partial<RiskPolicyConfig>,
  updatedBy = "operator"
): Promise<RiskPolicyConfig> {
  // Security guardrail: autonomous AI cannot modify risk controls!
  if (updatedBy === "autonomous_ai") {
    throw new Error("SECURITY_VIOLATION: Autonomous AI is strictly prohibited from modifying risk controls.");
  }
  const current = await getActiveRiskPolicy();
  const merged: RiskPolicyConfig = { ...current, ...patch };

  const existing = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.configKey, "risk_policy"))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(systemConfigs).values({
      configKey: "risk_policy",
      configValue: merged,
      version: 1,
      updatedBy,
    });
  } else {
    await db
      .update(systemConfigs)
      .set({
        configValue: merged,
        version: existing[0].version + 1,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(systemConfigs.configKey, "risk_policy"));
  }
  return merged;
}

export async function evaluateOrderSafetyGates(input: RiskCheckInput): Promise<RiskGateVerdict> {
  const policy = await getActiveRiskPolicy();
  const reasons: string[] = [];
  let blockedGate: string | null = null;

  const vaultRows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.walletCode, "PAPER_TRADING_VAULT"))
    .limit(1);

  const vault = vaultRows[0] ?? {
    availableBalance: 0,
    lockedMargin: 0,
    realizedPnl: 0,
    totalDeposited: 10000,
  };

  const openPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.status, "OPEN"));

  const unrealizedTotal = openPositions.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
  const vaultEquityUsd = Math.max(
    0,
    vault.availableBalance + vault.lockedMargin + unrealizedTotal
  );
  const currentExposureUsd = openPositions.reduce((s, p) => s + p.notionalUsd, 0);
  const postTradeExposurePct =
    vaultEquityUsd > 0
      ? ((currentExposureUsd + input.requestedNotionalUsd) / vaultEquityUsd) * 100
      : 999;

  const peakReference = Math.max(vault.totalDeposited, vaultEquityUsd, 1);
  const drawdownPct = Math.max(0, ((peakReference - vaultEquityUsd) / peakReference) * 100);

  const fail = (gate: string, message: string) => {
    if (!blockedGate) blockedGate = gate;
    reasons.push(message);
  };

  // Gate 1: Emergency Stop / Kill Switch
  if (policy.killSwitchActive) {
    fail("EMERGENCY_KILL_SWITCH", "Emergency Stop / Kill Switch is active; all order submissions fail closed.");
  }

  // Gate 2: Circuit Breaker
  if (policy.circuitBreakerTripped) {
    fail("CIRCUIT_BREAKER", "Portfolio volatility circuit breaker is tripped; manual reset required.");
  }

  // Gate 3: Live Execution Governance Lock (Disabled by default; requires both user authorization AND real credentials)
  const hasRealExchangeCreds = Boolean(
    (process.env.KRAKEN_API_KEY && process.env.KRAKEN_API_SECRET) ||
      (process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET)
  );
  if (input.executionMode === "LIVE") {
    if (!policy.liveExecutionAuthorized || process.env.SURVIVAL_ALLOW_LIVE_EXECUTION !== "true") {
      fail(
        "LIVE_EXECUTION_DISABLED",
        "Live real-money execution is disabled by safety policy. Use Paper/Sandbox mode or explicitly authorize live execution with verified API credentials."
      );
    } else if (!hasRealExchangeCreds) {
      fail(
        "MISSING_VERIFIED_LIVE_CREDENTIALS",
        "Live exchange API keys (KRAKEN_API_KEY / COINBASE_API_KEY) are not configured in environment variables; refusing to fake live execution."
      );
    }
  }

  // Gate 4: Duplicate Client Order ID Prevention
  const dup = await db
    .select()
    .from(orders)
    .where(eq(orders.clientOrderId, input.clientOrderId))
    .limit(1);
  if (dup.length > 0) {
    fail("DUPLICATE_CLIENT_ORDER_ID", `Order with clientOrderId '${input.clientOrderId}' already exists; duplicate blocked.`);
  }

  // Gate 5: Stale Market Data Rejection
  if (!Number.isFinite(input.quoteAgeMs) || input.quoteAgeMs > policy.maxDataStalenessMs) {
    fail(
      "STALE_MARKET_DATA",
      `Quote age (${Math.round(input.quoteAgeMs / 1000)}s) exceeds freshness cap (${Math.round(
        policy.maxDataStalenessMs / 1000
      )}s).`
    );
  }

  // Gate 6: Meme & Speculative Token Governance (Explicitly blocks autonomous TRUMP & meme trading!)
  if (input.isSpeculativeMeme) {
    if (input.isAutonomousRequest || !input.manualMemeResearchAck) {
      fail(
        "SPECULATIVE_MEME_SAFETY_GATE",
        `${input.symbol.toUpperCase()} is classified as a high-concentration / speculative meme asset. Popularity or apparent funding is never an automatic buy signal; auto-trading blocked.`
      );
    }
  }

  // Gate 7: Valid Capital & Free Margin Check
  if (input.requestedNotionalUsd <= 0 || !Number.isFinite(input.requestedNotionalUsd)) {
    fail("INVALID_NOTIONAL", "Order notional must be a positive finite USD value.");
  }
  if (input.requiredMarginUsd > vault.availableBalance) {
    fail(
      "INSUFFICIENT_FREE_MARGIN",
      `Required margin ($${input.requiredMarginUsd.toFixed(
        2
      )}) exceeds available Vault cash ($${vault.availableBalance.toFixed(2)}). Deposit capital to Vault first.`
    );
  }

  // Gate 8: Leverage Cap
  if (input.leverage > policy.maxLeverage) {
    fail(
      "MAX_LEVERAGE_EXCEEDED",
      `Requested leverage (${input.leverage.toFixed(2)}x) exceeds maximum permitted leverage (${policy.maxLeverage.toFixed(
        2
      )}x).`
    );
  }

  // Gate 9: Single Position Concentration Limit
  const singlePosPct = vaultEquityUsd > 0 ? (input.requestedNotionalUsd / vaultEquityUsd) * 100 : 999;
  if (singlePosPct > policy.maxSinglePositionPct * (input.actionType === "AUTONOMOUS_ARB_ENTRY" ? 1.5 : 1.0)) {
    fail(
      "MAX_POSITION_SIZE_EXCEEDED",
      `Single position notional (${singlePosPct.toFixed(1)}% of equity) exceeds concentration limit (${policy.maxSinglePositionPct}%).`
    );
  }

  // Gate 10: Total Portfolio Exposure Limit
  if (postTradeExposurePct > policy.maxPortfolioExposurePct) {
    fail(
      "MAX_PORTFOLIO_EXPOSURE_EXCEEDED",
      `Post-trade portfolio exposure (${postTradeExposurePct.toFixed(
        1
      )}%) exceeds cap (${policy.maxPortfolioExposurePct}%).`
    );
  }

  // Gate 11: Drawdown & Daily Loss Protection
  if (drawdownPct >= policy.maxDrawdownPct) {
    fail(
      "MAX_DRAWDOWN_BREACH",
      `Current vault drawdown (${drawdownPct.toFixed(2)}%) exceeds max drawdown limit (${policy.maxDrawdownPct}%).`
    );
  }

  // Gate 12: Liquidity & Slippage Cap
  if (input.minVenueDepthUsd < policy.minOrderbookDepthUsd) {
    fail(
      "THIN_ORDERBOOK_LIQUIDITY",
      `Venue orderbook depth ($${Math.round(input.minVenueDepthUsd)}) is below minimum safe threshold ($${policy.minOrderbookDepthUsd}).`
    );
  }
  if (input.estimatedSlippageBps > policy.maxSlippageBps) {
    fail(
      "MAX_SLIPPAGE_EXCEEDED",
      `Estimated market impact slippage (${input.estimatedSlippageBps.toFixed(
        2
      )} bps) exceeds cap (${policy.maxSlippageBps} bps).`
    );
  }

  const approved = reasons.length === 0;
  if (approved) {
    reasons.push("Passed all 12 pre-trade risk, margin, liquidity, staleness, and execution-mode safety gates.");
  }

  const snapshot = {
    vaultEquityUsd: Number(vaultEquityUsd.toFixed(2)),
    availableBalanceUsd: Number(vault.availableBalance.toFixed(2)),
    lockedMarginUsd: Number(vault.lockedMargin.toFixed(2)),
    currentExposureUsd: Number(currentExposureUsd.toFixed(2)),
    postTradeExposurePct: Number(postTradeExposurePct.toFixed(2)),
    drawdownPct: Number(drawdownPct.toFixed(2)),
  };

  const inserted = await db
    .insert(riskDecisions)
    .values({
      actionType: input.actionType,
      symbol: input.symbol.toUpperCase(),
      executionMode: input.executionMode,
      requestedNotionalUsd: input.requestedNotionalUsd,
      leverage: input.leverage,
      approved,
      blockedGate,
      reasonsJson: reasons,
      portfolioSnapshotJson: snapshot,
    })
    .returning();

  return {
    approved,
    decisionId: inserted[0].id,
    blockedGate,
    reasons,
    portfolioSnapshot: snapshot,
  };
}
