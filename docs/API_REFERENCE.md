# Survival AI Recreation — REST API Reference

All API endpoints are implemented under Next.js App Router (`src/app/api/*`) with dynamic execution, input sanitization, rate limiting, and PostgreSQL persistence.

## Core Health & Dashboard

- `GET /api/health` — Probes PostgreSQL connectivity (`SELECT 1`), initializes schema seed safely, and returns table row counts plus safety lock flags (`{ ok: true, persistence, safety }`).
- `GET /api/dashboard?refresh=1` — Aggregates live multi-venue market quotes, PR #15 ranked market gaps, segregated wallets, open/closed positions, orders, double-entry ledger, risk policy, AI decisions, strategy versions, backtests, Shopify business records, and broker statuses.

## Crypto Market Intelligence & PR #15 Arbitrage

- `GET /api/crypto/status` — Returns exchange reachability (`Hyperliquid`, `Kraken Futures`, `Kraken Spot`, `Coinbase`, `Binance HTTP 451 notice`), global regime, tracked symbols, and execution governance flags.
- `POST /api/crypto/analyze` — Deep single-asset analysis. Body: `{ "symbol": "BTC" | "ETH" | "SOL" | "TRUMP" | ..., "notionalUsd": 10000, "holdingHours": 48 }`. Returns venue quotes, spread/depth metrics, token safety/concentration score, full 12-factor PR #15 friction breakdown, and walk-forward summary.
- `GET /api/crypto/gaps?notionalUsd=10000&holdingHours=48` — Scans all cross-venue directional combinations and returns ranked `FundingBasisEvaluation[]`.

## Capital Vault, Paper Trading & Quantitative Validation

- `GET /api/wallet` — Returns segregated wallets, recent append-only ledger entries, and payment events.
- `POST /api/wallet` — Deposits or withdraws sandbox capital idempotently. Body: `{ "action": "DEPOSIT" | "WITHDRAW", "amountUsd": 10000, "idempotencyKey": "..." }`.
- `GET /api/trades` — Reconciles open positions against live exchange marks and returns open/closed positions plus order history.
- `POST /api/trades` — Executes an order through all 12 safety gates (`PAPER` or blocked `LIVE`), reconciles funding carry (`{ "action": "RECONCILE_CARRY", "hours": 8 }`), or closes a position (`{ "action": "CLOSE_POSITION", "positionId": 1 }`).
- `GET /api/backtest` & `POST /api/backtest` — Executes zero-look-ahead walk-forward backtests with 3 adverse stress scenarios and 6-cell sensitivity grid, persisting results to `backtest_runs`.

## Risk Governance, Autonomous AI, Business & Integrations

- `GET /api/risk` & `POST /api/risk` — Reads/updates risk policy or executes `{ "action": "RUN_SAFETY_DRILL" }`.
- `GET /api/ai` & `POST /api/ai` — Runs the 12-step autonomous controller cycle or triggers `{ "action": "ROLLBACK_STRATEGY", "strategyKey": "CROSS_VENUE_FUNDING_ARB" }`.
- `GET /api/business` & `POST /api/business` — Evaluates Shopify/SaaS unit economics strictly separated from verified real income.
- `GET /api/integrations`, `POST /api/integrations`, & `GET /api/integrations/ctrader/callback` — Executes PayPal Sandbox Order + HMAC Webhook Verification + Duplicate Replay checks, cTrader OAuth CSRF state flow, and MT5 Demo Bridge tests.
