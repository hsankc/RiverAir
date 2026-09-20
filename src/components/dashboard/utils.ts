/* Dashboard shared utility functions */

export const locale = "en";
export const tx = (val: unknown) => String(val);

export function statusColor(s: string) {
  switch (s) {
    case "in-flight": return "text-accent-cyan";
    case "mission": return "text-accent-violet";
    case "charging": return "text-warning";
    case "emergency": return "text-danger";
    default: return "text-text-muted";
  }
}

export function statusDotClass(s: string) {
  switch (s) {
    case "in-flight": return "status-active";
    case "mission": return "status-active";
    case "charging": return "status-charging";
    case "emergency": return "status-emergency";
    default: return "status-idle";
  }
}

export function typeColor(t: string) {
  switch (t) {
    case "cargo": return "bg-[#18181B] text-[#60A5FA] border-[#27272A]";
    case "agricultural": return "bg-[#18181B] text-[#34D399] border-[#27272A]";
    case "surveillance": return "bg-[#18181B] text-[#A78BFA] border-[#27272A]";
    case "emergency": return "bg-[#18181B] text-[#F87171] border-[#27272A]";
    case "fire": return "bg-[#18181B] text-[#F87171] border-[#27272A]";
    case "traffic": return "bg-[#18181B] text-[#FBBF24] border-[#27272A]";
    default: return "bg-[#18181B] text-[#A1A1AA] border-[#27272A]";
  }
}

export function logLevelColor(l: string) {
  switch (l) {
    case "success": return "text-[#34D399]";
    case "warning": return "text-[#FBBF24]";
    case "error": return "text-[#F87171]";
    default: return "text-[#A1A1AA]";
  }
}
