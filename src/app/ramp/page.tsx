"use client";

import { AppShell } from "@/components/AppShell";
import { DepositPanel } from "@/components/ramp/DepositPanel";
import { WithdrawPanel } from "@/components/ramp/WithdrawPanel";
import { DiscoveryPanel } from "@/components/ramp/DiscoveryPanel";

export default function RampPage() {
  return (
    <AppShell
      title="Cash in and out"
      subtitle="Move money between a Turkish bank account and the wallet that pays for missions"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
        <DepositPanel />
        <WithdrawPanel />
        <DiscoveryPanel />
      </div>
    </AppShell>
  );
}
