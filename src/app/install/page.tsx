import React from "react";
import { generateHighProfitPortfolioPlan } from "@/lib/engine/profit-optimizer";
import { getPublicMaskedCredentialsSummary } from "@/lib/engine/credentials-vault";
import { scanLiveFxProAndGoldOpportunities } from "@/lib/engine/fxpro-connector";
import { ensureLiveCapitalVaultExists } from "@/lib/engine/paypal-live";
import { AndroidInstallCenter } from "@/components/AndroidInstallCenter";

export const dynamic = "force-dynamic";

export default async function InstallOnAndroidPage() {
  const [plan, creds, fxproSignals, liveVault] = await Promise.all([
    generateHighProfitPortfolioPlan(),
    getPublicMaskedCredentialsSummary(),
    scanLiveFxProAndGoldOpportunities(),
    ensureLiveCapitalVaultExists(),
  ]);

  return (
    <AndroidInstallCenter
      initialPlan={plan}
      initialCreds={creds}
      initialFxProSignals={fxproSignals}
      initialLiveVaultUsd={liveVault.availableBalance}
    />
  );
}
