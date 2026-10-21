# Security, Privacy (POPIA), and Risk-Control Audit Report

## 1. Secret Management & Repository Isolation
- Zero API keys, OAuth tokens, webhook secrets, or database passwords are hardcoded in client bundles or documentation.
- `.env.example` contains sanitized placeholders only; all runtime secrets are read strictly server-side from `process.env`.
- `hhlongwane/survival-ai` was never cloned with write access, pushed to, or altered in any form.

## 2. Fail-Closed Risk Controls Verified
1. **Live Execution Lock (`LIVE_EXECUTION_DISABLED`):** Live real-money order routing fails closed unless both operator configuration and verified exchange API credentials exist.
2. **Autonomous Self-Modification Block:** `updateRiskPolicy(..., "autonomous_ai")` throws `SECURITY_VIOLATION` so the AI controller can never weaken leverage, drawdown, or kill-switch rules.
3. **Meme & `TRUMP` Auto-Trade Prohibition (`SPECULATIVE_MEME_SAFETY_GATE`):** High-concentration speculative tokens are analyzable in research endpoints but hard-blocked from autonomous trade execution.
4. **Idempotency & Replay Protection:** Unique PostgreSQL indexes on `ledger_entries.idempotency_key`, `orders.client_order_id`, and `payment_events.external_order_id` prevent duplicate charges, double fills, and replayed webhooks.
5. **Cryptographic Webhook & OAuth Verification:** PayPal Sandbox webhooks use timing-safe `crypto.timingSafeEqual` HMAC-SHA256 verification; cTrader OAuth callbacks enforce single-use expiring 24-byte random CSRF `state` tokens.

## 3. Data Minimization & South Africa POPIA Alignment
- Minimal data collection: zero customer PII, card numbers, banking credentials, or seed phrases are collected or persisted.
- Configurable retention policy via `DATA_RETENTION_DAYS` and `ANONYMIZE_CUSTOMER_RECORDS=true`.
