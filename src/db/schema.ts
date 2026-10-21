import {
  pgTable,
  serial,
  text,
  doublePrecision,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// 1. System Configuration & Safety Controls
export const systemConfigs = pgTable(
  "system_configs",
  {
    id: serial("id").primaryKey(),
    configKey: text("config_key").notNull(),
    configValue: jsonb("config_value").notNull(),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").notNull().default("system"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("system_configs_key_idx").on(table.configKey)]
);

// 2. Segregated Wallets / Capital Vaults (Paper Trading Vault vs PayPal Sandbox vs Business Revenue)
export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    walletCode: text("wallet_code").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("USD"),
    availableBalance: doublePrecision("available_balance").notNull().default(0),
    lockedMargin: doublePrecision("locked_margin").notNull().default(0),
    realizedPnl: doublePrecision("realized_pnl").notNull().default(0),
    totalDeposited: doublePrecision("total_deposited").notNull().default(0),
    isSimulated: boolean("is_simulated").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("wallets_code_idx").on(table.walletCode)]
);

// 3. Auditable Append-Only Ledger Entries (Idempotent)
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    walletId: integer("wallet_id").notNull(),
    entryType: text("entry_type").notNull(), // DEPOSIT | WITHDRAWAL | MARGIN_LOCK | MARGIN_RELEASE | FEE | FUNDING_ACCRUAL | REALIZED_PNL | PAYPAL_SANDBOX_CAPTURE | BUSINESS_REVENUE
    direction: text("direction").notNull(), // CREDIT | DEBIT
    amount: doublePrecision("amount").notNull(),
    balanceAfter: doublePrecision("balance_after").notNull(),
    currency: text("currency").notNull().default("USD"),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    isSimulated: boolean("is_simulated").notNull().default(true),
    description: text("description").notNull(),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ledger_idempotency_idx").on(table.idempotencyKey),
    index("ledger_wallet_created_idx").on(table.walletId, table.createdAt),
  ]
);

// 4. Payment & Deposit Events (PayPal Sandbox, Vault Funding, Duplicate Webhook Protection)
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(), // PAYPAL_SANDBOX | VAULT_SANDBOX_TRANSFER
    externalOrderId: text("external_order_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull(), // CREATED | APPROVED | CAPTURED | REJECTED | DUPLICATE_IGNORED
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    isSandbox: boolean("is_sandbox").notNull().default(true),
    webhookSignatureValid: boolean("webhook_signature_valid").notNull().default(false),
    reconciledLedgerId: integer("reconciled_ledger_id"),
    payerLabel: text("payer_label").notNull().default("sandbox-buyer@survival-ai.local"),
    rawPayload: jsonb("raw_payload").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_external_order_idx").on(table.externalOrderId),
    uniqueIndex("payment_idempotency_idx").on(table.idempotencyKey),
  ]
);

// 5. Market Gaps & Opportunity Discovery Records
export const opportunities = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    opportunityKey: text("opportunity_key").notNull(),
    domain: text("domain").notNull(), // CRYPTO_FUNDING_BASIS | CRYPTO_SPATIAL_ARB | CRYPTO_MOMENTUM | SPECULATIVE_MEME_RESEARCH | BUSINESS_REVENUE
    symbol: text("symbol").notNull(),
    strategyFamily: text("strategy_family").notNull(),
    longVenue: text("long_venue").notNull(),
    shortVenue: text("short_venue").notNull(),
    spotOrLongPrice: doublePrecision("spot_or_long_price").notNull(),
    perpOrShortPrice: doublePrecision("perp_or_short_price").notNull(),
    grossAprPct: doublePrecision("gross_apr_pct").notNull(),
    netAprPct: doublePrecision("net_apr_pct").notNull(),
    holdingHours: doublePrecision("holding_hours").notNull().default(24),
    grossReturnBps: doublePrecision("gross_return_bps").notNull(),
    totalCostsBps: doublePrecision("total_costs_bps").notNull(),
    netExpectedReturnBps: doublePrecision("net_expected_return_bps").notNull(),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    liquidityUsd: doublePrecision("liquidity_usd").notNull(),
    verdict: text("verdict").notNull(), // EXECUTABLE_EDGE | WATCHLIST | REJECTED_COSTS | REJECTED_RISK | RESEARCH_ONLY_NO_AUTO_TRADE
    rejectionReason: text("rejection_reason"),
    autoTradePermitted: boolean("auto_trade_permitted").notNull().default(false),
    metricsJson: jsonb("metrics_json").default({}),
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("opportunities_key_idx").on(table.opportunityKey),
    index("opportunities_verdict_idx").on(table.verdict),
  ]
);

// 6. Orders & Execution States (Idempotent Order Submission)
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    clientOrderId: text("client_order_id").notNull(),
    positionId: integer("position_id"),
    symbol: text("symbol").notNull(),
    venue: text("venue").notNull(),
    side: text("side").notNull(), // BUY_LONG | SELL_SHORT | CLOSE_LONG | CLOSE_SHORT | HEDGED_ARB_ENTRY | HEDGED_ARB_EXIT
    orderType: text("order_type").notNull().default("MARKET_IOC"),
    executionMode: text("execution_mode").notNull().default("PAPER"), // PAPER | MT5_DEMO | LIVE_BLOCKED
    strategyFamily: text("strategy_family").notNull(),
    requestedNotionalUsd: doublePrecision("requested_notional_usd").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    referencePrice: doublePrecision("reference_price").notNull(),
    filledPrice: doublePrecision("filled_price"),
    feeUsd: doublePrecision("fee_usd").notNull().default(0),
    slippageBps: doublePrecision("slippage_bps").notNull().default(0),
    status: text("status").notNull(), // PENDING | FILLED | REJECTED | CANCELLED
    rejectionReason: text("rejection_reason"),
    riskDecisionId: integer("risk_decision_id"),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("orders_client_id_idx").on(table.clientOrderId),
    index("orders_symbol_status_idx").on(table.symbol, table.status),
  ]
);

// 7. Open & Closed Trading Positions
export const positions = pgTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    strategyFamily: text("strategy_family").notNull(),
    structure: text("structure").notNull(), // HEDGED_CROSS_VENUE | SPOT_PERP_CARRY | DIRECTIONAL_LONG | DIRECTIONAL_SHORT
    longVenue: text("long_venue").notNull(),
    shortVenue: text("short_venue").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    notionalUsd: doublePrecision("notional_usd").notNull(),
    marginUsedUsd: doublePrecision("margin_used_usd").notNull(),
    leverage: doublePrecision("leverage").notNull().default(1),
    entryLongPrice: doublePrecision("entry_long_price").notNull(),
    entryShortPrice: doublePrecision("entry_short_price").notNull(),
    markLongPrice: doublePrecision("mark_long_price").notNull(),
    markShortPrice: doublePrecision("mark_short_price").notNull(),
    netHourlyFundingRate: doublePrecision("net_hourly_funding_rate").notNull().default(0),
    accruedFundingUsd: doublePrecision("accrued_funding_usd").notNull().default(0),
    feesPaidUsd: doublePrecision("fees_paid_usd").notNull().default(0),
    unrealizedPnlUsd: doublePrecision("unrealized_pnl_usd").notNull().default(0),
    realizedPnlUsd: doublePrecision("realized_pnl_usd").notNull().default(0),
    takeProfitBps: doublePrecision("take_profit_bps").notNull().default(45),
    stopLossBps: doublePrecision("stop_loss_bps").notNull().default(35),
    expectedNetEdgeBps: doublePrecision("expected_net_edge_bps").notNull().default(0),
    status: text("status").notNull().default("OPEN"), // OPEN | CLOSED
    executionMode: text("execution_mode").notNull().default("PAPER"),
    isSimulated: boolean("is_simulated").notNull().default(true),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    lastReconciledAt: timestamp("last_reconciled_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    closeReason: text("close_reason"),
  },
  (table) => [index("positions_status_idx").on(table.status)]
);

// 8. Risk Gate Decisions & Blocked Actions Audit Trail
export const riskDecisions = pgTable(
  "risk_decisions",
  {
    id: serial("id").primaryKey(),
    actionType: text("action_type").notNull(),
    symbol: text("symbol").notNull(),
    executionMode: text("execution_mode").notNull(),
    requestedNotionalUsd: doublePrecision("requested_notional_usd").notNull(),
    leverage: doublePrecision("leverage").notNull().default(1),
    approved: boolean("approved").notNull(),
    blockedGate: text("blocked_gate"),
    reasonsJson: jsonb("reasons_json").notNull(),
    portfolioSnapshotJson: jsonb("portfolio_snapshot_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("risk_decisions_approved_idx").on(table.approved, table.createdAt)]
);

// 9. Strategy Configuration Versions & Rollback Lineage
export const strategyVersions = pgTable(
  "strategy_versions",
  {
    id: serial("id").primaryKey(),
    strategyKey: text("strategy_key").notNull(),
    versionNumber: integer("version_number").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    parametersJson: jsonb("parameters_json").notNull(),
    changeSource: text("change_source").notNull().default("seed"), // seed | autonomous_learning | user_override | safety_rollback
    changeReason: text("change_reason").notNull(),
    validationSharpe: doublePrecision("validation_sharpe").notNull().default(0),
    realizedExpectancyBps: doublePrecision("realized_expectancy_bps").notNull().default(0),
    rolledBack: boolean("rolled_back").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("strategy_versions_key_active_idx").on(table.strategyKey, table.isActive)]
);

// 10. Quantitative Backtest & Stress Validation Runs
export const backtestRuns = pgTable(
  "backtest_runs",
  {
    id: serial("id").primaryKey(),
    strategyFamily: text("strategy_family").notNull(),
    symbol: text("symbol").notNull(),
    dataSource: text("data_source").notNull(), // LIVE_COINBASE_HOURLY_OHLCV | DETERMINISTIC_MULTI_REGIME
    candleCount: integer("candle_count").notNull(),
    initialCapital: doublePrecision("initial_capital").notNull(),
    finalEquity: doublePrecision("final_equity").notNull(),
    totalReturnPct: doublePrecision("total_return_pct").notNull(),
    benchmarkReturnPct: doublePrecision("benchmark_return_pct").notNull(),
    inSampleReturnPct: doublePrecision("in_sample_return_pct").notNull(),
    outOfSampleReturnPct: doublePrecision("out_of_sample_return_pct").notNull(),
    maxDrawdownPct: doublePrecision("max_drawdown_pct").notNull(),
    sharpeRatio: doublePrecision("sharpe_ratio").notNull(),
    sortinoRatio: doublePrecision("sortino_ratio").notNull(),
    winRatePct: doublePrecision("win_rate_pct").notNull(),
    profitFactor: doublePrecision("profit_factor").notNull(),
    expectancyUsd: doublePrecision("expectancy_usd").notNull(),
    totalTrades: integer("total_trades").notNull(),
    totalFeesUsd: doublePrecision("total_fees_usd").notNull(),
    isValidatedEdge: boolean("is_validated_edge").notNull(),
    verdictSummary: text("verdict_summary").notNull(),
    equityCurveJson: jsonb("equity_curve_json").notNull(),
    stressTestsJson: jsonb("stress_tests_json").notNull(),
    sensitivityJson: jsonb("sensitivity_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("backtest_runs_created_idx").on(table.createdAt)]
);

// 11. Autonomous AI Learning, Predictions & Outcome Reconciliation
export const aiDecisions = pgTable(
  "ai_decisions",
  {
    id: serial("id").primaryKey(),
    cycleId: text("cycle_id").notNull(),
    symbol: text("symbol").notNull(),
    decisionType: text("decision_type").notNull(), // EXECUTE_PAPER_ARB | HOLD_INSUFFICIENT_EDGE | BLOCK_SPECULATIVE_MEME | CLOSE_RECONCILE | PARAMETER_UPDATE | PARAMETER_ROLLBACK
    predictedNetEdgeBps: doublePrecision("predicted_net_edge_bps").notNull(),
    realizedNetEdgeBps: doublePrecision("realized_net_edge_bps"),
    predictionErrorBps: doublePrecision("prediction_error_bps"),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    uncertaintyScore: doublePrecision("uncertainty_score").notNull(),
    dataQualityScore: doublePrecision("data_quality_score").notNull(),
    strategyVersionId: integer("strategy_version_id"),
    positionId: integer("position_id"),
    reasoning: text("reasoning").notNull(),
    stepsTelemetryJson: jsonb("steps_telemetry_json").default({}),
    reconciled: boolean("reconciled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_decisions_cycle_idx").on(table.cycleId, table.createdAt)]
);

// 12. Business, Shopify & Revenue Hub Records (Strictly Segregated from Trading PnL)
export const businessRecords = pgTable("business_records", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // SHOPIFY_STORE | DIGITAL_AUTOMATION | B2B_WORKFLOW
  recordType: text("record_type").notNull(), // PRODUCT_CATALOG | ORDER_EVENT | OPPORTUNITY_EVAL | WORKFLOW_RUN
  title: text("title").notNull(),
  skuOrRef: text("sku_or_ref").notNull(),
  status: text("status").notNull(),
  grossAmountUsd: doublePrecision("gross_amount_usd").notNull().default(0),
  cogsAndFeesUsd: doublePrecision("cogs_and_fees_usd").notNull().default(0),
  netContributionUsd: doublePrecision("net_contribution_usd").notNull().default(0),
  roasMultiple: doublePrecision("roas_multiple").notNull().default(0),
  isVerifiedRealRevenue: boolean("is_verified_real_revenue").notNull().default(false),
  notes: text("notes").notNull(),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Payment & Broker Integration State Registry
export const brokerConnections = pgTable(
  "broker_connections",
  {
    id: serial("id").primaryKey(),
    providerKey: text("provider_key").notNull(), // PAYPAL_SANDBOX | CTRADER_OAUTH | MT5_DEMO_BRIDGE | SHOPIFY_ADMIN | FOMO_UNSUPPORTED | LIVE_CRYPTO_EXECUTION
    displayName: text("display_name").notNull(),
    category: text("category").notNull(),
    environmentMode: text("environment_mode").notNull(), // SANDBOX | DEMO | PENDING_APPROVAL | UNSUPPORTED | DISABLED_BY_SAFETY_GATE
    connectionStatus: text("connection_status").notNull(),
    oauthState: text("oauth_state"),
    oauthStateExpiresAt: timestamp("oauth_state_expires_at"),
    maskedCredential: text("masked_credential"),
    capabilitiesJson: jsonb("capabilities_json").default([]),
    statusSummary: text("status_summary").notNull(),
    blockerNotice: text("blocker_notice"),
    accountMetricsJson: jsonb("account_metrics_json").default({}),
    lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("broker_connections_key_idx").on(table.providerKey)]
);

// 14. Durable System Events, Errors & Security Audit Log
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    severity: text("severity").notNull(), // INFO | WARN | ERROR | SECURITY
    module: text("module").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)]
);

// 15. Persistent Online Machine Learning Models (Weights, Bandit Arms & App Profile Isolation)
export const mlModels = pgTable(
  "ml_models",
  {
    id: serial("id").primaryKey(),
    modelKey: text("model_key").notNull(), // SURVIVAL_CORE_ML | ALPHA_COMPOUNDER_ML
    appProfile: text("app_profile").notNull().default("SURVIVAL_CORE"),
    generation: integer("generation").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    featureNamesJson: jsonb("feature_names_json").notNull(),
    weightsJson: jsonb("weights_json").notNull(), // Learned Ridge-SGD vector w[0..7]
    banditArmsJson: jsonb("bandit_arms_json").notNull(), // Per-strategy arm pulls, mean reward bps, UCB score
    learningRate: doublePrecision("learning_rate").notNull().default(0.015),
    explorationFactor: doublePrecision("exploration_factor").notNull().default(1.1),
    trainSamplesCount: integer("train_samples_count").notNull().default(0),
    trainMseLoss: doublePrecision("train_mse_loss").notNull().default(0),
    valMseLoss: doublePrecision("val_mse_loss").notNull().default(0),
    directionalAccuracyPct: doublePrecision("directional_accuracy_pct").notNull().default(50),
    outOfSampleSharpe: doublePrecision("out_of_sample_sharpe").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("ml_models_key_idx").on(table.modelKey)]
);

// 16. Machine Learning Training Epochs & Outcome Feedback History
export const mlTrainingRuns = pgTable(
  "ml_training_runs",
  {
    id: serial("id").primaryKey(),
    modelKey: text("model_key").notNull(),
    generation: integer("generation").notNull(),
    epochsRun: integer("epochs_run").notNull(),
    samplesProcessed: integer("samples_processed").notNull(),
    initialValLoss: doublePrecision("initial_val_loss").notNull(),
    finalValLoss: doublePrecision("final_val_loss").notNull(),
    lossImprovementPct: doublePrecision("loss_improvement_pct").notNull(),
    accuracyAfterPct: doublePrecision("accuracy_after_pct").notNull(),
    dominantStrategyArm: text("dominant_strategy_arm").notNull(),
    promotedToActive: boolean("promoted_to_active").notNull().default(true),
    lossCurveJson: jsonb("loss_curve_json").notNull(),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ml_training_runs_created_idx").on(table.createdAt)]
);

// 17. Exact `ai_memories` Schema Imported from `hhlongwane/Render/supabase/migrations/0001_survival_ai_storage.sql`
export const aiMemories = pgTable(
  "ai_memories",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().default("hhlongwane-primary"),
    memoryKey: text("memory_key").notNull(),
    content: jsonb("content").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_memories_user_key_unique").on(table.userId, table.memoryKey),
    index("ai_memories_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);
