export const dynamic = "force-dynamic";

/**
 * Complete Crypto Strategy Catalog & 0x Multi-Chain Adapter Metadata from `hhlongwane/survival-ai`
 */
export async function GET() {
  return Response.json({
    strategies: [
      {
        id: "trend_momentum",
        name: "Multi-timeframe momentum",
        edge: "Ride persistent directional moves after confirmation",
        required_inputs: ["price", "volume", "volatility", "liquidity"],
        regime: "trending",
        primary_failure_mode: "late_entry_and_reversal",
      },
      {
        id: "breakout_retest",
        name: "Breakout + retest",
        edge: "Trade range expansion only after the broken level is accepted",
        required_inputs: ["price", "volume", "order_book", "liquidity"],
        regime: "transition",
        primary_failure_mode: "false_breakout",
      },
      {
        id: "short_horizon_mean_reversion",
        name: "Short-horizon mean reversion",
        edge: "Fade statistically unusual short moves when costs are small enough",
        required_inputs: ["returns", "taker_flow", "spread", "fees"],
        regime: "choppy",
        primary_failure_mode: "costs_erase_edge",
      },
      {
        id: "funding_basis",
        name: "Funding/basis dislocation",
        edge: "Exploit persistent derivative-vs-spot pricing or funding differences",
        required_inputs: ["funding", "open_interest", "spot_price", "perp_price"],
        regime: "crowded_derivatives",
        primary_failure_mode: "funding_flip_or_execution",
      },
      {
        id: "liquidation_momentum",
        name: "Liquidation cascade continuation/reversal",
        edge: "Use forced-flow conditions as a catalyst, not as a standalone signal",
        required_inputs: ["liquidations", "open_interest", "volume", "price"],
        regime: "high_volatility",
        primary_failure_mode: "cascade_reverses",
      },
      {
        id: "onchain_flow",
        name: "Exchange/wallet flow regime",
        edge: "Use changes in exchange balances and large-wallet activity as supply/demand evidence",
        required_inputs: ["exchange_flows", "wallet_flows", "stablecoin_flows", "price"],
        regime: "macro_or_supply_shift",
        primary_failure_mode: "address_label_noise",
      },
      {
        id: "narrative_rotation",
        name: "Narrative/sector rotation",
        edge: "Detect capital moving between sectors before broad price confirmation",
        required_inputs: ["social_trend", "sector_volume", "relative_strength", "liquidity"],
        regime: "risk_on_rotation",
        primary_failure_mode: "attention_without_capital",
      },
      {
        id: "event_surprise",
        name: "News/event surprise",
        edge: "Trade only when a catalyst materially differs from expectations and price confirms",
        required_inputs: ["news", "calendar", "consensus", "price", "volume"],
        regime: "event",
        primary_failure_mode: "priced_in_or_fake_news",
      },
      {
        id: "copy_signal_filter",
        name: "Copy-trade intelligence filter",
        edge: "Use public trader activity as one signal and independently validate it",
        required_inputs: ["trader_history", "entry_timing", "drawdown", "liquidity", "market_context"],
        regime: "any",
        primary_failure_mode: "survivorship_or_lag",
      },
      {
        id: "meme_trend_risk_filtered",
        name: "Meme-token trend filter",
        edge: "Participate only when liquidity, concentration, volume and trend survive hard filters",
        required_inputs: ["liquidity", "holder_concentration", "volume", "price", "social_trend"],
        regime: "speculative",
        primary_failure_mode: "rug_pull_or_manipulation",
      },
    ],
    supported_execution_chains_0x: [
      1, 10, 56, 130, 137, 143, 146, 480, 999, 2741, 4217, 5000, 8453, 42161, 43114, 59144, 534352,
    ],
    principle:
      "No strategy is assumed profitable; promote only after point-in-time out-of-sample evidence and after-cost validation.",
  });
}
