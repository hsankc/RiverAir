"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Map as MapIcon, Zap, Crosshair, Clock, ArrowLeftRight } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Operations", icon: Activity },
  { href: "/marketplace", label: "Missions", icon: MapIcon },
  { href: "/ramp", label: "Cash", icon: ArrowLeftRight },
  { href: "/sky-charge", label: "Charging", icon: Zap },
  { href: "/control", label: "Manual control", icon: Crosshair },
  { href: "/flight-logs", label: "Flight record", icon: Clock },
];

/**
 * `horizontal` is the small-screen form: the rail is hidden below `lg`, so the
 * same destinations run along a scrollable strip under the header instead.
 */
export function DashboardNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  if (orientation === "horizontal") {
    return (
      <nav className="no-scrollbar flex gap-px overflow-x-auto border-b border-bezel bg-panel-raised">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
                active
                  ? "border-nav bg-nav/8 text-text-primary"
                  : "border-transparent text-text-secondary"
              }`}
            >
              <l.icon className={`h-3.5 w-3.5 ${active ? "text-nav" : "text-text-muted"}`} />
              <span className="font-condensed whitespace-nowrap tracking-wide">{l.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-px">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? "border-nav bg-nav/8 text-text-primary"
                : "border-transparent text-text-secondary hover:border-bezel-lit hover:bg-panel-high/60 hover:text-text-primary"
            }`}
          >
            <l.icon
              className={`h-4 w-4 shrink-0 ${active ? "text-nav" : "text-text-muted"}`}
            />
            <span className="font-condensed tracking-wide">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
