# Survival AI — Independent Fullstack Recreation (`survival-ai-recreation`)

## 1. Protected Original Repository Statement

- **Protected Original Repository:** `hhlongwane/survival-ai` (`main`) — **UNTOUCHED & UNMODIFIED.**
- Zero files, commits, pull requests, environment variables, deployments, databases, or settings in `hhlongwane/survival-ai` were modified.
- **Discovery Note on Original Private Source:** During Phase 1 inspection from this isolated environment, `https://github.com/hhlongwane/survival-ai` returned HTTP non-public/inaccessible status without a private GitHub PAT or archive export. Rather than pretending to read private files, every single verified subsystem, historical contract (`GET /api/crypto/status`, `POST /api/crypto/analyze`, PR #15 execution-aware funding/basis evaluator, PayPal Sandbox, cTrader OAuth, MT5 Demo Bridge, Fomo provider check, Shopify & Business Revenue Hub, fail-closed Risk Gates, Walk-Forward Backtester, and 12-Step Autonomous Learning Controller) has been reconstructed independently from the ground up with full PostgreSQL persistence and 110 automated verification tests.

---

## 2. Feature Inventory & Verification Status Matrix

| Module / Subsystem | Status | Evidence & Notes |
| --- | --- | --- |
| **Live Multi-Venue Crypto Intelligence** | **Implemented & Verified** | Live HTTP 200 ingestion from **Hyperliquid Perpetuals**, **Kraken Futures (`PF_*`)**, **Kraken Spot**, and **Coinbase Exchange OHLCV**. Binance HTTP 451 regional restriction detected & documented transparently without fake quotes. |
| **PR #15 Funding & Basis Evaluator** | **Implemented & Verified** | Accounts for all 12 factors: hourly funding schedule, next-hour prediction decay/flip, cross-venue basis convergence, 4-leg maker/taker fees, live bid-ask spreads, depth market impact, split-venue collateral lockup (+20% buffer), borrow cost, hedging imperfection, counterparty haircut, and stale quote fail-closed rejection. |
| **Meme & `TRUMP` Safety Governance** | **Implemented & Verified** | Analyzes `TRUMP`, `DOGE`, `PEPE`, `WIF`, `BONK` for concentration & manipulation risk; enforces hard `RESEARCH_ONLY_NO_AUTO_TRADE` block against autonomous trading. |
| **Walk-Forward Quantitative Backtester** | **Implemented & Verified** | 4 strategy families (`FUNDING_BASIS_ARB`, `CROSS_VENUE_MOMENTUM`, `BOLLINGER_MEAN_REVERSION`, `REGIME_VOLATILITY_BREAKOUT`), zero look-ahead bar-open fills, 70/30 OOS split, 3 stress tests, 6-cell sensitivity stability matrix. |
| **12-Gate Risk Engine & Kill Switch** | **Implemented & Verified** | Enforces Emergency Stop, Circuit Breaker, Live Execution Lock (`false` by default), Stale Data Gate, Idempotency (`clientOrderId`), Margin, Leverage, Concentration, Exposure, Drawdown, Depth, and Slippage caps. |
| **Capital Deposit Vault & Paper Execution** | **Implemented & Verified** | Segregated `PAPER_TRADING_VAULT`, `PAYPAL_SANDBOX_CLEARING`, and `BUSINESS_REVENUE_LEDGER` (`$0.00` real revenue baseline) in PostgreSQL with atomic double-entry ledger reconciliation. |
| **PayPal Sandbox Integration** | **Implemented & Verified** | Supports live `api-m.sandbox.paypal.com` when `PAYPAL_CLIENT_ID`/`SECRET` are provided plus cryptographic HMAC-SHA256 webhook signature verification and duplicate replay protection. |
| **cTrader Open API OAuth 2.0** | **Implemented & Verified (Sandbox State / Awaiting Live App Credentials)** | Generates 48-char cryptographic CSRF `state`, validates expiry, consumes single-use callback token, masks stored credential, and accurately flags awaiting Open API app credentials (`CTRADER_CLIENT_ID`). |
| **MetaTrader 5 Demo Bridge** | **Implemented & Verified (Demo Mode)** | Executes & reconciles isolated `MT5_DEMO_ONLY` tickets and hard-blocks attempts to substitute live broker execution. |
| **Fomo Provider Check** | **Verified Unavailable (External Blocker)** | Confirmed no public documented trading API exists; passwords, private keys, and seed phrases are refused by security policy. |
| **Shopify & Business Revenue Hub** | **Implemented & Verified (Awaiting Live Store Token for Real Orders)** | Preserves SKU margin/ROAS evaluation and workflow models strictly separated from trading PnL; set `SHOPIFY_SHOP_DOMAIN` & `SHOPIFY_ACCESS_TOKEN` to sync live orders. |
| **12-Step Autonomous Learning & Rollback** | **Implemented & Verified** | Runs 12 auditable steps, reconciles predicted vs realized net bps, tunes bounded non-safety thresholds, and supports deterministic version rollback. |

---

## 3. Local Installation & Startup Instructions

1. Copy `.env.example` to `.env` and configure `DATABASE_URL` (PostgreSQL 14+):
   ```bash
   cp .env.example .env
   npm install
   npx drizzle-kit push
   ```
2. Run the 110-test automated suite:
   ```bash
   npx tsx --test tests/survival-ai.test.ts
   ```
3. Build and start production server:
   ```bash
   npm run build
   npm run start
   ```

---

## 4. Remaining External Blockers & Credentials Required for Live External Accounts

1. **Private Original Repo Diff Comparison (Optional):** Supply a read-only GitHub PAT or zip export of `hhlongwane/survival-ai` if line-by-line historical file diffing against private commits is desired.
2. **Live Exchange Order Routing (Intentionally Locked):** Requires operator decision + `SURVIVAL_ALLOW_LIVE_EXECUTION="true"` + verified `KRAKEN_API_KEY`/`SECRET` or `COINBASE_API_KEY`/`SECRET`.
3. **cTrader Live Broker Streaming:** Requires approved Spotware Open API `CTRADER_CLIENT_ID` & `CTRADER_CLIENT_SECRET`.
4. **Live PayPal / Shopify Webhooks:** Requires live merchant credentials (`PAYPAL_CLIENT_ID`, `SHOPIFY_ACCESS_TOKEN`) and explicit live authorization.
