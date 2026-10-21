import { db } from "@/db";
import { sql } from "drizzle-orm";

let migrationRanPromise: Promise<void> | null = null;

/**
 * Self-Healing Automatic Cloud PostgreSQL Schema Bootstrap:
 * Ensures all 17 Survival AI tables exist automatically on first boot when deployed
 * to Vercel + Neon Postgres, Supabase, or Render — zero terminal commands required!
 */
export async function ensureAllTablesExist(): Promise<void> {
  if (migrationRanPromise) return migrationRanPromise;

  migrationRanPromise = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_configs (
        id SERIAL PRIMARY KEY,
        config_key TEXT NOT NULL UNIQUE,
        config_value JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL DEFAULT 'system',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        wallet_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        available_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        locked_margin DOUBLE PRECISION NOT NULL DEFAULT 0,
        realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_deposited DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ledger_entries (
        id SERIAL PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        wallet_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        balance_after DOUBLE PRECISION NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        reference_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT NOT NULL,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_events (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        external_order_id TEXT NOT NULL UNIQUE,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        is_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
        webhook_signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
        reconciled_ledger_id INTEGER,
        payer_label TEXT NOT NULL DEFAULT 'sandbox-buyer@survival-ai.local',
        raw_payload JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS opportunities (
        id SERIAL PRIMARY KEY,
        opportunity_key TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        symbol TEXT NOT NULL,
        strategy_family TEXT NOT NULL,
        long_venue TEXT NOT NULL,
        short_venue TEXT NOT NULL,
        spot_or_long_price DOUBLE PRECISION NOT NULL,
        perp_or_short_price DOUBLE PRECISION NOT NULL,
        gross_apr_pct DOUBLE PRECISION NOT NULL,
        net_apr_pct DOUBLE PRECISION NOT NULL,
        holding_hours DOUBLE PRECISION NOT NULL DEFAULT 24,
        gross_return_bps DOUBLE PRECISION NOT NULL,
        total_costs_bps DOUBLE PRECISION NOT NULL,
        net_expected_return_bps DOUBLE PRECISION NOT NULL,
        confidence_score DOUBLE PRECISION NOT NULL,
        liquidity_usd DOUBLE PRECISION NOT NULL,
        verdict TEXT NOT NULL,
        rejection_reason TEXT,
        auto_trade_permitted BOOLEAN NOT NULL DEFAULT FALSE,
        metrics_json JSONB DEFAULT '{}'::jsonb,
        discovered_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_order_id TEXT NOT NULL UNIQUE,
        position_id INTEGER,
        symbol TEXT NOT NULL,
        venue TEXT NOT NULL,
        side TEXT NOT NULL,
        order_type TEXT NOT NULL DEFAULT 'MARKET_IOC',
        execution_mode TEXT NOT NULL DEFAULT 'PAPER',
        strategy_family TEXT NOT NULL,
        requested_notional_usd DOUBLE PRECISION NOT NULL,
        quantity DOUBLE PRECISION NOT NULL,
        reference_price DOUBLE PRECISION NOT NULL,
        filled_price DOUBLE PRECISION,
        fee_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        slippage_bps DOUBLE PRECISION NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        rejection_reason TEXT,
        risk_decision_id INTEGER,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        strategy_family TEXT NOT NULL,
        structure TEXT NOT NULL,
        long_venue TEXT NOT NULL,
        short_venue TEXT NOT NULL,
        quantity DOUBLE PRECISION NOT NULL,
        notional_usd DOUBLE PRECISION NOT NULL,
        margin_used_usd DOUBLE PRECISION NOT NULL,
        leverage DOUBLE PRECISION NOT NULL DEFAULT 1,
        entry_long_price DOUBLE PRECISION NOT NULL,
        entry_short_price DOUBLE PRECISION NOT NULL,
        mark_long_price DOUBLE PRECISION NOT NULL,
        mark_short_price DOUBLE PRECISION NOT NULL,
        net_hourly_funding_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
        accrued_funding_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        fees_paid_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        unrealized_pnl_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        realized_pnl_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        take_profit_bps DOUBLE PRECISION NOT NULL DEFAULT 45,
        stop_loss_bps DOUBLE PRECISION NOT NULL DEFAULT 35,
        expected_net_edge_bps DOUBLE PRECISION NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN',
        execution_mode TEXT NOT NULL DEFAULT 'PAPER',
        is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
        opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_reconciled_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP,
        close_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS risk_decisions (
        id SERIAL PRIMARY KEY,
        action_type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        execution_mode TEXT NOT NULL,
        requested_notional_usd DOUBLE PRECISION NOT NULL,
        leverage DOUBLE PRECISION NOT NULL DEFAULT 1,
        approved BOOLEAN NOT NULL,
        blocked_gate TEXT,
        reasons_json JSONB NOT NULL,
        portfolio_snapshot_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS strategy_versions (
        id SERIAL PRIMARY KEY,
        strategy_key TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        parameters_json JSONB NOT NULL,
        change_source TEXT NOT NULL DEFAULT 'seed',
        change_reason TEXT NOT NULL,
        validation_sharpe DOUBLE PRECISION NOT NULL DEFAULT 0,
        realized_expectancy_bps DOUBLE PRECISION NOT NULL DEFAULT 0,
        rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS backtest_runs (
        id SERIAL PRIMARY KEY,
        strategy_family TEXT NOT NULL,
        symbol TEXT NOT NULL,
        data_source TEXT NOT NULL,
        candle_count INTEGER NOT NULL,
        initial_capital DOUBLE PRECISION NOT NULL,
        final_equity DOUBLE PRECISION NOT NULL,
        total_return_pct DOUBLE PRECISION NOT NULL,
        benchmark_return_pct DOUBLE PRECISION NOT NULL,
        in_sample_return_pct DOUBLE PRECISION NOT NULL,
        out_of_sample_return_pct DOUBLE PRECISION NOT NULL,
        max_drawdown_pct DOUBLE PRECISION NOT NULL,
        sharpe_ratio DOUBLE PRECISION NOT NULL,
        sortino_ratio DOUBLE PRECISION NOT NULL,
        win_rate_pct DOUBLE PRECISION NOT NULL,
        profit_factor DOUBLE PRECISION NOT NULL,
        expectancy_usd DOUBLE PRECISION NOT NULL,
        total_trades INTEGER NOT NULL,
        total_fees_usd DOUBLE PRECISION NOT NULL,
        is_validated_edge BOOLEAN NOT NULL,
        verdict_summary TEXT NOT NULL,
        equity_curve_json JSONB NOT NULL,
        stress_tests_json JSONB NOT NULL,
        sensitivity_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_decisions (
        id SERIAL PRIMARY KEY,
        cycle_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        predicted_net_edge_bps DOUBLE PRECISION NOT NULL,
        realized_net_edge_bps DOUBLE PRECISION,
        prediction_error_bps DOUBLE PRECISION,
        confidence_score DOUBLE PRECISION NOT NULL,
        uncertainty_score DOUBLE PRECISION NOT NULL,
        data_quality_score DOUBLE PRECISION NOT NULL,
        strategy_version_id INTEGER,
        position_id INTEGER,
        reasoning TEXT NOT NULL,
        steps_telemetry_json JSONB DEFAULT '{}'::jsonb,
        reconciled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS business_records (
        id SERIAL PRIMARY KEY,
        channel TEXT NOT NULL,
        record_type TEXT NOT NULL,
        title TEXT NOT NULL,
        sku_or_ref TEXT NOT NULL,
        status TEXT NOT NULL,
        gross_amount_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        cogs_and_fees_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        net_contribution_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        roas_multiple DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_verified_real_revenue BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT NOT NULL,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broker_connections (
        id SERIAL PRIMARY KEY,
        provider_key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        environment_mode TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        oauth_state TEXT,
        oauth_state_expires_at TIMESTAMP,
        masked_credential TEXT,
        capabilities_json JSONB DEFAULT '[]'::jsonb,
        status_summary TEXT NOT NULL,
        blocker_notice TEXT,
        account_metrics_json JSONB DEFAULT '{}'::jsonb,
        last_verified_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        severity TEXT NOT NULL,
        module TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ml_models (
        id SERIAL PRIMARY KEY,
        model_key TEXT NOT NULL UNIQUE,
        app_profile TEXT NOT NULL DEFAULT 'SURVIVAL_CORE',
        generation INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        feature_names_json JSONB NOT NULL,
        weights_json JSONB NOT NULL,
        bandit_arms_json JSONB NOT NULL,
        learning_rate DOUBLE PRECISION NOT NULL DEFAULT 0.015,
        exploration_factor DOUBLE PRECISION NOT NULL DEFAULT 1.1,
        train_samples_count INTEGER NOT NULL DEFAULT 0,
        train_mse_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
        val_mse_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
        directional_accuracy_pct DOUBLE PRECISION NOT NULL DEFAULT 50,
        out_of_sample_sharpe DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ml_training_runs (
        id SERIAL PRIMARY KEY,
        model_key TEXT NOT NULL,
        generation INTEGER NOT NULL,
        epochs_run INTEGER NOT NULL,
        samples_processed INTEGER NOT NULL,
        initial_val_loss DOUBLE PRECISION NOT NULL,
        final_val_loss DOUBLE PRECISION NOT NULL,
        loss_improvement_pct DOUBLE PRECISION NOT NULL,
        accuracy_after_pct DOUBLE PRECISION NOT NULL,
        dominant_strategy_arm TEXT NOT NULL,
        promoted_to_active BOOLEAN NOT NULL DEFAULT TRUE,
        loss_curve_json JSONB NOT NULL,
        notes TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_memories (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'hhlongwane-primary',
        memory_key TEXT NOT NULL,
        content JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, memory_key)
      );
    `);
  })();

  try {
    await migrationRanPromise;
  } catch (err) {
    migrationRanPromise = null;
    throw err;
  }
}
