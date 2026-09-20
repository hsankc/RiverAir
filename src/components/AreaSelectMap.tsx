"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Trash2, Maximize2 } from "lucide-react";

interface AreaSelectMapProps {
  onAreaSelect: (bounds: { nw: [number, number]; se: [number, number]; area: number }) => void;
  initialCenter?: [number, number];
}

/**
 * Field area selection map — User draws a rectangle by clicking on the map.
 * First click = corner 1, second click = opposite corner → area is computed.
 */
export default function AreaSelectMap({ onAreaSelect, initialCenter = [28.95, 41.05] }: AreaSelectMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [corner1, setCorner1] = useState<[number, number] | null>(null);
  const [corner2, setCorner2] = useState<[number, number] | null>(null);
  const [isDrawing, setIsDrawing] = useState(true);
  const [areaSize, setAreaSize] = useState<number>(0);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: initialCenter,
      zoom: 13,
      pitch: 0,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Map click — area selection
    map.on("click", (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      setCorner1((prev) => {
        if (!prev) {
          // First corner
          const marker = new maplibregl.Marker({ color: "#14F195" })
            .setLngLat(lngLat)
            .addTo(map);
          markersRef.current.push(marker);
          return lngLat;
        } else {
          // Second corner — draw rectangle
          setCorner2(lngLat);
          setIsDrawing(false);

          const marker = new maplibregl.Marker({ color: "#9945FF" })
            .setLngLat(lngLat)
            .addTo(map);
          markersRef.current.push(marker);

          // Draw rectangle
          const nw: [number, number] = [
            Math.min(prev[0], lngLat[0]),
            Math.max(prev[1], lngLat[1]),
          ];
          const se: [number, number] = [
            Math.max(prev[0], lngLat[0]),
            Math.min(prev[1], lngLat[1]),
          ];

          const polygon: GeoJSON.Feature = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[
                [nw[0], nw[1]],
                [se[0], nw[1]],
                [se[0], se[1]],
                [nw[0], se[1]],
                [nw[0], nw[1]],
              ]],
            },
          };

          // Compute area (approximate — in decares)
          const widthKm = Math.abs(se[0] - nw[0]) * 85; // ~85km per degree lng at this latitude
          const heightKm = Math.abs(nw[1] - se[1]) * 111; // ~111km per degree lat
          const areaHectar = widthKm * heightKm * 100; // km² → hectares
          const areaDonm = areaHectar * 10; // hectares → decares
          setAreaSize(areaDonm);

          // Add polygon to map
          if (map.getSource("area-polygon")) {
            (map.getSource("area-polygon") as maplibregl.GeoJSONSource).setData(polygon);
          } else {
            map.addSource("area-polygon", { type: "geojson", data: polygon });
            map.addLayer({
              id: "area-fill",
              type: "fill",
              source: "area-polygon",
              paint: {
                "fill-color": "#14F195",
                "fill-opacity": 0.15,
              },
            });
            map.addLayer({
              id: "area-border",
              type: "line",
              source: "area-polygon",
              paint: {
                "line-color": "#14F195",
                "line-width": 2,
                "line-dasharray": [3, 2],
              },
            });
          }

          // Callback
          onAreaSelect({ nw, se, area: Math.round(areaDonm) });

          return prev; // corner1 unchanged
        }
      });
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.remove();
    };
  }, []);

  // Reset selected area
  const resetArea = useCallback(() => {
    setCorner1(null);
    setCorner2(null);
    setIsDrawing(true);
    setAreaSize(0);
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (mapRef.current) {
      if (mapRef.current.getLayer("area-fill")) mapRef.current.removeLayer("area-fill");
      if (mapRef.current.getLayer("area-border")) mapRef.current.removeLayer("area-border");
      if (mapRef.current.getSource("area-polygon")) mapRef.current.removeSource("area-polygon");
    }
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-[#34D399] uppercase tracking-widest flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Field Area Selection
        </label>
        {corner2 && (
          <button
            type="button"
            onClick={resetArea}
            className="text-[10px] text-[#F87171] flex items-center gap-1 hover:underline"
          >
            <Trash2 className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-[#1a1a1a]" style={{ height: 200 }}>
        <div ref={mapContainer} className="w-full h-full" />

        {/* Overlay state */}
        {isDrawing && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-[#A1A1AA]">
              {!corner1
                ? "📍 Click the first corner of the field area"
                : "📍 Click the opposite corner to complete the area"}
            </p>
          </div>
        )}

        {/* Area info */}
        {!isDrawing && areaSize > 0 && (
          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Maximize2 className="w-3 h-3 text-[#14F195]" />
            <span className="text-[11px] font-bold text-[#14F195]">
              {areaSize < 10 ? areaSize.toFixed(1) : Math.round(areaSize)} decares
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
