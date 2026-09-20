"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RotateCcw } from "lucide-react";

export interface Point {
  lat: number;
  lng: number;
}

interface Props {
  from: Point;
  to: Point;
  onChange: (next: { from: Point; to: Point }) => void;
}

const PICKUP = "#45d4f0";
const DROPOFF = "#ffb627";

/**
 * Two-point route picker for posting work.
 *
 * The first click drops the pickup, the second the drop off, and it alternates
 * from there. Both pins drag, so a rough click followed by a nudge beats typing
 * six decimal places twice — and the customer picking the job is choosing a
 * place on a map, not entering a coordinate pair.
 */
export default function PointSelectMap({ from, to, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fromMarker = useRef<maplibregl.Marker | null>(null);
  const toMarker = useRef<maplibregl.Marker | null>(null);

  /** Which pin the next click moves. Held in a ref so the map's own listener
   *  reads the current value rather than the one it closed over. */
  const nextRef = useRef<"from" | "to">("from");
  const [next, setNext] = useState<"from" | "to">("from");

  /** Latest props, for the same reason. */
  const propsRef = useRef({ from, to, onChange });
  useEffect(() => {
    propsRef.current = { from, to, onChange };
  }, [from, to, onChange]);

  const drawLine = useCallback((map: maplibregl.Map, a: Point, b: Point) => {
    const line: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [a.lng, a.lat],
          [b.lng, b.lat],
        ],
      },
    };

    const existing = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(line);
      return;
    }

    map.addSource("route", { type: "geojson", data: line });
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": PICKUP,
        "line-width": 1.5,
        "line-dasharray": [2, 2],
        "line-opacity": 0.65,
      },
    });
  }, []);

  // Mount once. Prop changes are handled by the sync effect below; rebuilding
  // the map on every keystroke would throw the viewport away each time.
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const { from: f0, to: t0 } = propsRef.current;
    const map = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [(f0.lng + t0.lng) / 2, (f0.lat + t0.lat) / 2],
      zoom: 10.5,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    /** Read both pins back off the map and report them up. */
    const commit = () => {
      if (!fromMarker.current || !toMarker.current) return;
      const f = fromMarker.current.getLngLat();
      const t = toMarker.current.getLngLat();
      const value = {
        from: { lat: f.lat, lng: f.lng },
        to: { lat: t.lat, lng: t.lng },
      };
      if (map.isStyleLoaded()) drawLine(map, value.from, value.to);
      propsRef.current.onChange(value);
    };

    fromMarker.current = new maplibregl.Marker({ color: PICKUP, draggable: true })
      .setLngLat([f0.lng, f0.lat])
      .addTo(map)
      .on("dragend", commit);

    toMarker.current = new maplibregl.Marker({ color: DROPOFF, draggable: true })
      .setLngLat([t0.lng, t0.lat])
      .addTo(map)
      .on("dragend", commit);

    map.on("load", () => drawLine(map, propsRef.current.from, propsRef.current.to));

    map.on("click", (e) => {
      const pin = nextRef.current === "from" ? fromMarker.current : toMarker.current;
      pin?.setLngLat(e.lngLat);
      nextRef.current = nextRef.current === "from" ? "to" : "from";
      setNext(nextRef.current);
      commit();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      fromMarker.current = null;
      toMarker.current = null;
    };
  }, [drawLine]);

  /** Keep the pins in step when something outside the map moves the values. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fromMarker.current || !toMarker.current) return;
    fromMarker.current.setLngLat([from.lng, from.lat]);
    toMarker.current.setLngLat([to.lng, to.lat]);
    if (map.isStyleLoaded()) drawLine(map, from, to);
  }, [from, to, drawLine]);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="readout-label">Route</span>
        <button
          type="button"
          onClick={() => {
            nextRef.current = "from";
            setNext("from");
          }}
          className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text-secondary"
        >
          <RotateCcw className="h-3 w-3" /> Pickup next
        </button>
      </div>

      <div ref={container} className="h-[190px] w-full cursor-crosshair border border-bezel" />

      <div className="mt-1.5 grid grid-cols-2 gap-2.5 font-mono text-[11px]">
        <p className={next === "from" ? "text-data" : "text-text-muted"}>
          <span
            className="mr-1.5 inline-block h-2 w-2 align-middle"
            style={{ background: PICKUP }}
          />
          {from.lat.toFixed(4)}, {from.lng.toFixed(4)}
        </p>
        <p className={next === "to" ? "text-nav" : "text-text-muted"}>
          <span
            className="mr-1.5 inline-block h-2 w-2 align-middle"
            style={{ background: DROPOFF }}
          />
          {to.lat.toFixed(4)}, {to.lng.toFixed(4)}
        </p>
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
        Click to drop the {next === "from" ? "pickup" : "drop off"} pin, or drag either one.
      </p>
    </div>
  );
}
