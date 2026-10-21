import crypto from "crypto";
import { db } from "@/db";
import { auditLogs, systemConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface StoredCredentialsConfig {
  // 1. PayPal Account & Checkout Credentials
  paypalAccountEmail: string;
  paypalAccountHolderName: string;
  paypalMode: "live" | "sandbox";
  paypalLiveClientId: string;
  paypalLiveClientSecret: string;
  paypalSandboxClientId: string;
  paypalSandboxClientSecret: string;

  // 2. FxPro Account & Autonomous Trading Configuration
  fxproEnabled: boolean;
  fxproAutoTradeAuthorized: boolean;
  fxproEnvironment: "LIVE" | "DEMO";
  fxproProtocol: "CTRADER_OPEN_API" | "MT5_BRIDGE";
  fxproServerName: string; // e.g. "FxPro-MT5 Live01", "FxPro-cTrader Live"
  fxproCtraderClientId: string;
  fxproCtraderClientSecret: string;
  fxproCtraderAccessToken: string;
  fxproCtraderAccountId: string;
  fxproMt5BridgeUrl: string;
  fxproMt5BridgeToken: string;
  fxproMt5AccountLogin: string;
  fxproAllocatedCapitalUsd: number;
  fxproMaxLotSize: number;
  fxproMaxDailyLossUsd: number;

  // 3. Live Crypto Exchange API Credentials
  liveCryptoAutoTradeAuthorized: boolean;
  krakenApiKey: string;
  krakenApiSecret: string;
  maxLiveCryptoOrderUsd: number;
}

function buildEnvCredentialsDefaults(): StoredCredentialsConfig {
  const isEnvLivePayPal =
    (process.env.PAYPAL_MODE || process.env.PAYPAL_ENVIRONMENT || "").toLowerCase() === "live";

  return {
    paypalAccountEmail: process.env.PAYPAL_ACCOUNT_EMAIL || "",
    paypalAccountHolderName: "",
    paypalMode: isEnvLivePayPal ? "live" : "sandbox",
    paypalLiveClientId:
      process.env.PAYPAL_LIVE_CLIENT_ID ||
      (isEnvLivePayPal ? process.env.PAYPAL_CLIENT_ID || "" : ""),
    paypalLiveClientSecret:
      process.env.PAYPAL_LIVE_CLIENT_SECRET ||
      (isEnvLivePayPal ? process.env.PAYPAL_CLIENT_SECRET || "" : ""),
    paypalSandboxClientId:
      process.env.PAYPAL_SANDBOX_CLIENT_ID ||
      (!isEnvLivePayPal ? process.env.PAYPAL_CLIENT_ID || "" : ""),
    paypalSandboxClientSecret:
      process.env.PAYPAL_SANDBOX_CLIENT_SECRET ||
      (!isEnvLivePayPal ? process.env.PAYPAL_CLIENT_SECRET || "" : ""),

    fxproEnabled: true,
    fxproAutoTradeAuthorized: true,
    fxproEnvironment: (process.env.FXPRO_ENVIRONMENT as "LIVE" | "DEMO") || "LIVE",
    fxproProtocol: "CTRADER_OPEN_API",
    fxproServerName: process.env.FXPRO_SERVER_NAME || "FxPro-cTrader Live",
    fxproCtraderClientId:
      process.env.FXPRO_CTRADER_CLIENT_ID || process.env.CTRADER_CLIENT_ID || "",
    fxproCtraderClientSecret:
      process.env.FXPRO_CTRADER_CLIENT_SECRET || process.env.CTRADER_CLIENT_SECRET || "",
    fxproCtraderAccessToken: process.env.FXPRO_CTRADER_ACCESS_TOKEN || "",
    fxproCtraderAccountId: process.env.FXPRO_CTRADER_ACCOUNT_ID || "",
    fxproMt5BridgeUrl: process.env.FXPRO_MT5_BRIDGE_URL || process.env.MT5_BRIDGE_URL || "",
    fxproMt5BridgeToken: process.env.FXPRO_MT5_BRIDGE_TOKEN || process.env.MT5_BRIDGE_TOKEN || "",
    fxproMt5AccountLogin: process.env.FXPRO_MT5_LOGIN || "",
    fxproAllocatedCapitalUsd: 0,
    fxproMaxLotSize: 0.25,
    fxproMaxDailyLossUsd: 250,

    liveCryptoAutoTradeAuthorized: true,
    krakenApiKey: process.env.KRAKEN_API_KEY || "",
    krakenApiSecret: process.env.KRAKEN_API_SECRET || "",
    maxLiveCryptoOrderUsd: 500,
  };
}

function deriveEncryptionKey(): Buffer {
  // Stable deterministic local encryption key tied to DATABASE_URL so secrets saved in PostgreSQL survive every container restart!
  const masterMaterial =
    process.env.SURVIVAL_MASTER_ENCRYPTION_KEY ||
    process.env.DATABASE_URL ||
    "survival-ai-local-vault-key-material";
  return crypto.createHash("sha256").update(masterMaterial).digest();
}

export function encryptVaultPayload(plainObject: StoredCredentialsConfig): string {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const json = JSON.stringify(plainObject);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptVaultPayload(ciphertext: string): Partial<StoredCredentialsConfig> {
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return {};
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const enc = Buffer.from(parts[2], "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

export function maskSecretValue(val: string): string {
  if (!val || val.trim().length === 0) return "";
  if (val.length <= 8) return "••••••••";
  return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
}

export async function getServerSecrets(): Promise<StoredCredentialsConfig> {
  const defaults = buildEnvCredentialsDefaults();
  const rows = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.configKey, "encrypted_live_credentials"))
    .limit(1);

  if (rows.length === 0) {
    return defaults;
  }

  const stored = rows[0].configValue as { ciphertext?: string };
  const decrypted = stored?.ciphertext ? decryptVaultPayload(stored.ciphertext) : {};

  const merged: StoredCredentialsConfig = { ...defaults };
  for (const [k, v] of Object.entries(decrypted) as Array<[keyof StoredCredentialsConfig, any]>) {
    if (v === undefined) continue;
    if (typeof v === "string") {
      if (v.trim() !== "") (merged as any)[k] = v;
    } else {
      (merged as any)[k] = v;
    }
  }
  return merged;
}

export async function getPublicMaskedCredentialsSummary() {
  const s = await getServerSecrets();

  const hasLivePayPal = Boolean(s.paypalLiveClientId && s.paypalLiveClientSecret);
  const hasSandboxPayPal = Boolean(s.paypalSandboxClientId && s.paypalSandboxClientSecret);
  const hasPayPalEmail = Boolean(s.paypalAccountEmail);
  const activeAccountNumber = s.fxproCtraderAccountId || s.fxproMt5AccountLogin || "";
  const hasFxProDirectApi = Boolean(
    (s.fxproCtraderAccessToken && s.fxproCtraderAccountId) || s.fxproMt5BridgeUrl
  );
  const hasFxProAccountProfile = Boolean(activeAccountNumber);
  const hasFxProOAuthApp = Boolean(s.fxproCtraderClientId && s.fxproCtraderClientSecret);
  const hasKrakenLive = Boolean(s.krakenApiKey && s.krakenApiSecret);

  return {
    paypal: {
      accountEmail: s.paypalAccountEmail,
      accountHolderName: s.paypalAccountHolderName,
      accountLinked: hasPayPalEmail || hasLivePayPal || hasSandboxPayPal,
      mode: hasLivePayPal ? "live" : s.paypalMode,
      liveConfigured: hasLivePayPal,
      sandboxConfigured: hasSandboxPayPal,
      maskedLiveClientId: maskSecretValue(s.paypalLiveClientId),
      maskedLiveSecret: maskSecretValue(s.paypalLiveClientSecret),
      statusLabel: hasPayPalEmail
        ? `CONNECTED: ${s.paypalAccountEmail}`
        : hasLivePayPal
          ? "PAYPAL LIVE API CONNECTED"
          : hasSandboxPayPal
            ? "PAYPAL CHECKOUT API READY"
            : "ADD YOUR PAYPAL ACCOUNT EMAIL BELOW",
    },
    fxpro: {
      enabled: s.fxproEnabled,
      autoTradeAuthorized: s.fxproAutoTradeAuthorized,
      environment: s.fxproEnvironment,
      protocol: s.fxproProtocol,
      serverName: s.fxproServerName || "FxPro-cTrader Live",
      accountConnected: hasFxProAccountProfile || hasFxProDirectApi,
      liveBridgeReady: hasFxProDirectApi,
      oauthAppReady: hasFxProOAuthApp,
      maskedCtraderClientId: maskSecretValue(s.fxproCtraderClientId),
      maskedAccessToken: maskSecretValue(s.fxproCtraderAccessToken),
      accountId: activeAccountNumber,
      allocatedCapitalUsd: s.fxproAllocatedCapitalUsd || 0,
      mt5BridgeUrl: s.fxproMt5BridgeUrl,
      maxLotSize: s.fxproMaxLotSize,
      maxDailyLossUsd: s.fxproMaxDailyLossUsd,
      statusLabel: hasFxProAccountProfile
        ? `FXPRO ${s.fxproEnvironment} ACCOUNT #${activeAccountNumber} (${s.fxproServerName}) ACTIVE`
        : "ENTER YOUR FXPRO ACCOUNT NUMBER BELOW",
    },
    krakenLive: {
      autoTradeAuthorized: s.liveCryptoAutoTradeAuthorized,
      liveConfigured: hasKrakenLive,
      maskedApiKey: maskSecretValue(s.krakenApiKey),
      maxLiveCryptoOrderUsd: s.maxLiveCryptoOrderUsd,
    },
  };
}

export async function saveEncryptedCredentials(patch: Partial<StoredCredentialsConfig>) {
  const current = await getServerSecrets();
  const next: StoredCredentialsConfig = { ...current };

  for (const [k, v] of Object.entries(patch) as Array<[keyof StoredCredentialsConfig, any]>) {
    if (v === undefined) continue;
    if (typeof v === "string") {
      if (v === "__CLEAR__") {
        (next as any)[k] = "";
      } else if (v.trim() !== "") {
        (next as any)[k] = v.trim();
      }
    } else {
      (next as any)[k] = v;
    }
  }

  const ciphertext = encryptVaultPayload(next);
  const existing = await db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.configKey, "encrypted_live_credentials"))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(systemConfigs).values({
      configKey: "encrypted_live_credentials",
      configValue: { ciphertext, algorithm: "aes-256-gcm" },
      version: 1,
      updatedBy: "operator_encrypted_vault",
    });
  } else {
    await db
      .update(systemConfigs)
      .set({
        configValue: { ciphertext, algorithm: "aes-256-gcm" },
        version: existing[0].version + 1,
        updatedAt: new Date(),
      })
      .where(eq(systemConfigs.configKey, "encrypted_live_credentials"));
  }

  await db.insert(auditLogs).values({
    severity: "SECURITY",
    module: "CREDENTIALS_VAULT",
    eventType: "ENCRYPTED_CREDENTIALS_UPDATED",
    message:
      "Saved PayPal & FxPro account configuration into persistent AES-256-GCM PostgreSQL vault.",
  });

  return await getPublicMaskedCredentialsSummary();
}
