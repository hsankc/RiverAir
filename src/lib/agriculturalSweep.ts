import type { Mission } from "@/lib/data";

/** Lawnmower path inside mission bounds (from → to rectangle). ~5 passes. */
export function buildFieldSweepPath(m: Pick<Mission, "fromLat" | "fromLng" | "toLat" | "toLng">): [number, number][] {
  let minLat = Math.min(m.fromLat, m.toLat);
  let maxLat = Math.max(m.fromLat, m.toLat);
  let minLng = Math.min(m.fromLng, m.toLng);
  let maxLng = Math.max(m.fromLng, m.toLng);
  if (maxLat - minLat < 1e-5) {
    minLat -= 0.0004;
    maxLat += 0.0004;
  }
  if (maxLng - minLng < 1e-5) {
    minLng -= 0.0004;
    maxLng += 0.0004;
  }
  const latSpan = maxLat - minLat;
  const rowCount = 5;
  const path: [number, number][] = [];
  const latDenom = Math.max(1, rowCount - 1);
  for (let i = 0; i < rowCount; i++) {
    const lat = minLat + (i / latDenom) * latSpan;
    const leftToRight = i % 2 === 0;
    if (leftToRight) {
      path.push([lat, minLng], [lat, maxLng]);
    } else {
      path.push([lat, maxLng], [lat, minLng]);
    }
  }
  return path;
}
