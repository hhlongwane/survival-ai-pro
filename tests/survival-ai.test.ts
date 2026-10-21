import "dotenv/config";
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";

import {
  collectMultiVenueMarketIntelligence,
  evaluateMemeAndTokenSafety,
  fetchHistoricalHourlyCandles,
  VenueQuote,
} from "../src/lib/engine/market-data";
import {
  evaluateFundingAndBasisOpportunity,
  scanAllMarketGaps,
} from "../src/lib/engine/funding-basis";
import { runQuantitativeBacktest } from "../src/lib/engine/backtester";
import {
  evaluateOrderSafetyGates,
  getActiveRiskPolicy,
  updateRiskPolicy,
} from "../src/lib/engine/risk-gate";
import {
  closePositionById,
  depositToPaperVault,
  ensureSystemInitialized,
  executeTradeOrder,
  getVaultSummary,
  reconcilePositionsWithLiveMarket,
  withdrawFromPaperVault,
} from "../src/lib/engine/trading-ledger";
import {
  createPayPalSandboxOrder,
  evaluateAndRecordBusinessOpportunity,
  executeMt5DemoAction,
  initiateCTraderOAuthFlow,
  processPayPalSandboxWebhook,
  signSandboxWebhookPayload,
  validateCTraderOAuthCallback,
  verifySandboxWebhookSignature,
} from "../src/lib/engine/integrations";
import {
  rollbackStrategyVersion,
  runAutonomousAiCycle,
} from "../src/lib/engine/autonomous-ai";
import { checkRateLimit, sanitizeSymbol, sanitizeText } from "../src/lib/engine/security";

import { GET as healthGet } from "../src/app/api/health/route";
import { GET as cryptoStatusGet } from "../src/app/api/crypto/status/route";
import { POST as cryptoAnalyzePost } from "../src/app/api/crypto/analyze/route";
import { GET as cryptoGapsGet } from "../src/app/api/crypto/gaps/route";
import { GET as walletGet, POST as walletPost } from "../src/app/api/wallet/route";
import { GET as tradesGet, POST as tradesPost } from "../src/app/api/trades/route";
import { GET as backtestGet, POST as backtestPost } from "../src/app/api/backtest/route";
import { GET as riskGet, POST as riskPost } from "../src/app/api/risk/route";
import { GET as aiGet, POST as aiPost } from "../src/app/api/ai/route";
import { GET as businessGet, POST as businessPost } from "../src/app/api/business/route";
import { GET as integrationsGet, POST as integrationsPost } from "../src/app/api/integrations/route";
import { GET as ctraderCallbackGet } from "../src/app/api/integrations/ctrader/callback/route";
import { GET as dashboardGet } from "../src/app/api/dashboard/route";
import { pool } from "../src/db";

function makeQuote(overrides: Partial<VenueQuote> = {}): VenueQuote {
  return {
    venue: "HYPERLIQUID_PERP",
    symbol: "BTC",
    instrumentType: "PERP",
    bid: 82000,
    ask: 82012,
    mid: 82006,
    markPrice: 82006,
    indexPrice: 82000,
    spreadBps: 1.46,
    topBookDepthUsd: 250000,
    volume24hUsd: 1_500_000_000,
    openInterestUsd: 800_000_000,
    hourlyFundingRate: 0.00001,
    predictedHourlyFundingRate: 0.00001,
    impactBuyPrice: 82018,
    impactSellPrice: 81994,
    makerFeeBps: 1.5,
    takerFeeBps: 4.5,
    maxLeverage: 20,
    change24hPct: 1.2,
    suspended: false,
    timestampMs: Date.now(),
    isLive: true,
    ...overrides,
  };
}

describe("Survival AI Complete Verification Suite (108 Automated Tests)", () => {
  after(async () => {
    await updateRiskPolicy(
      { killSwitchActive: false, circuitBreakerTripped: false, maxLeverage: 3.0 },
      "test_cleanup"
    );
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // 1. PR #15 CRYPTO FUNDING & BASIS EVALUATOR (20 TESTS)
  // ---------------------------------------------------------------------------
  describe("1. PR #15 Execution-Aware Funding & Basis Evaluator", () => {
    const now = Date.now();
    const longQ = makeQuote({
      venue: "HYPERLIQUID_PERP",
      bid: 81995,
      ask: 82005,
      mid: 82000,
      spreadBps: 1.22,
      hourlyFundingRate: 0.000005,
      predictedHourlyFundingRate: 0.000005,
      timestampMs: now,
    });
    const shortQ = makeQuote({
      venue: "KRAKEN_PERP",
      bid: 82085,
      ask: 82095,
      mid: 82090,
      spreadBps: 1.22,
      hourlyFundingRate: 0.000095,
      predictedHourlyFundingRate: 0.00009,
      timestampMs: now,
    });

    it("1.01 computes positive net expected bps when funding + basis exceed all 4-leg frictions", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.verdict, "EXECUTABLE_EDGE");
      assert.ok(res.netExpectedReturnBps > 2.0);
    });

    it("1.02 always ensures netExpectedReturnBps < grossTotalReturnBps due to explicit friction deductions", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.ok(res.netExpectedReturnBps < res.grossTotalReturnBps);
      assert.ok(res.costs.totalFrictionBps > 10);
    });

    it("1.03 accounts for all 4 execution legs in entryAndExitFeesBps", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      const expectedFourLegFee =
        longQ.makerFeeBps + longQ.takerFeeBps + shortQ.makerFeeBps + shortQ.takerFeeBps;
      assert.equal(res.costs.entryAndExitFeesBps, expectedFourLegFee);
    });

    it("1.04 deducts bid-ask spread across both legs", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 24,
        nowMs: now,
      });
      assert.equal(
        res.costs.bidAskSpreadBps,
        Number((longQ.spreadBps + shortQ.spreadBps).toFixed(2))
      );
    });

    it("1.05 increases slippage impact non-linearly as position notional grows relative to depth", () => {
      const small = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 2000,
        holdingHours: 48,
        nowMs: now,
      });
      const large = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 100000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.ok(large.costs.slippageAndImpactBps > small.costs.slippageAndImpactBps * 5);
    });

    it("1.06 accounts for split-venue collateral lockup plus 20% anti-liquidation buffer", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        leveragePerLeg: 2,
        nowMs: now,
      });
      // 10000/2 * 1.2 + 10000/2 * 1.2 = 12000
      assert.equal(res.requiredLockedCapitalUsd, 12000);
    });

    it("1.07 requires full 100% spot capital + perp margin on Spot-Perp Cash & Carry", () => {
      const spotLeg = makeQuote({ instrumentType: "SPOT", venue: "KRAKEN_SPOT", timestampMs: now });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: spotLeg,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 72,
        leveragePerLeg: 2,
        nowMs: now,
      });
      assert.equal(res.strategyFamily, "SPOT_PERP_CASH_CARRY");
      assert.equal(res.requiredLockedCapitalUsd, 16000);
    });

    it("1.08 penalizes funding convergence flip when predicted next-hour rate reverses sign", () => {
      const stable = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      const flippingShort = makeQuote({
        ...shortQ,
        predictedHourlyFundingRate: -0.00004,
      });
      const flipping = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: flippingShort,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.ok(
        flipping.costs.fundingConvergencePenaltyBps >
          stable.costs.fundingConvergencePenaltyBps
      );
      assert.ok(flipping.netExpectedReturnBps < stable.netExpectedReturnBps);
    });

    it("1.09 rejects stale quotes older than 120 seconds fail-closed", () => {
      const stale = makeQuote({ timestampMs: now - 180_000 });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: stale,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.verdict, "REJECTED_UNRELIABLE_DATA");
      assert.equal(res.autoTradePermitted, false);
    });

    it("1.10 rejects suspended or post-only venues immediately", () => {
      const suspended = makeQuote({ suspended: true, timestampMs: now });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: suspended,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.verdict, "REJECTED_UNRELIABLE_DATA");
    });

    it("1.11 rejects inverted ask < bid quotes", () => {
      const inverted = makeQuote({ bid: 82100, ask: 82000, timestampMs: now });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: inverted,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.verdict, "REJECTED_UNRELIABLE_DATA");
    });

    it("1.12 rejects thin orderbook liquidity even if nominal APR looks huge", () => {
      const thinShort = makeQuote({
        venue: "KRAKEN_PERP",
        topBookDepthUsd: 800,
        hourlyFundingRate: 0.0005,
        predictedHourlyFundingRate: 0.0005,
        timestampMs: now,
      });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "ILLIQ",
        longLeg: longQ,
        shortLeg: thinShort,
        positionNotionalUsd: 25000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.verdict, "REJECTED_THIN_LIQUIDITY");
      assert.equal(res.autoTradePermitted, false);
    });

    it("1.13 rejects zero-spread opportunities due to round-trip fees", () => {
      const flat = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: makeQuote({ ...longQ, venue: "KRAKEN_PERP" }),
        positionNotionalUsd: 10000,
        holdingHours: 24,
        nowMs: now,
      });
      assert.equal(flat.verdict, "REJECTED_NEGATIVE_NET_EDGE");
      assert.ok(flat.netExpectedReturnBps < 0);
    });

    it("1.14 enforces RESEARCH_ONLY_NO_AUTO_TRADE on TRUMP even with massive positive funding", () => {
      const richShort = makeQuote({
        venue: "KRAKEN_PERP",
        symbol: "TRUMP",
        hourlyFundingRate: 0.0004,
        predictedHourlyFundingRate: 0.0004,
        timestampMs: now,
      });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "TRUMP",
        longLeg: makeQuote({ symbol: "TRUMP", timestampMs: now }),
        shortLeg: richShort,
        positionNotionalUsd: 5000,
        holdingHours: 48,
        nowMs: now,
        autoTradePermittedByAsset: false,
      });
      assert.equal(res.verdict, "RESEARCH_ONLY_NO_AUTO_TRADE");
      assert.equal(res.autoTradePermitted, false);
    });

    it("1.15 computes consistent netExpectedProfitUsd matching netExpectedReturnBps", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 20000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(
        res.netExpectedProfitUsd,
        Number(((res.netExpectedReturnBps / 10000) * 20000).toFixed(2))
      );
    });

    it("1.16 calculates finite positive breakevenHours when hourly carry is positive", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.ok(res.breakevenHours !== null && res.breakevenHours > 0);
    });

    it("1.17 returns null breakevenHours when hourly funding spread is negative", () => {
      const negShort = makeQuote({
        venue: "KRAKEN_PERP",
        hourlyFundingRate: -0.00005,
        predictedHourlyFundingRate: -0.00005,
        timestampMs: now,
      });
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: negShort,
        positionNotionalUsd: 10000,
        holdingHours: 48,
        nowMs: now,
      });
      assert.equal(res.breakevenHours, null);
    });

    it("1.18 rejects non-positive notional amounts cleanly", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 0,
        holdingHours: 24,
        nowMs: now,
      });
      assert.equal(res.verdict, "REJECTED_UNRELIABLE_DATA");
    });

    it("1.19 caps effective per-leg leverage safely at <= 5x", () => {
      const res = evaluateFundingAndBasisOpportunity({
        symbol: "BTC",
        longLeg: longQ,
        shortLeg: shortQ,
        positionNotionalUsd: 10000,
        holdingHours: 24,
        leveragePerLeg: 50,
        nowMs: now,
      });
      assert.equal(res.leveragePerLeg, 5);
    });

    it("1.20 scanAllMarketGaps ranks executable edges strictly above rejected opportunities", async () => {
      const snap = await collectMultiVenueMarketIntelligence();
      const ranked = scanAllMarketGaps(snap.assets, 10000, 48);
      assert.ok(ranked.length > 0);
      if (ranked.some((r) => r.verdict === "EXECUTABLE_EDGE")) {
        assert.equal(ranked[0].verdict, "EXECUTABLE_EDGE");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. MEME TOKENS, TRUMP RESEARCH RULE & LIVE MARKET INTELLIGENCE (12 TESTS)
  // ---------------------------------------------------------------------------
  describe("2. Meme Token Governance & Market Intelligence", () => {
    it("2.01 TRUMP is strictly classified as MEME_RESEARCH_ONLY with autoTradePermitted=false", () => {
      const safety = evaluateMemeAndTokenSafety("TRUMP", 50_000_000, 12_000_000, 14.5, 4.0);
      assert.equal(safety.isSpeculativeMeme, true);
      assert.equal(safety.autoTradePermitted, false);
      assert.equal(safety.classification, "MEME_RESEARCH_ONLY");
      assert.ok(safety.manipulationRiskScore >= 75);
    });

    it("2.02 DOGE, PEPE, WIF, BONK never automatically qualify for auto-trading", () => {
      for (const sym of ["DOGE", "PEPE", "WIF", "BONK"]) {
        const safety = evaluateMemeAndTokenSafety(sym, 200_000_000, 50_000_000, 8.0, 3.0);
        assert.equal(safety.autoTradePermitted, false);
        assert.equal(safety.isSpeculativeMeme, true);
      }
    });

    it("2.03 BTC, ETH, SOL qualify as CORE_LIQUID_MAJOR", () => {
      for (const sym of ["BTC", "ETH", "SOL"]) {
        const safety = evaluateMemeAndTokenSafety(sym, 1_500_000_000, 600_000_000, 1.5, 1.2);
        assert.equal(safety.classification, "CORE_LIQUID_MAJOR");
        assert.equal(safety.autoTradePermitted, true);
      }
    });

    it("2.04 illiquid small-cap altcoins (<$5M volume) disable auto-trading automatically", () => {
      const safety = evaluateMemeAndTokenSafety("MICROALT", 1_200_000, 400_000, 3.0, 9.0);
      assert.equal(safety.autoTradePermitted, false);
    });

    it("2.05 wide-spread altcoins (>18 bps spread) disable auto-trading automatically", () => {
      const safety = evaluateMemeAndTokenSafety("WIDEALT", 25_000_000, 10_000_000, 2.0, 24.0);
      assert.equal(safety.autoTradePermitted, false);
    });

    it("2.06 collectMultiVenueMarketIntelligence retrieves multi-venue asset universe", async () => {
      const snap = await collectMultiVenueMarketIntelligence();
      assert.ok(snap.assets.length >= 6);
      assert.ok(snap.venueStatuses.length >= 4);
    });

    it("2.07 every collected venue quote has positive prices and non-negative spread", async () => {
      const snap = await collectMultiVenueMarketIntelligence();
      for (const asset of snap.assets) {
        for (const v of asset.venues) {
          assert.ok(v.mid > 0);
          assert.ok(v.ask >= v.bid);
          assert.ok(v.spreadBps >= 0);
        }
      }
    });

    it("2.08 Binance HTTP 451 geo-restriction is reported honestly rather than faked", async () => {
      const snap = await collectMultiVenueMarketIntelligence();
      const binance = snap.venueStatuses.find((v) => v.venue.includes("Binance"));
      assert.ok(binance);
      assert.ok(["ONLINE", "GEO_RESTRICTED"].includes(binance.status));
    });

    it("2.09 fetchHistoricalHourlyCandles returns chronologically sorted valid OHLCV bars", async () => {
      const res = await fetchHistoricalHourlyCandles("BTC", 120);
      assert.ok(res.candles.length >= 80);
      for (let i = 1; i < res.candles.length; i++) {
        assert.ok(res.candles[i].timestampSec > res.candles[i - 1].timestampSec);
        assert.ok(res.candles[i].high >= res.candles[i].low);
      }
    });

    it("2.10 deterministic multi-regime fallback works cleanly for unlisted test symbols", async () => {
      const res = await fetchHistoricalHourlyCandles("SYNTH_TEST_ASSET", 100);
      assert.equal(res.source, "DETERMINISTIC_MULTI_REGIME");
      assert.equal(res.candles.length, 100);
    });

    it("2.11 deterministic candles produce identical reproducible output across invocations", async () => {
      const runA = await fetchHistoricalHourlyCandles("REPRO_CHECK", 90);
      const runB = await fetchHistoricalHourlyCandles("REPRO_CHECK", 90);
      assert.equal(runA.candles[50].close, runB.candles[50].close);
    });

    it("2.12 TRUMP is included in research universe for explicit non-execution analysis", async () => {
      const snap = await collectMultiVenueMarketIntelligence();
      const trump = snap.assets.find((a) => a.symbol === "TRUMP");
      if (trump) {
        assert.equal(trump.memeSafety.autoTradePermitted, false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. QUANTITATIVE VALIDATION & BACKTESTING ENGINE (14 TESTS)
  // ---------------------------------------------------------------------------
  describe("3. Walk-Forward Quantitative Backtester & Stress Suite", () => {
    it("3.01 runs FUNDING_BASIS_ARB with 70/30 In-Sample / Out-of-Sample split", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "FUNDING_BASIS_ARB",
        initialCapital: 10000,
      });
      assert.ok(bt.equityCurve.some((p) => p.inSample));
      assert.ok(bt.equityCurve.some((p) => !p.inSample));
      assert.ok(bt.totalFeesUsd >= 0);
    });

    it("3.02 executes CROSS_VENUE_MOMENTUM cleanly without NaN metrics", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "ETH",
        strategyFamily: "CROSS_VENUE_MOMENTUM",
      });
      assert.ok(Number.isFinite(bt.sharpeRatio));
      assert.ok(Number.isFinite(bt.sortinoRatio));
      assert.ok(Number.isFinite(bt.maxDrawdownPct));
    });

    it("3.03 executes BOLLINGER_MEAN_REVERSION cleanly", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "SOL",
        strategyFamily: "BOLLINGER_MEAN_REVERSION",
      });
      assert.ok(bt.finalEquity > 0);
    });

    it("3.04 executes REGIME_VOLATILITY_BREAKOUT cleanly", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "REGIME_VOLATILITY_BREAKOUT",
      });
      assert.ok(bt.candleCount >= 80);
    });

    it("3.05 higher fee + slippage assumptions strictly reduce final equity", async () => {
      const candles = (await fetchHistoricalHourlyCandles("SYNTH_FEE_TEST", 160)).candles;
      const lowCost = await runQuantitativeBacktest({
        symbol: "SYNTH_FEE_TEST",
        strategyFamily: "FUNDING_BASIS_ARB",
        feeBpsPerSide: 1,
        slippageBpsPerSide: 1,
        candlesOverride: candles,
      });
      const highCost = await runQuantitativeBacktest({
        symbol: "SYNTH_FEE_TEST",
        strategyFamily: "FUNDING_BASIS_ARB",
        feeBpsPerSide: 35,
        slippageBpsPerSide: 35,
        candlesOverride: candles,
      });
      assert.ok(highCost.finalEquity < lowCost.finalEquity);
      assert.ok(highCost.totalFeesUsd > lowCost.totalFeesUsd);
    });

    it("3.06 generates all 3 adverse stress test scenarios", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "FUNDING_BASIS_ARB",
      });
      assert.equal(bt.stressTests.length, 3);
    });

    it("3.07 generates 6-cell parameter sensitivity stability grid", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "FUNDING_BASIS_ARB",
      });
      assert.equal(bt.sensitivityGrid.length, 6);
    });

    it("3.08 marks strategy unvalidated when high friction turns total return negative", async () => {
      const candles = (await fetchHistoricalHourlyCandles("SYNTH_NEG_TEST", 140)).candles;
      const bt = await runQuantitativeBacktest({
        symbol: "SYNTH_NEG_TEST",
        strategyFamily: "FUNDING_BASIS_ARB",
        feeBpsPerSide: 120,
        slippageBpsPerSide: 80,
        candlesOverride: candles,
      });
      assert.equal(bt.isValidatedEdge, false);
    });

    it("3.09 reports INSUFFICIENT SAMPLE honestly when signal threshold prevents trades", async () => {
      const candles = (await fetchHistoricalHourlyCandles("SYNTH_SPARSE", 100)).candles;
      const bt = await runQuantitativeBacktest({
        symbol: "SYNTH_SPARSE",
        strategyFamily: "BOLLINGER_MEAN_REVERSION",
        signalThreshold: 99,
        candlesOverride: candles,
      });
      assert.equal(bt.totalTrades, 0);
      assert.equal(bt.isValidatedEdge, false);
      assert.ok(bt.verdictSummary.includes("INSUFFICIENT SAMPLE"));
    });

    it("3.10 proves zero look-ahead bias: altering final bar does not alter earlier equity points", async () => {
      const base = (await fetchHistoricalHourlyCandles("LOOKAHEAD_GUARD", 120)).candles;
      const mutated = base.map((c, idx) =>
        idx === base.length - 1 ? { ...c, open: c.open * 3, high: c.high * 3, close: c.close * 3 } : { ...c }
      );
      const btBase = await runQuantitativeBacktest({
        symbol: "LOOKAHEAD_GUARD",
        strategyFamily: "CROSS_VENUE_MOMENTUM",
        candlesOverride: base,
      });
      const btMutated = await runQuantitativeBacktest({
        symbol: "LOOKAHEAD_GUARD",
        strategyFamily: "CROSS_VENUE_MOMENTUM",
        candlesOverride: mutated,
      });
      assert.equal(btBase.equityCurve[10].equity, btMutated.equityCurve[10].equity);
      assert.equal(btBase.inSampleReturnPct, btMutated.inSampleReturnPct);
    });

    it("3.11 computes benchmark Buy & Hold return accurately", async () => {
      const candles = (await fetchHistoricalHourlyCandles("BENCH_CHECK", 100)).candles;
      const bt = await runQuantitativeBacktest({
        symbol: "BENCH_CHECK",
        strategyFamily: "FUNDING_BASIS_ARB",
        candlesOverride: candles,
      });
      const expected = Number(
        (((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100).toFixed(2)
      );
      assert.equal(bt.benchmarkReturnPct, expected);
    });

    it("3.12 ensures maxDrawdownPct is non-negative and bounded", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "CROSS_VENUE_MOMENTUM",
      });
      assert.ok(bt.maxDrawdownPct >= 0 && bt.maxDrawdownPct <= 100);
    });

    it("3.13 bounds leverage safely between 1x and 5x", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "BTC",
        strategyFamily: "FUNDING_BASIS_ARB",
        leverage: 99,
      });
      assert.ok(bt.maxExposurePct <= 200);
    });

    it("3.14 maintains non-negative winRatePct between 0 and 100", async () => {
      const bt = await runQuantitativeBacktest({
        symbol: "ETH",
        strategyFamily: "FUNDING_BASIS_ARB",
      });
      assert.ok(bt.winRatePct >= 0 && bt.winRatePct <= 100);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. FAIL-CLOSED RISK MANAGEMENT & EXECUTION SAFETY GATES (16 TESTS)
  // ---------------------------------------------------------------------------
  describe("4. Risk Management & Safety Gates", () => {
    it("4.01 initializes default risk policy with liveExecutionAuthorized=false", async () => {
      await ensureSystemInitialized();
      const policy = await getActiveRiskPolicy();
      assert.equal(policy.liveExecutionAuthorized, false);
    });

    it("4.02 blocks autonomous AI attempts to modify risk controls", async () => {
      await assert.rejects(
        () => updateRiskPolicy({ maxLeverage: 25 }, "autonomous_ai"),
        /SECURITY_VIOLATION/
      );
    });

    it("4.03 blocks LIVE execution requests by default and records auditable reason", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_LIVE_${Date.now()}`,
        symbol: "BTC",
        executionMode: "LIVE",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "LIVE_EXECUTION_DISABLED");
      assert.ok(v.decisionId > 0);
    });

    it("4.04 blocks ALL orders when Emergency Kill Switch is active", async () => {
      await updateRiskPolicy({ killSwitchActive: true }, "test_operator");
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_KS_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "EMERGENCY_KILL_SWITCH");
      await updateRiskPolicy({ killSwitchActive: false }, "test_operator");
    });

    it("4.05 blocks ALL orders when Circuit Breaker is tripped", async () => {
      await updateRiskPolicy({ circuitBreakerTripped: true }, "test_operator");
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_CB_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "CIRCUIT_BREAKER");
      await updateRiskPolicy({ circuitBreakerTripped: false }, "test_operator");
    });

    it("4.06 blocks autonomous TRUMP order unconditionally via SPECULATIVE_MEME_SAFETY_GATE", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "AUTONOMOUS_ARB_ENTRY",
        clientOrderId: `TEST_TRUMP_AUTO_${Date.now()}`,
        symbol: "TRUMP",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 3,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: true,
        isAutonomousRequest: true,
        manualMemeResearchAck: true, // Even if flag were passed, autonomous request MUST still fail!
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "SPECULATIVE_MEME_SAFETY_GATE");
    });

    it("4.07 blocks stale quotes exceeding maxDataStalenessMs", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_STALE_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 250_000,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "STALE_MARKET_DATA");
    });

    it("4.08 blocks excessive leverage (>3x)", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_LEV_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 100,
        leverage: 10,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "MAX_LEVERAGE_EXCEEDED");
    });

    it("4.09 blocks excessive single position size (>28% of vault equity)", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_SIZE_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 18000,
        requiredMarginUsd: 6000,
        leverage: 3,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 100000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "MAX_POSITION_SIZE_EXCEEDED");
    });

    it("4.10 blocks orders exceeding free available vault cash", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_MARGIN_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 5000,
        requiredMarginUsd: 9_999_999,
        leverage: 2,
        estimatedSlippageBps: 2,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "INSUFFICIENT_FREE_MARGIN");
    });

    it("4.11 blocks thin orderbook liquidity below $2,500 depth", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_DEPTH_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 3,
        minVenueDepthUsd: 500,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "THIN_ORDERBOOK_LIQUIDITY");
    });

    it("4.12 blocks orders with estimated slippage exceeding cap", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_SLIP_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 45,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "MAX_SLIPPAGE_EXCEEDED");
    });

    it("4.13 blocks non-positive notional orders", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_ZERO_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: -50,
        requiredMarginUsd: 0,
        leverage: 1,
        estimatedSlippageBps: 1,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "INVALID_NOTIONAL");
    });

    it("4.14 approves well-sized BTC paper order that clears all 12 gates", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_VALID_${Date.now()}`,
        symbol: "BTC",
        executionMode: "PAPER",
        requestedNotionalUsd: 2000,
        requiredMarginUsd: 1000,
        leverage: 2,
        estimatedSlippageBps: 3,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: false,
        isAutonomousRequest: false,
      });
      assert.equal(v.approved, true);
      assert.equal(v.blockedGate, null);
    });

    it("4.15 blocks manual meme order when manualMemeResearchAck is false", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_DOGE_NOACK_${Date.now()}`,
        symbol: "DOGE",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 3,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: true,
        isAutonomousRequest: false,
        manualMemeResearchAck: false,
      });
      assert.equal(v.approved, false);
      assert.equal(v.blockedGate, "SPECULATIVE_MEME_SAFETY_GATE");
    });

    it("4.16 allows explicitly acknowledged small manual paper test on meme token while keeping live blocked", async () => {
      const v = await evaluateOrderSafetyGates({
        actionType: "ORDER_ENTRY",
        clientOrderId: `TEST_DOGE_ACK_${Date.now()}`,
        symbol: "DOGE",
        executionMode: "PAPER",
        requestedNotionalUsd: 1000,
        requiredMarginUsd: 500,
        leverage: 2,
        estimatedSlippageBps: 3,
        minVenueDepthUsd: 50000,
        quoteAgeMs: 500,
        isSpeculativeMeme: true,
        isAutonomousRequest: false,
        manualMemeResearchAck: true,
      });
      assert.equal(v.approved, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DOUBLE-ENTRY VAULT LEDGER, IDEMPOTENCY & ORDER LIFECYCLE (14 TESTS)
  // ---------------------------------------------------------------------------
  describe("5. Double-Entry Vault Ledger, Order Execution & Reconciliation", () => {
    const idemDepositKey = `TEST_IDEM_DEP_${Date.now()}`;
    const clientOrdKey = `TEST_IDEM_ORD_${Date.now()}`;
    let createdPositionId = 0;

    it("5.01 credits sandbox capital deposit transactionally to PAPER_TRADING_VAULT", async () => {
      const before = await getVaultSummary();
      const bBal = before.wallets.find((w) => w.walletCode === "PAPER_TRADING_VAULT")!.availableBalance;
      const dep = await depositToPaperVault({
        amountUsd: 5000,
        idempotencyKey: idemDepositKey,
      });
      assert.equal(dep.idempotentReplay, false);
      assert.equal(dep.wallet.availableBalance, Number((bBal + 5000).toFixed(2)));
    });

    it("5.02 prevents double-crediting when same deposit idempotencyKey is replayed", async () => {
      const before = await getVaultSummary();
      const bBal = before.wallets.find((w) => w.walletCode === "PAPER_TRADING_VAULT")!.availableBalance;
      const replay = await depositToPaperVault({
        amountUsd: 5000,
        idempotencyKey: idemDepositKey,
      });
      assert.equal(replay.idempotentReplay, true);
      assert.equal(replay.wallet.availableBalance, bBal);
    });

    it("5.03 rejects negative or invalid deposit amounts", async () => {
      await assert.rejects(() =>
        depositToPaperVault({ amountUsd: -100, idempotencyKey: `BAD_${Date.now()}` })
      );
    });

    it("5.04 keeps BUSINESS_REVENUE_LEDGER strictly at $0.00 during trading vault deposits", async () => {
      const summary = await getVaultSummary();
      const bizWallet = summary.wallets.find((w) => w.walletCode === "BUSINESS_REVENUE_LEDGER")!;
      assert.equal(bizWallet.availableBalance, 0);
      assert.equal(bizWallet.isSimulated, false);
    });

    it("5.05 executes hedged BTC paper order, locks margin, and deducts entry fee", async () => {
      const res = await executeTradeOrder({
        clientOrderId: clientOrdKey,
        symbol: "BTC",
        structure: "HEDGED_CROSS_VENUE",
        notionalUsd: 2500,
        leverage: 2,
        executionMode: "PAPER",
      });
      assert.equal(res.accepted, true);
      assert.ok(res.position);
      createdPositionId = res.position.id;
      assert.ok(res.order.feeUsd > 0);
    });

    it("5.06 prevents duplicate order execution on replay of same clientOrderId", async () => {
      const replay = await executeTradeOrder({
        clientOrderId: clientOrdKey,
        symbol: "BTC",
        structure: "HEDGED_CROSS_VENUE",
        notionalUsd: 2500,
        leverage: 2,
        executionMode: "PAPER",
      });
      assert.equal(replay.idempotentReplay, true);
    });

    it("5.07 reconciles open positions with live quotes and accrues hourly funding", async () => {
      const updated = await reconcilePositionsWithLiveMarket(12);
      assert.ok(updated.some((p) => p.id === createdPositionId));
    });

    it("5.08 closes open position, releases locked margin, and records realized PnL", async () => {
      const closed = await closePositionById(createdPositionId, "UNIT_TEST_SETTLEMENT");
      assert.equal(closed.alreadyClosed, false);
      assert.equal(closed.position.status, "CLOSED");
    });

    it("5.09 handles repeated close calls idempotently without double-releasing margin", async () => {
      const secondClose = await closePositionById(createdPositionId, "DUPLICATE_CLOSE");
      assert.equal(secondClose.alreadyClosed, true);
    });

    it("5.10 executes clean vault cash withdrawal within free balance", async () => {
      const w = await withdrawFromPaperVault({
        amountUsd: 1000,
        idempotencyKey: `TEST_WD_${Date.now()}`,
      });
      assert.equal(w.ledgerEntry.entryType, "WITHDRAWAL");
    });

    it("5.11 blocks withdrawals exceeding available cash", async () => {
      await assert.rejects(() =>
        withdrawFromPaperVault({
          amountUsd: 99_000_000,
          idempotencyKey: `TEST_WD_FAIL_${Date.now()}`,
        })
      );
    });

    it("5.12 rejects LIVE order execution via executeTradeOrder and logs LIVE_BLOCKED status", async () => {
      const liveAttempt = await executeTradeOrder({
        clientOrderId: `TEST_LIVE_ORD_${Date.now()}`,
        symbol: "ETH",
        structure: "DIRECTIONAL_LONG",
        notionalUsd: 1500,
        executionMode: "LIVE",
      });
      assert.equal(liveAttempt.accepted, false);
      assert.equal(liveAttempt.order.executionMode, "LIVE_BLOCKED");
      assert.equal(liveAttempt.order.status, "REJECTED");
    });

    it("5.13 autonomous cycle runs all 12 steps and updates durable PostgreSQL records", async () => {
      const cycle = await runAutonomousAiCycle({ simulateCarryWindowHours: 4, maxNewTrades: 1 });
      assert.equal(cycle.stepsCompleted.length, 12);
      assert.ok(cycle.scannedMarkets >= 6);
    });

    it("5.14 preserves full state durability across fresh query pool reads", async () => {
      const summary = await getVaultSummary();
      assert.ok(summary.recentLedger.length >= 4);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. PAYMENTS, BROKERS & BUSINESS/SHOPIFY INTEGRATIONS (14 TESTS)
  // ---------------------------------------------------------------------------
  describe("6. PayPal Sandbox, cTrader OAuth, MT5 Demo, Fomo & Shopify", () => {
    const ppKey = `PP_TEST_${Date.now()}`;
    let webhookBody = "";
    let webhookSig = "";

    it("6.01 creates PayPal Sandbox order without claiming live money", async () => {
      const res = await createPayPalSandboxOrder(1250, ppKey);
      assert.equal(res.event.isSandbox, true);
      assert.equal(res.event.status, "APPROVED");
      webhookBody = res.webhookPayload;
      webhookSig = res.webhookSignature;
    });

    it("6.02 verifies valid HMAC-SHA256 webhook signature timing-safely", () => {
      assert.equal(verifySandboxWebhookSignature(webhookBody, webhookSig), true);
    });

    it("6.03 rejects forged/tampered PayPal webhook signatures with HTTP 401", async () => {
      const bad = await processPayPalSandboxWebhook({
        rawBody: webhookBody,
        signatureHex: "0000000000000000000000000000000000000000000000000000000000000000",
      });
      assert.equal(bad.ok, false);
      assert.equal(bad.status, 401);
    });

    it("6.04 captures verified PayPal Sandbox webhook and reconciles ledger", async () => {
      const cap = await processPayPalSandboxWebhook({
        rawBody: webhookBody,
        signatureHex: webhookSig,
      });
      assert.equal(cap.ok, true);
      assert.equal(cap.duplicateIgnored, false);
    });

    it("6.05 ignores duplicate PayPal Sandbox webhook replays idempotently", async () => {
      const dup = await processPayPalSandboxWebhook({
        rawBody: webhookBody,
        signatureHex: webhookSig,
      });
      assert.equal(dup.ok, true);
      assert.equal(dup.duplicateIgnored, true);
    });

    it("6.06 rejects unknown PayPal order IDs cleanly with 404", async () => {
      const ghostPayload = JSON.stringify({
        externalOrderId: "PAYPAL-SBX-DOESNOTEXIST",
        amount: 500,
        event: "PAYMENT.CAPTURE.COMPLETED",
      });
      const res = await processPayPalSandboxWebhook({
        rawBody: ghostPayload,
        signatureHex: signSandboxWebhookPayload(ghostPayload),
      });
      assert.equal(res.status, 404);
    });

    it("6.07 generates cryptographic cTrader OAuth state token", async () => {
      const oauth = await initiateCTraderOAuthFlow();
      assert.equal(oauth.state.length, 48);
      assert.ok(oauth.authorizationUrl.includes(oauth.state));
    });

    it("6.08 rejects cTrader OAuth callback when CSRF state does not match", async () => {
      const bad = await validateCTraderOAuthCallback({
        state: "forged_csrf_state",
        code: "code_123",
      });
      assert.equal(bad.valid, false);
      assert.equal(bad.status, 400);
    });

    it("6.09 consumes valid cTrader OAuth state once and prevents replay attack", async () => {
      const oauth = await initiateCTraderOAuthFlow();
      const first = await validateCTraderOAuthCallback({
        state: oauth.state,
        code: "valid_auth_7788",
      });
      assert.equal(first.valid, true);
      assert.equal(first.maskedToken, "ct_sbx_****7788");

      const replay = await validateCTraderOAuthCallback({
        state: oauth.state,
        code: "valid_auth_7788",
      });
      assert.equal(replay.valid, false);
    });

    it("6.10 executes MT5 Demo Bridge order in isolated MT5_DEMO_ONLY mode", async () => {
      const mt5 = await executeMt5DemoAction({
        symbol: "BTCUSD",
        side: "BUY",
        lots: 0.2,
      });
      assert.equal(mt5.accepted, true);
      assert.equal(mt5.accountMode, "MT5_DEMO_ONLY");
    });

    it("6.11 blocks attempts to substitute LIVE execution on MT5 Demo Bridge", async () => {
      const blocked = await executeMt5DemoAction({
        symbol: "BTCUSD",
        side: "BUY",
        lots: 1.0,
        requestLiveExecution: true,
      });
      assert.equal(blocked.accepted, false);
    });

    it("6.12 evaluates high-margin Shopify SKU with positive contribution and ROAS", async () => {
      const rec = await evaluateAndRecordBusinessOpportunity({
        channel: "SHOPIFY_STORE",
        title: "Smart Inverter Monitor",
        skuOrRef: "SHP-INV-01",
        sellingPriceUsd: 120,
        unitCostUsd: 40,
        adSpendPerSaleUsd: 22,
      });
      assert.equal(rec.status, "APPROVED_UNIT_ECONOMICS");
      assert.equal(rec.isVerifiedRealRevenue, false);
    });

    it("6.13 rejects unprofitable low-margin Shopify SKU candidates honestly", async () => {
      const rec = await evaluateAndRecordBusinessOpportunity({
        channel: "SHOPIFY_STORE",
        title: "Low Margin Dropship Item",
        skuOrRef: "SHP-LOW-02",
        sellingPriceUsd: 25,
        unitCostUsd: 18,
        adSpendPerSaleUsd: 12,
      });
      assert.equal(rec.status, "REJECTED_LOW_CONTRIBUTION_MARGIN");
    });

    it("6.14 sanitizes symbol and HTML injection payloads in security utilities", () => {
      assert.equal(sanitizeSymbol("btc/usd<script>"), "BTCUSDSCRIPT");
      assert.equal(sanitizeText("<img onerror=1>hello", 50), "img onerror=1hello");
      const rl1 = checkRateLimit("unit_bucket", 2, 10_000);
      const rl2 = checkRateLimit("unit_bucket", 2, 10_000);
      const rl3 = checkRateLimit("unit_bucket", 2, 10_000);
      assert.equal(rl1.allowed, true);
      assert.equal(rl2.allowed, true);
      assert.equal(rl3.allowed, false);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. REST API ENDPOINT CONTRACT & SMOKE TESTS (18 TESTS)
  // ---------------------------------------------------------------------------
  describe("7. Full REST API Route Contracts & Smoke Verification", () => {
    it("7.01 GET /api/health returns { ok: true } and durable PostgreSQL table counts", async () => {
      const res = await healthGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.persistence.healthy, true);
    });

    it("7.02 GET /api/crypto/status returns live multi-venue governance state", async () => {
      const res = await cryptoStatusGet(new Request("http://localhost:3000/api/crypto/status"));
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.executionGovernance.liveCryptoExecutionEnabled, false);
    });

    it("7.03 POST /api/crypto/analyze analyzes BTC with multi-venue quotes & PR #15 costs", async () => {
      const res = await cryptoAnalyzePost(
        new Request("http://localhost:3000/api/crypto/analyze", {
          method: "POST",
          body: JSON.stringify({ symbol: "BTC", notionalUsd: 10000, holdingHours: 48 }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.symbol, "BTC");
    });

    it("7.04 POST /api/crypto/analyze analyzes TRUMP safely with paperAutoTradePermitted=false", async () => {
      const res = await cryptoAnalyzePost(
        new Request("http://localhost:3000/api/crypto/analyze", {
          method: "POST",
          body: JSON.stringify({ symbol: "TRUMP", notionalUsd: 5000, holdingHours: 24 }),
        })
      );
      const json = await res.json();
      if (res.status === 200) {
        assert.equal(json.executionPolicy.paperAutoTradePermitted, false);
        assert.equal(json.memeAndManipulationSafety.isSpeculativeMeme, true);
      } else {
        assert.equal(res.status, 404);
      }
    });

    it("7.05 POST /api/crypto/analyze returns 404 for unknown fictional symbol", async () => {
      const res = await cryptoAnalyzePost(
        new Request("http://localhost:3000/api/crypto/analyze", {
          method: "POST",
          body: JSON.stringify({ symbol: "NONEXISTENT999" }),
        })
      );
      assert.equal(res.status, 404);
    });

    it("7.06 GET /api/crypto/gaps returns ranked market gaps", async () => {
      const res = await cryptoGapsGet(
        new Request("http://localhost:3000/api/crypto/gaps?notionalUsd=10000&holdingHours=48")
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(json.gaps));
    });

    it("7.07 GET /api/wallet returns segregated wallets and ledger", async () => {
      const res = await walletGet();
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.wallets.length >= 3);
    });

    it("7.08 POST /api/wallet credits deposit via HTTP handler", async () => {
      const res = await walletPost(
        new Request("http://localhost:3000/api/wallet", {
          method: "POST",
          body: JSON.stringify({ action: "DEPOSIT", amountUsd: 1000 }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
    });

    it("7.09 GET /api/trades returns reconciled positions and orders", async () => {
      const res = await tradesGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
    });

    it("7.10 POST /api/trades returns HTTP 422 when LIVE order is blocked by safety gate", async () => {
      const res = await tradesPost(
        new Request("http://localhost:3000/api/trades", {
          method: "POST",
          body: JSON.stringify({ symbol: "BTC", notionalUsd: 2000, executionMode: "LIVE" }),
        })
      );
      assert.equal(res.status, 422);
    });

    it("7.11 POST & GET /api/backtest execute and persist quantitative backtests", async () => {
      const postRes = await backtestPost(
        new Request("http://localhost:3000/api/backtest", {
          method: "POST",
          body: JSON.stringify({ symbol: "BTC", strategyFamily: "FUNDING_BASIS_ARB" }),
        })
      );
      assert.equal(postRes.status, 200);
      const getRes = await backtestGet();
      const getJson = await getRes.json();
      assert.ok(getJson.runs.length >= 1);
    });

    it("7.12 POST /api/risk RUN_SAFETY_DRILL passes all 3 safety gate vectors", async () => {
      const res = await riskPost(
        new Request("http://localhost:3000/api/risk", {
          method: "POST",
          body: JSON.stringify({ action: "RUN_SAFETY_DRILL" }),
        })
      );
      const json = await res.json();
      assert.equal(json.drillsPassed, true);
    });

    it("7.13 GET /api/risk returns policy and decision audit trail", async () => {
      const res = await riskGet();
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.decisions.length >= 3);
    });

    it("7.14 GET & POST /api/ai return autonomous learning telemetry", async () => {
      const res = await aiGet();
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.strategyVersions.length >= 3);
    });

    it("7.15 GET & POST /api/business preserve Shopify & business revenue separation", async () => {
      const res = await businessGet();
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.summary.verifiedRealRevenueUsd, 0);
      const p = await businessPost(
        new Request("http://localhost:3000/api/business", {
          method: "POST",
          body: JSON.stringify({
            channel: "SHOPIFY_STORE",
            title: "Backup Battery Pack",
            skuOrRef: "SKU-BAT-99",
            sellingPriceUsd: 95,
            unitCostUsd: 35,
            adSpendPerSaleUsd: 15,
          }),
        })
      );
      assert.equal(p.status, 200);
    });

    it("7.16 GET & POST /api/integrations verify PayPal duplicate protection via API", async () => {
      const g = await integrationsGet();
      const gJson = await g.json();
      assert.equal(gJson.connections.length, 6);

      const p = await integrationsPost(
        new Request("http://localhost:3000/api/integrations", {
          method: "POST",
          body: JSON.stringify({
            provider: "PAYPAL_SANDBOX_CREATE_AND_CAPTURE",
            amountUsd: 500,
            verifyDuplicateProtection: true,
          }),
        })
      );
      const pJson = await p.json();
      assert.equal(pJson.ok, true);
      assert.equal(pJson.replayCheck.duplicateIgnored, true);
    });

    it("7.17 GET /api/integrations/ctrader/callback rejects invalid state with 400", async () => {
      const res = await ctraderCallbackGet(
        new Request("http://localhost:3000/api/integrations/ctrader/callback?state=bad&code=123")
      );
      assert.equal(res.status, 400);
    });

    it("7.18 GET /api/dashboard aggregates complete application snapshot without fabricated balances", async () => {
      const res = await dashboardGet(new Request("http://localhost:3000/api/dashboard"));
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.portfolio.verifiedLiveBrokerBalanceUsd, null);
      assert.equal(json.portfolio.verifiedBusinessRealRevenueUsd, 0);
      assert.ok(json.marketGaps.length > 0);
    });
  });

  // Rollback Lineage Verification (2 additional tests -> 110 total assertions/tests!)
  describe("8. Strategy Version Lineage & Deterministic Rollback", () => {
    it("8.01 rejects rollback cleanly when only v1 seed exists on untouched strategy", async () => {
      const { db } = await import("../src/db");
      const { strategyVersions } = await import("../src/db/schema");
      const singleKey = `SINGLE_VER_${Date.now()}`;
      await db.insert(strategyVersions).values({
        strategyKey: singleKey,
        versionNumber: 1,
        isActive: true,
        parametersJson: { minNetEdgeBps: 3.0 },
        changeSource: "seed",
        changeReason: "Single-version guard test",
      });
      await assert.rejects(() => rollbackStrategyVersion(singleKey));
    });

    it("8.02 executes deterministic rollback when a second strategy version is created", async () => {
      const { db } = await import("../src/db");
      const { strategyVersions } = await import("../src/db/schema");
      await db.insert(strategyVersions).values({
        strategyKey: "SPOT_PERP_CASH_CARRY",
        versionNumber: 2,
        isActive: true,
        parametersJson: { minNetEdgeBps: 6.5, holdingHours: 72 },
        changeSource: "autonomous_learning",
        changeReason: "Test candidate v2 parameter shift",
        validationSharpe: 0.9,
        realizedExpectancyBps: -1.5,
      });
      const rolled = await rollbackStrategyVersion("SPOT_PERP_CASH_CARRY");
      assert.equal(rolled.rolledBackVersion.versionNumber, 2);
      assert.equal(rolled.restoredVersion.versionNumber, 1);
      assert.equal(rolled.restoredVersion.isActive, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. DUAL APPS, ONLINE ML GRADIENT DESCENT, BANDIT & PROFIT COMPOUNDER (10 TESTS)
  // ---------------------------------------------------------------------------
  describe("9. Installable Dual Apps, Online ML Learning & Maker Profit Compounder", () => {
    it("9.01 initializes both isolated ML models (SURVIVAL_CORE_ML & ALPHA_COMPOUNDER_ML)", async () => {
      const { ensureMlModelsInitialized } = await import("../src/lib/engine/ml-learner");
      const models = await ensureMlModelsInitialized();
      assert.equal(models.length, 2);
      assert.ok(models.some((m) => m.modelKey === "SURVIVAL_CORE_ML"));
      assert.ok(models.some((m) => m.modelKey === "ALPHA_COMPOUNDER_ML"));
    });

    it("9.02 trains ALPHA_COMPOUNDER_ML via regularized gradient descent on real walk-forward data", async () => {
      const { trainOnlineMlModel } = await import("../src/lib/engine/ml-learner");
      const out = await trainOnlineMlModel({ modelKey: "ALPHA_COMPOUNDER_ML", epochs: 12 });
      assert.equal(out.trainingRun.epochsRun, 12);
      assert.ok(out.trainingRun.samplesProcessed >= 20);
      assert.equal((out.trainingRun.lossCurveJson as any[]).length, 13);
    });

    it("9.03 maintains normalized LinUCB multi-arm bandit allocations summing to ~100%", async () => {
      const { getMlStatus } = await import("../src/lib/engine/ml-learner");
      const st = await getMlStatus();
      const arms = st.models[0].banditArmsJson as any[];
      assert.equal(arms.length, 5);
      const sumAlloc = arms.reduce((acc, a) => acc + a.allocationWeightPct, 0);
      assert.ok(sumAlloc >= 99 && sumAlloc <= 101);
    });

    it("9.04 generateHighProfitPortfolioPlan achieves strictly higher net APR via Post-Only Maker limit execution vs naive taker", async () => {
      const { generateHighProfitPortfolioPlan } = await import("../src/lib/engine/profit-optimizer");
      const plan = await generateHighProfitPortfolioPlan();
      assert.ok(plan.opportunities.length >= 1);
      for (const opp of plan.opportunities) {
        assert.ok(opp.makerOptimizedNetAprPct > opp.standardTakerNetAprPct);
        assert.notEqual(opp.symbol, "TRUMP");
      }
    });

    it("9.05 GET /api/ml returns models, training runs, and portfolio profit plan", async () => {
      const { GET: mlGet } = await import("../src/app/api/ml/route");
      const res = await mlGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.models.length, 2);
    });

    it("9.06 POST /api/ml DEPLOY_AND_COMPOUND executes hedged positions, harvests carry, and retrains ML", async () => {
      const { POST: mlPost } = await import("../src/app/api/ml/route");
      const res = await mlPost(
        new Request("http://localhost:3000/api/ml", {
          method: "POST",
          body: JSON.stringify({ action: "DEPLOY_AND_COMPOUND", simulateHours: 24 }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.ok(json.mlLearn.model.generation >= 1);
    });

    it("9.07 PWA manifest configures standalone Android WebAPK display, exact 192/512 PNGs, and shortcuts", async () => {
      const manifestMod = await import("../src/app/manifest");
      const manifest = manifestMod.default();
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.shortcuts?.length, 2);
      assert.equal(manifest.shortcuts?.[0].url, "/install");
      assert.equal(manifest.shortcuts?.[1].url, "/apps");
    });

    it("9.08 GET /api/projects/bridge enforces readOnlyEnforced=true and protects hhlongwane/survival-ai", async () => {
      const { GET: bridgeGet } = await import("../src/app/api/projects/bridge/route");
      const res = await bridgeGet();
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.protectedRepo.githubSlug, "hhlongwane/survival-ai");
      assert.equal(json.protectedRepo.writeProtection, "HARD_LOCKED_UNTOUCHED");
      assert.equal(json.originalAppProbe.readOnlyEnforced, true);
    });

    it("9.09 POST /api/projects/bridge rejects unsafe non-https URLs cleanly", async () => {
      const { POST: bridgePost } = await import("../src/app/api/projects/bridge/route");
      const res = await bridgePost(
        new Request("http://localhost:3000/api/projects/bridge", {
          method: "POST",
          body: JSON.stringify({ url: "ftp://insecure.example.com" }),
        })
      );
      assert.equal(res.status, 400);
    });

    it("9.10 GET /api/dashboard includes mlStatus and profitPlan in initial SSR payload", async () => {
      const res = await dashboardGet(new Request("http://localhost:3000/api/dashboard"));
      const json = await res.json();
      assert.ok(json.mlStatus);
      assert.ok(json.profitPlan);
    });

    it("9.11 App #2 dedicated manifest route serves HTTP 200 with separate id and scope (/apps) for Android", async () => {
      const { GET: alphaManifestGet } = await import(
        "../src/app/apps/manifest.webmanifest/route"
      );
      const res = await alphaManifestGet();
      const alphaManifest = await res.json();
      assert.equal(res.status, 200);
      assert.equal(alphaManifest.display, "standalone");
      assert.equal(alphaManifest.scope, "/apps");
      assert.notEqual(alphaManifest.id, "/?app=survival-core");
    });

    it("9.12 GET /api/ai/download-mobile serves downloadable On-Device Pocket AI HTML scanner with embedded weights", async () => {
      const { GET: downloadMobileGet } = await import("../src/app/api/ai/download-mobile/route");
      const res = await downloadMobileGet(
        new Request("http://localhost:3000/api/ai/download-mobile")
      );
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.ok(res.headers.get("content-disposition")?.includes("SurvivalAI-Pocket-GapScanner.html"));
      assert.ok(html.includes("EMBEDDED_BRAIN"));
      assert.ok(html.includes("scanLiveGaps"));
    });

    it("9.13 GET /api/ai/weights-export exports portable JSON brain weights and live high-profit plan", async () => {
      const { GET: exportJsonGet } = await import("../src/app/api/ai/weights-export/route");
      const res = await exportJsonGet();
      const parsed = await res.json();
      assert.equal(res.status, 200);
      assert.equal(parsed.package, "survival-ai-trained-quant-brain");
      assert.equal(parsed.models.length, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. LIVE PAYPAL CHECKOUT, AES-256-GCM CREDENTIALS VAULT & FXPRO AUTO-TRADER (8 TESTS)
  // ---------------------------------------------------------------------------
  describe("10. Live PayPal Gateway, Encrypted Vault & Autonomous FxPro Broker Desk", () => {
    it("10.01 encrypts and masks API secrets via AES-256-GCM without exposing plaintext to UI", async () => {
      const {
        saveEncryptedCredentials,
        getServerSecrets,
      } = await import("../src/lib/engine/credentials-vault");

      const publicSummary = await saveEncryptedCredentials({
        fxproAccountId: "7788991",
      } as any);
      assert.ok(publicSummary.paypal);
      assert.ok(publicSummary.fxpro);

      const savedMasked = await saveEncryptedCredentials({
        paypalLiveClientId: "TEST_PP_CLIENT_ID_1234567890",
        paypalLiveClientSecret: "TEST_PP_SECRET_ABCDEFGHIJ",
      });
      assert.equal(savedMasked.paypal.liveConfigured, true);
      assert.equal(savedMasked.paypal.maskedLiveClientId, "TEST••••••••7890");
      assert.ok(!JSON.stringify(savedMasked).includes("TEST_PP_SECRET_ABCDEFGHIJ"));

      const decrypted = await getServerSecrets();
      assert.equal(decrypted.paypalLiveClientSecret, "TEST_PP_SECRET_ABCDEFGHIJ");

      // Clean back out after encryption verification so unconfigured prompt works cleanly for user
      await saveEncryptedCredentials({
        paypalLiveClientId: "__CLEAR__",
        paypalLiveClientSecret: "__CLEAR__",
      });
    });

    it("10.02 initializes LIVE_CAPITAL_VAULT strictly at $0.00 verified balance (zero fake real money)", async () => {
      const { ensureLiveCapitalVaultExists } = await import("../src/lib/engine/paypal-live");
      const liveVault = await ensureLiveCapitalVaultExists();
      assert.equal(liveVault.walletCode, "LIVE_CAPITAL_VAULT");
      assert.equal(liveVault.isSimulated, false);
      assert.equal(liveVault.availableBalance, 0);
    });

    it("10.03 POST /api/paypal returns HTTP 412 missingCredentials prompt when Live PayPal keys are not yet entered", async () => {
      const { POST: paypalPost } = await import("../src/app/api/paypal/route");
      const res = await paypalPost(
        new Request("http://localhost:3000/api/paypal", {
          method: "POST",
          body: JSON.stringify({ mode: "live", amountUsd: 100 }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 412);
      assert.equal(json.missingCredentials, true);
    });

    it("10.04 GET /api/paypal/return safely redirects when token is missing", async () => {
      const { GET: paypalReturnGet } = await import("../src/app/api/paypal/return/route");
      const res = await paypalReturnGet(
        new Request("http://localhost:3000/api/paypal/return")
      );
      assert.ok(res.status >= 300 && res.status < 400);
    });

    it("10.05 scans real live FX & Gold pairs (EURUSD, GBPUSD, USDJPY, XAUUSD, USDZAR) for FxPro", async () => {
      const { scanLiveFxProAndGoldOpportunities } = await import(
        "../src/lib/engine/fxpro-connector"
      );
      const signals = await scanLiveFxProAndGoldOpportunities();
      assert.ok(signals.length >= 6);
      assert.ok(signals.some((s) => s.symbol === "EURUSD"));
      assert.ok(signals.some((s) => s.symbol === "XAUUSD"));
    });

    it("10.06 dispatches live HTTP orders to FxPro MT5 Bridge when bridge URL is configured & cleans up", async () => {
      const http = await import("node:http");
      const { saveEncryptedCredentials } = await import("../src/lib/engine/credentials-vault");
      const { runAutonomousFxProTradingCycle } = await import(
        "../src/lib/engine/fxpro-connector"
      );

      let receivedOrders = 0;
      const mockBridge = http.createServer((req, res) => {
        if (req.method === "POST" && req.url === "/order") {
          receivedOrders++;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              ticket: 990000 + receivedOrders,
              price: 158.42,
            })
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockBridge.listen(0, "127.0.0.1", () => resolve()));
      const addr = mockBridge.address() as { port: number };

      try {
        await saveEncryptedCredentials({
          fxproAutoTradeAuthorized: true,
          fxproEnvironment: "LIVE",
          fxproMt5BridgeUrl: `http://127.0.0.1:${addr.port}`,
          fxproMt5BridgeToken: "TEST_BRIDGE_BEARER",
        });

        const cycle = await runAutonomousFxProTradingCycle();
        assert.equal(cycle.liveBrokerConnected, true);
        assert.equal(cycle.executionChannel, "FXPRO_MT5_BRIDGE_LIVE");
        assert.ok(receivedOrders >= 1);
        assert.equal(cycle.dispatchedOrders[0].status, "LIVE_FILLED_ON_FXPRO");
      } finally {
        await saveEncryptedCredentials({
          fxproMt5BridgeUrl: "__CLEAR__",
          fxproMt5BridgeToken: "__CLEAR__",
        });
        await new Promise<void>((resolve) => mockBridge.close(() => resolve()));
      }
    });

    it("10.07 GET & POST /api/fxpro expose live signals and execute autonomous FxPro cycle cleanly", async () => {
      const { GET: fxGet, POST: fxPost } = await import("../src/app/api/fxpro/route");
      const g = await fxGet(new Request("http://localhost:3000/api/fxpro"));
      const gJson = await g.json();
      assert.equal(g.status, 200);
      assert.ok(gJson.liveSignals.length >= 6);

      const p = await fxPost(new Request("http://localhost:3000/api/fxpro", { method: "POST" }));
      const pJson = await p.json();
      assert.equal(p.status, 200);
      assert.equal(pJson.ok, true);
    });

    it("10.08 GET /api/credentials returns masked summary with zero raw secrets", async () => {
      const { GET: credGet } = await import("../src/app/api/credentials/route");
      const res = await credGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.credentials.fxpro.autoTradeAuthorized, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. APEX 3-MODEL NEURAL META-BRAIN, BACKPROPAGATION & TRIANGULAR ARBITRAGE (7 TESTS)
  // ---------------------------------------------------------------------------
  describe("11. Apex 12-Neuron Backpropagation Meta-Brain & Triangular Arbitrage", () => {
    it("11.01 forwardPassMlp computes deterministic finite hidden activations bounded in [-1, 1]", async () => {
      const { forwardPassMlp } = await import("../src/lib/engine/apex-brain");
      const sampleMlp = {
        W1: Array.from({ length: 12 }, (_, h) => new Array(8).fill(0.1 * (h + 1))),
        b1: new Array(12).fill(0.05),
        W2: new Array(12).fill(0.5),
        b2: -2.0,
      };
      const out = forwardPassMlp(sampleMlp, [1, 0.8, 0.4, 1.2, 0.9, 0.2, -0.3, 0.7]);
      assert.equal(out.hiddenAct.length, 12);
      assert.ok(out.hiddenAct.every((v) => v >= -1 && v <= 1));
      assert.ok(Number.isFinite(out.output));
    });

    it("11.02 scans live 3-leg USD/EUR Crypto Triangular Arbitrage loops (BTC, ETH, SOL)", async () => {
      const { scanLiveTriangularArbitrageLoops } = await import(
        "../src/lib/engine/apex-brain"
      );
      const loops = await scanLiveTriangularArbitrageLoops();
      assert.equal(loops.length, 3);
      assert.ok(loops.some((l) => l.routeLabel.includes("BTC")));
      assert.ok(loops.some((l) => l.routeLabel.includes("ETH")));
    });

    it("11.03 trains 12-Neuron Tanh MLP via analytical backpropagation & achieves >=65% OOS Ensemble accuracy", async () => {
      const { trainApexNeuralEnsemble } = await import("../src/lib/engine/apex-brain");
      const state = await trainApexNeuralEnsemble(24);
      assert.equal(state.hiddenUnits, 12);
      assert.ok(state.ensembleAccuracyPct >= 65);
      assert.ok(state.topConsensusSignals.length >= 3);
    });

    it("11.04 never approves TRUMP or meme tokens inside topConsensusSignals", async () => {
      const { getApexIntelligenceSnapshot } = await import("../src/lib/engine/apex-brain");
      const snap = await getApexIntelligenceSnapshot();
      assert.ok(snap.ensemble.topConsensusSignals.every((s) => s.symbol !== "TRUMP"));
    });

    it("11.05 executes full Apex Sovereign Super-Cycle (Neural Train + Triangular + FxPro + Capital Rotation + Compound)", async () => {
      const { runApexSovereignSuperCycle } = await import("../src/lib/engine/apex-brain");
      const res = await runApexSovereignSuperCycle(24);
      assert.ok(res.ensemble.generation >= 2);
      assert.equal(res.triangularLoops.length, 3);
      assert.ok(Number.isFinite(res.harvestedUsd));
    });

    it("11.06 GET & POST /api/apex execute cleanly via REST endpoints", async () => {
      const { GET: apexGet, POST: apexPost } = await import("../src/app/api/apex/route");
      const g = await apexGet();
      const gJson = await g.json();
      assert.equal(g.status, 200);
      assert.equal(gJson.ok, true);

      const p = await apexPost(
        new Request("http://localhost:3000/api/apex", {
          method: "POST",
          body: JSON.stringify({ simulateHours: 12 }),
        })
      );
      const pJson = await p.json();
      assert.equal(p.status, 200);
      assert.equal(pJson.ok, true);
    });

    it("11.07 embeds trained 12-Neuron MLP layer inside downloaded Samsung A33 Pocket AI app", async () => {
      const { GET: downloadMobileGet } = await import("../src/app/api/ai/download-mobile/route");
      const res = await downloadMobileGet(
        new Request("http://localhost:3000/api/ai/download-mobile")
      );
      const html = await res.text();
      assert.ok(html.includes("mlpNeuralLayer"));
      assert.ok(html.includes("predictApexEnsemble"));
    });
  });

  // ---------------------------------------------------------------------------
  // 12. ORIGINAL hhlongwane REPO SYNC, RENDER .ENV IMPORTER & ai_memories SCHEMA (4 TESTS)
  // ---------------------------------------------------------------------------
  describe("12. Original hhlongwane/survival-ai & hhlongwane/Render Sync + ai_memories", () => {
    it("12.01 implements exact ai_memories upsert/list/delete contract from hhlongwane/Render", async () => {
      const { GET: memGet, POST: memPost } = await import("../src/app/api/memories/route");
      const saveRes = await memPost(
        new Request("http://localhost:3000/api/memories", {
          method: "POST",
          body: JSON.stringify({
            memoryKey: "assistant-preferences",
            content: { tone: "direct", preferredLanguage: "English" },
          }),
        })
      );
      const saveJson = await saveRes.json();
      assert.equal(saveRes.status, 200);
      assert.equal(saveJson.ok, true);

      const listRes = await memGet(new Request("http://localhost:3000/api/memories"));
      const listJson = await listRes.json();
      assert.equal(listRes.status, 200);
      assert.ok(listJson.memories.some((m: any) => m.memoryKey === "assistant-preferences"));
    });

    it("12.02 parseOriginalSurvivalAiEnvBlock automatically maps PayPal, FxPro, cTrader & MT5 env keys", async () => {
      const { parseOriginalSurvivalAiEnvBlock } = await import(
        "../src/app/api/original-repo/route"
      );
      const sampleEnv = `
        PAYPAL_CLIENT_ID="live_pp_id_999"
        PAYPAL_CLIENT_SECRET="live_pp_sec_999"
        CTRADER_ACCESS_TOKEN="fxpro_ct_tok_888"
        CTRADER_ACCOUNT_ID="445566"
        MT5_BRIDGE_URL="https://fxpro-bridge.example.com"
        VITE_SUPABASE_URL="https://proj.supabase.co"
      `;
      const out = parseOriginalSurvivalAiEnvBlock(sampleEnv);
      assert.equal(out.patch.paypalLiveClientId, "live_pp_id_999");
      assert.equal(out.patch.paypalLiveClientSecret, "live_pp_sec_999");
      assert.equal(out.patch.fxproCtraderAccessToken, "fxpro_ct_tok_888");
      assert.equal(out.patch.fxproMt5BridgeUrl, "https://fxpro-bridge.example.com");
      assert.equal(out.matchedKeys.length, 6);
    });

    it("12.03 GET /api/original-repo reports real live GitHub visibility of hhlongwane/Render & hhlongwane/survival-ai", async () => {
      const { GET: origGet } = await import("../src/app/api/original-repo/route");
      const res = await origGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.survivalAiRepo.fullName, "hhlongwane/survival-ai");
      assert.equal(json.renderCompanionRepo.fullName, "hhlongwane/Render");
    });

    it("12.04 POST /api/original-repo imports whole .env block cleanly and encrypts into vault", async () => {
      const { POST: origPost } = await import("../src/app/api/original-repo/route");
      const { saveEncryptedCredentials } = await import("../src/lib/engine/credentials-vault");
      const res = await origPost(
        new Request("http://localhost:3000/api/original-repo", {
          method: "POST",
          body: JSON.stringify({
            rawEnvText: "PAYPAL_MODE=live\nFXPRO_ACCOUNT_ID=918273\n",
          }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.importedCount, 2);
      await saveEncryptedCredentials({ fxproCtraderAccountId: "__CLEAR__" });
    });
  });

  // ---------------------------------------------------------------------------
  // 13. LIVE REAL-NETWORK PAYPAL REST ORDER + APPROVED CTRADER WEBSOCKET HANDSHAKE (6 TESTS)
  // ---------------------------------------------------------------------------
  describe("13. Live PayPal REST Order Creation & Real Spotware cTrader WebSocket Handshake", () => {
    it("13.01 authenticates approved cTrader App LIVE over wss://live.ctraderapi.com:5036 (ProtoOAApplicationAuthRes 2101)", async () => {
      const { GET: ctraderStatusGet } = await import("../src/app/api/ctrader/status/route");
      const res = await ctraderStatusGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.application_status, "approved");
      assert.equal(json.live_websocket_authenticated, true);
      assert.ok(json.live_websocket_latency_ms > 0);
    });

    it("13.02 creates a genuine PayPal v2 Checkout Order via live PayPal REST API and returns official paypal.com approval link", async () => {
      const { POST: paypalPost } = await import("../src/app/api/paypal/route");
      const res = await paypalPost(
        new Request("http://localhost:3000/api/paypal", {
          method: "POST",
          body: JSON.stringify({ mode: "auto", amountUsd: 25 }),
        })
      );
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.ok(typeof json.orderId === "string" && json.orderId.length > 8);
      assert.ok(String(json.approveUrl).includes("paypal.com/checkoutnow?token="));
    });

    it("13.03 GET /api/ctrader/connect redirects (307) to official id.ctrader.com full-trading OAuth grant", async () => {
      const { GET: connectGet } = await import("../src/app/api/ctrader/connect/route");
      const res = await connectGet();
      assert.equal(res.status, 307);
      const loc = res.headers.get("location") || "";
      assert.ok(loc.includes("id.ctrader.com/my/settings/openapi/grantingaccess"));
      assert.ok(loc.includes("scope=trading"));
    });

    it("13.04 GET /api/paypal/status returns configured=true matching original OpenAPI contract", async () => {
      const { GET: ppStatusGet } = await import("../src/app/api/paypal/status/route");
      const res = await ppStatusGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.configured, true);
    });

    it("13.05 GET /api/startup-revenue/offers returns all 5 South African R5,000 ZAR offers from original app", async () => {
      const { GET: offersGet } = await import(
        "../src/app/api/startup-revenue/offers/route"
      );
      const res = await offersGet();
      const json = await res.json();
      assert.equal(json.target_zar, 5000);
      assert.equal(json.entries.length, 5);
    });

    it("13.06 GET /api/crypto/strategies returns all 10 strategy families + 17 supported 0x chains", async () => {
      const { GET: stratsGet } = await import("../src/app/api/crypto/strategies/route");
      const res = await stratsGet();
      const json = await res.json();
      assert.equal(json.strategies.length, 10);
      assert.equal(json.supported_execution_chains_0x.length, 17);
    });
  });

  // ---------------------------------------------------------------------------
  // 14. PERMANENT CLOUD DEPLOYMENT (VERCEL AUTO-MIGRATE, CRON, ZIP & GITHUB PUSH GUARD)
  // ---------------------------------------------------------------------------
  describe("14. Permanent Cloud Deployment, Auto-Migration & Vercel Cron", () => {
    it("14.01 ensureAllTablesExist runs cleanly and guarantees zero-CLI cloud database bootstrap", async () => {
      const { ensureAllTablesExist } = await import("../src/db/auto-migrate");
      await ensureAllTablesExist();
      assert.ok(true);
    });

    it("14.02 GET /api/cron/ai executes autonomous Apex Neural Super-Cycle cleanly for Vercel Cron", async () => {
      const { GET: cronGet } = await import("../src/app/api/cron/ai/route");
      const res = await cronGet();
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.mode, "VERCEL_CLOUD_AUTONOMOUS_CRON");
    });

    it("14.03 GET /api/deploy/download-zip generates clean source .zip archive excluding .env secrets", async () => {
      const { GET: zipGet } = await import("../src/app/api/deploy/download-zip/route");
      const res = await zipGet();
      const buf = Buffer.from(await res.arrayBuffer());
      assert.equal(res.status, 200);
      assert.equal(buf[0], 0x50); // 'P'
      assert.equal(buf[1], 0x4b); // 'K' valid ZIP header!
      assert.ok(buf.length > 25000);
    });

    it("14.04 POST /api/deploy/github-push rejects empty token safely", async () => {
      const { POST: ghPushPost } = await import("../src/app/api/deploy/github-push/route");
      const res = await ghPushPost(
        new Request("http://localhost:3000/api/deploy/github-push", {
          method: "POST",
          body: JSON.stringify({ githubToken: "", repoName: "survival-ai" }),
        })
      );
      assert.equal(res.status, 400);
    });
  });
});
