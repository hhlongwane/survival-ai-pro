# Backtesting, Paper-Trading Validation & Independent Deployment Report

## 1. Quantitative Validation Findings
- **Historical Data Source:** Live Coinbase Exchange hourly OHLCV candles (`LIVE_COINBASE_HOURLY_OHLCV`, up to 350 bars per asset) with deterministic multi-regime fallback when offline.
- **Bias Prevention:** Signal calculations inspect closed bars `[0 .. i-1]` exclusively and execute at bar `[i].open` plus explicit fee and slippage bps.
- **Walk-Forward Protocol:** 70% In-Sample / 30% Out-of-Sample split accompanied by 3 adverse stress tests (`20% Flash Crash Shock`, `2.5x Fee + 3x Slippage Drought`, `Adverse Funding Regime Flip`) and a 6-cell parameter neighborhood stability check.
- **Honest Edge Classification:** Strategies that make money on a tiny trade count (`< 4 trades`), suffer negative out-of-sample drift, or fail parameter neighborhood stability are labeled `UNVALIDATED / RESEARCH ONLY`.

## 2. Independent Deployment Runbook (Render / Docker / Railway / Fly.io)
1. Provision a dedicated PostgreSQL 15+ instance (never share the original project's database; never use ephemeral local SQLite for production deployments).
2. Configure environment variables from `.env.example` (`DATABASE_URL`, `SURVIVAL_ADMIN_TOKEN`, `SURVIVAL_WEBHOOK_SECRET`, keeping `SURVIVAL_ALLOW_LIVE_EXECUTION="false"` until independently audited).
3. Build command: `npm ci && npx drizzle-kit push && npm run build`
4. Start command: `npm run start`
5. Health check path: `/api/health` (verifies live `SELECT 1` round-trip and durable table counts).
