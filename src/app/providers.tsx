"use client";

import dynamic from "next/dynamic";
import { WalletProvider } from "@/lib/stellar/WalletContext";
import { DroneFleetProvider } from "@/lib/DroneFleetContext";

const AIChat = dynamic(() => import("@/components/AIChat"), { ssr: false });

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <DroneFleetProvider>
        {children}
        <AIChat />
      </DroneFleetProvider>
    </WalletProvider>
  );
}
