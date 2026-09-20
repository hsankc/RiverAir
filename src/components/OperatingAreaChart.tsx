import { BASES } from "@/lib/fleet";

/**
 * The operating area, drawn as a plan view.
 *
 * Every base is plotted from the coordinates its own fleet file declares, so
 * this chart cannot drift away from where the aircraft actually live — move a
 * base in `src/lib/fleet/` and the chart moves with it.
 *
 * There is no terrain here on purpose. An approach plate's plan view is
 * navigation geometry, not a map, and a hand-drawn coastline would be a
 * decorative guess. The one piece of geography that matters to this product is
 * drawn instead: the Bosphorus, because the fleet is split across it the same
 * way the payment is split across two currencies.
 */

/** The simulation's operating bounds, so the projection matches the live map. */
const BOUNDS = { minLat: 40.78, maxLat: 41.35, minLng: 28.1, maxLng: 29.72 };

const W = 1200;
const H = 560;

const x = (lng: number) => ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
const y = (lat: number) => ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;

/** Three-letter designator, the same shorthand the live map falls back to. */
const code = (name: string) => name.split(" ")[0].slice(0, 3).toUpperCase();

const TONE: Record<string, string> = {
  cargo: "var(--color-data)",
  agricultural: "var(--color-engaged)",
  surveillance: "var(--color-nav)",
  emergency: "var(--color-warning)",
};

/**
 * Legs shown on the chart. These are real pairings the fleet flies — a courier
 * crossing the water, a sprayer working the western farmland, a responder
 * heading for the northern forest.
 */
const LEGS: Array<{ from: number; to: number; tone: string; delay: number }> = [
  { from: 5, to: 1, tone: "var(--color-data)", delay: 0.15 },
  { from: 2, to: 6, tone: "var(--color-engaged)", delay: 0.5 },
  { from: 4, to: 3, tone: "var(--color-nav)", delay: 0.85 },
];

export function OperatingAreaChart({ className = "" }: { className?: string }) {
  const at = (id: number) => {
    const b = BASES.find((base) => base.droneId === id) ?? BASES[0];
    return { px: x(b.lng), py: y(b.lat) };
  };

  return (
    <svg
      // Framed to the data rather than to the projection: the bases span x
      // 108..837 and y 157..364, so cropping to the full 1200x560 pushed the
      // western pads off screen behind the headline. `meet` keeps all eight in
      // view at every width.
      viewBox="60 100 900 380"
      className={className}
      role="img"
      aria-label="Plan view of the İstanbul operating area with the eight RiverAir bases plotted"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="chart-vignette" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor="#0d1a24" />
          <stop offset="100%" stopColor="#04080c" />
        </radialGradient>
      </defs>

      <rect x={-200} y={-200} width={W + 400} height={H + 400} fill="url(#chart-vignette)" />

      {/* The Bosphorus, running Marmara to Black Sea. The fleet sits on both
          sides of it, which is the whole point of drawing it. */}
      <path
        d={`M ${x(29.0)} ${y(40.97)} C ${x(29.04)} ${y(41.06)}, ${x(29.06)} ${y(41.13)}, ${x(29.13)} ${y(41.24)}`}
        fill="none"
        stroke="var(--color-data)"
        strokeWidth={7}
        strokeOpacity={0.07}
        strokeLinecap="round"
      />
      <path
        d={`M ${x(29.0)} ${y(40.97)} C ${x(29.04)} ${y(41.06)}, ${x(29.06)} ${y(41.13)}, ${x(29.13)} ${y(41.24)}`}
        fill="none"
        stroke="var(--color-data)"
        strokeWidth={1}
        strokeOpacity={0.38}
        strokeDasharray="1 9"
        strokeLinecap="round"
      />

      {/* Route legs, drawing themselves once on load. */}
      {LEGS.map((leg, i) => {
        const a = at(leg.from);
        const b = at(leg.to);
        const length = Math.hypot(b.px - a.px, b.py - a.py);
        return (
          <line
            key={i}
            x1={a.px}
            y1={a.py}
            x2={b.px}
            y2={b.py}
            stroke={leg.tone}
            strokeWidth={2}
            strokeOpacity={0.8}
            className="leg-draw"
            style={
              {
                "--leg-length": length,
                "--leg-delay": `${leg.delay}s`,
              } as React.CSSProperties
            }
          />
        );
      })}

      {/* The bases themselves. */}
      {BASES.map((base) => {
        const px = x(base.lng);
        const py = y(base.lat);
        const tone = TONE[toneKeyFor(base.droneId)] ?? "var(--color-data)";
        return (
          <g key={base.droneId}>
            <circle cx={px} cy={py} r={17} fill={tone} fillOpacity={0.07} />
            <circle
              cx={px}
              cy={py}
              r={7.5}
              fill="none"
              stroke={tone}
              strokeWidth={1.4}
              strokeOpacity={0.85}
            />
            <circle cx={px} cy={py} r={2.4} fill={tone} />
            <text
              x={px + 14}
              y={py + 4}
              fill="var(--color-text-secondary)"
              fontSize={15}
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
              opacity={0.85}
            >
              {code(base.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Fleet ids are laid out two per discipline; this maps one back to its tone. */
function toneKeyFor(droneId: number): string {
  if (droneId === 1 || droneId === 5) return "cargo";
  if (droneId === 2 || droneId === 6) return "agricultural";
  if (droneId === 3 || droneId === 7) return "surveillance";
  return "emergency";
}
