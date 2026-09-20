"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandLockup } from "@/components/BrandLockup";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { SystemStrip } from "@/components/SystemStrip";

const WalletConnect = dynamic(() => import("@/components/WalletConnect"), { ssr: false });

interface AppShellProps {
  /** Page name, shown on the panel's designation strip. */
  title: string;
  /** One line saying what this screen is for. */
  subtitle?: string;
  /** Controls belonging to this page, sat next to the wallet. */
  actions?: React.ReactNode;
  /** Extra modules for the left rail, below the navigation. */
  rail?: React.ReactNode;
  /** Drop the padding and let the page fill the frame edge to edge. */
  bleed?: boolean;
  children: React.ReactNode;
}

/**
 * The frame every operational screen sits in: a fixed rail on the left, a
 * designation strip across the top carrying live system state, and the page
 * itself in the remaining area.
 */
export function AppShell({
  title,
  subtitle,
  actions,
  rail,
  bleed = false,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-panel-base">
      <aside className="hidden w-58 shrink-0 flex-col border-r border-bezel bg-panel-raised lg:flex">
        <Link
          href="/"
          className="flex items-center gap-2.5 border-b border-bezel px-4 py-3.5 transition-colors hover:bg-panel-high"
        >
          <BrandLockup size={26} priority />
        </Link>

        <div className="py-2">
          <DashboardNav />
        </div>

        {rail && <div className="flex-1 overflow-y-auto no-scrollbar">{rail}</div>}
        {!rail && <div className="flex-1" />}

        <div className="border-t border-bezel px-4 py-3">
          <div className="readout-label mb-1.5">Network</div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-active" />
            <span className="font-mono text-[11px] text-text-secondary">
              Stellar testnet
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bezel bg-panel-raised px-3 sm:gap-4 sm:px-4">
          <Link href="/" className="shrink-0 lg:hidden">
            <BrandLogo size={24} />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate font-condensed text-[15px] font-semibold leading-tight text-text-primary sm:text-[17px]">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-[11.5px] leading-tight text-text-muted sm:block">
                {subtitle}
              </p>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SystemStrip />
            {actions}
            <WalletConnect />
          </div>
        </header>

        {/* The rail is hidden below lg, so the same destinations go here. */}
        <div className="lg:hidden">
          <DashboardNav orientation="horizontal" />
        </div>

        <main className={`flex-1 overflow-y-auto ${bleed ? "" : "p-3 sm:p-4"}`}>{children}</main>
      </div>
    </div>
  );
}
