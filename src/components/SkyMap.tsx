"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DroneAgent, ChargingPod, Mission, AirspaceObstacle, DroneType } from "@/lib/data";
import { buildFieldSweepPath } from "@/lib/agriculturalSweep";
import { definitionFor } from "@/lib/fleet";

/**
 * Lines this thin disappear into a dark basemap. Every leg is drawn twice: a
 * near-black casing first, then the coloured line on top of it. That is what
 * makes a 3 px route readable over both the Bosphorus and the city blocks.
 */
const CASING = "#04070a";

/**
 * Pad names at low zoom, shortened. Every base has a distinct first word, so
 * its first three letters identify it without ambiguity.
 */
function padLabel(name: string, zoom: number) {
  if (zoom >= 10) return name;
  return name.split(" ")[0].slice(0, 3).toUpperCase();
}

interface SkyMapProps {
  drones: DroneAgent[];
  pods: ChargingPod[];
  missions?: Mission[];
  obstacles?: AirspaceObstacle[];
  onDroneClick?: (drone: DroneAgent) => void;
  selectedDroneId?: number;
  filterType?: DroneType | "all"; // Map filters
  showRadar?: boolean;
}

// ═══ ICONS ═══
function droneIconSvg(color: string, heading: number, isSelected: boolean) {
  const glow = isSelected ? `<circle cx="16" cy="16" r="15" fill="none" stroke="${color}" stroke-width="2" opacity="0.6"><animate attributeName="r" values="14;18;14" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite"/></circle>` : '';
  return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${heading}deg)">
    ${glow}
    <circle cx="16" cy="16" r="14" fill="${color}22" stroke="${color}" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="4" fill="${color}"/>
    <path d="M16 4 L18 12 L16 10 L14 12 Z" fill="${color}" opacity="0.9"/>
    <circle cx="16" cy="16" r="8" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}

function podIconSvg(available: boolean) {
  const color = available ? "#FFD600" : "#FF1744";
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="6" fill="${color}22" stroke="${color}" stroke-width="1.5"/>
    <path d="M12 6 L12 12 M9 9 L15 9 M12 12 L12 18" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function getDroneColor(type: string, status: string): string {
  if (status === "emergency") return "#FF1744";
  if (status === "charging") return "#FFD600";
  switch (type) {
    case "cargo": return "#00E5FF";
    case "agricultural": return "#00E676";
    case "surveillance": return "#7C4DFF";
    case "emergency": return "#FF1744";
    default: return "#00E5FF";
  }
}

function getObstacleColor(severity: string) {
  switch (severity) {
    case "high": return "#FF1744"; // Red
    case "medium": return "#F59E0B"; // Orange
    case "low": return "#00E5FF"; // Cyan
    default: return "#94A3B8";
  }
}

// ═══ UTILS ═══
function calcRouteProgress(drone: DroneAgent, mission: Mission): number {
  const totalDist = Math.sqrt(
    Math.pow((mission.toLat - mission.fromLat) * 111, 2) +
    Math.pow((mission.toLng - mission.fromLng) * 85, 2)
  );
  const remaining = Math.sqrt(
    Math.pow((mission.toLat - drone.lat) * 111, 2) +
    Math.pow((mission.toLng - drone.lng) * 85, 2)
  );
  return Math.max(0, Math.min(100, Math.floor((1 - remaining / Math.max(totalDist, 0.1)) * 100)));
}

// ═════════ SKY MAP COMPONENT ═════════
export default function SkyMap({ 
  drones, pods, missions = [], obstacles = [], 
  onDroneClick, selectedDroneId, filterType = "all", showRadar = false 
}: SkyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  const droneMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const podMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const routeLayersRef = useRef<Map<number, L.LayerGroup>>(new Map());
  const obstacleLayersRef = useRef<Map<number, L.LayerGroup>>(new Map());
  const agriculturalScanRef = useRef<Map<number, L.LayerGroup>>(new Map());
  const agScanMissionIdRef = useRef<Map<number, number>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      // Framed to hold every base: Silivri out west at 28.25 through to the
      // eastern pads at 29.13.
      center: [41.06, 28.72],
      zoom: 9,
      zoomControl: true,
      attributionControl: true,
    });

    // CARTO's open basemap now answers with an "API KEY REQUIRED" watermark tile
    // — it still returns 200, so the failure only shows up on screen. Esri's dark
    // canvas is a genuinely dark basemap that needs no key.
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16, attribution: "Esri" },
    ).addTo(map);

    map.attributionControl.setPrefix("");

    mapRef.current = map;

    // Leaflet measures the container once, at construction. This one is a grid
    // cell that has not been laid out yet at that point, so the map cached a
    // size narrower than it ends up being and only ever requested tiles for
    // that slice — which is why the right-hand third of the map stayed black
    // while markers drew over it perfectly happily. Re-measure whenever the
    // cell actually changes size.
    const resize = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
    });
    resize.observe(mapContainerRef.current);

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      droneMarkersRef.current.clear();
      podMarkersRef.current.clear();
      routeLayersRef.current.clear();
      obstacleLayersRef.current.clear();
      agriculturalScanRef.current.clear();
      agScanMissionIdRef.current.clear();
    };
  }, []);

  // Update pods
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    pods.forEach((pod) => {
      if (!podMarkersRef.current.has(pod.id)) {
        const icon = L.divIcon({ html: podIconSvg(pod.available), className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
        const marker = L.marker([pod.lat, pod.lng], { icon }).addTo(map);
        marker.bindPopup(`<b>${pod.name}</b><br/>${pod.totalEnergy} kWh supplied`);
        // Standing label so the launch and landing pads read without a click.
        marker.bindTooltip(padLabel(pod.name, map.getZoom()), {
          permanent: true,
          direction: "right",
          offset: [10, 0],
          className: "pad-label",
        });
        podMarkersRef.current.set(pod.id, marker);
      }
    });

    // Eight pads on one screen means eight standing labels, and the four around
    // the Bosphorus sit close enough that the full names overlap when the whole
    // city is in view. Below zoom 10 they collapse to a three-letter code and
    // expand again as soon as there is room.
    const relabel = () => {
      const zoom = map.getZoom();
      pods.forEach((pod) => {
        podMarkersRef.current.get(pod.id)?.setTooltipContent(padLabel(pod.name, zoom));
      });
    };
    map.on("zoomend", relabel);
    relabel();
    return () => {
      map.off("zoomend", relabel);
    };
  }, [pods]);

  // Update obstacles (Radar Mode)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!showRadar) {
      obstacleLayersRef.current.forEach(layer => layer.remove());
      obstacleLayersRef.current.clear();
      return;
    }

    obstacles.forEach(obs => {
      if (!obstacleLayersRef.current.has(obs.id)) {
        const layerGroup = L.layerGroup().addTo(map);
        const color = getObstacleColor(obs.severity);
        
        // Danger zone circle
        L.circle([obs.lat, obs.lng], {
          radius: obs.radius,
          color: color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 1,
          dashArray: "4, 4"
        }).addTo(layerGroup);

        // Radar pulse animation
        const icon = L.divIcon({
          html: `<svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="${color}" stroke-width="2" opacity="0.8">
              <animate attributeName="r" values="0;20" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="20" cy="20" r="4" fill="${color}"/>
          </svg>`,
          className: "", iconSize: [40, 40], iconAnchor: [20, 20]
        });

        const marker = L.marker([obs.lat, obs.lng], { icon }).addTo(layerGroup);
        marker.bindPopup(`
          <div style="font-family:Inter;background:#1a1d24;padding:10px;border-radius:8px;color:white;border:1px solid ${color}55">
            <strong style="color:${color}">${obs.name}</strong><br/>
            <span style="font-size:11px;color:#9ca3af">${obs.description}</span><br/>
            <span style="font-size:10px;color:#6b7280">İrtifa: ${obs.altitude}-${obs.altitudeMax}m | Yarıçap: ${obs.radius}m</span>
          </div>
        `);

        obstacleLayersRef.current.set(obs.id, layerGroup);
      }
    });

    // Cleanup removed obstacles
    obstacleLayersRef.current.forEach((layer, id) => {
      if (!obstacles.find(o => o.id === id)) {
        layer.remove();
        obstacleLayersRef.current.delete(id);
      }
    });
  }, [obstacles, showRadar]);

  // Update missions (Arcs & Agricultural Scan) & Drone Routes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const activeDrones = drones.filter(d => d.status === "in-flight" || d.status === "mission");

    routeLayersRef.current.forEach((layerGroup, droneId) => {
      if (!activeDrones.find((d) => d.id === droneId)) {
        layerGroup.remove();
        routeLayersRef.current.delete(droneId);
      }
    });

    agriculturalScanRef.current.forEach((layerGroup, droneId) => {
      const drone = drones.find((d) => d.id === droneId);
      if (!drone || drone.type !== "agricultural" || drone.status !== "mission") {
        layerGroup.remove();
        agriculturalScanRef.current.delete(droneId);
        agScanMissionIdRef.current.delete(droneId);
      }
    });

    activeDrones.forEach((drone) => {
      if (filterType !== "all" && drone.type !== filterType) {
        if (routeLayersRef.current.has(drone.id)) {
          routeLayersRef.current.get(drone.id)!.remove();
          routeLayersRef.current.delete(drone.id);
        }
        return;
      }

      // Find REAL mission — both by missionId and by droneId
      const mission = drone.missionId
        ? missions.find(m => m.id === drone.missionId)
        : missions.find(m => m.droneId === drone.id && (m.status === "in-progress" || m.status === "accepted"));

      // ═══ NO MISSION ═══
      // An aircraft with no mission is either flying home or loitering. The
      // journey home is a real leg to a real place, so it gets drawn like one.
      if (!mission) {
        if (drone.status === "in-flight" || drone.status === "mission") {
          if (routeLayersRef.current.has(drone.id)) routeLayersRef.current.get(drone.id)!.remove();
          const layerGroup = L.layerGroup().addTo(map);
          const color = getDroneColor(drone.type, drone.status);
          const focused = selectedDroneId === drone.id;
          const def = definitionFor(drone.id);

          if (def && (drone.phase === "return" || drone.phase === "landing")) {
            const home: [number, number] = [def.base.lat, def.base.lng];
            L.polyline([[drone.lat, drone.lng], home], {
              color: CASING, weight: focused ? 8 : 6, opacity: 0.5,
            }).addTo(layerGroup);
            L.polyline([[drone.lat, drone.lng], home], {
              color, weight: focused ? 4 : 3, opacity: focused ? 0.95 : 0.8,
              dashArray: "10, 6",
            }).addTo(layerGroup).bindTooltip(`${drone.name} · returning to ${def.base.name}`, {
              direction: "top", className: "route-tooltip",
            });
            L.circleMarker(home, {
              radius: focused ? 7 : 5.5, color, fillColor: CASING,
              fillOpacity: 1, weight: 2.5, opacity: focused ? 1 : 0.85,
            }).addTo(layerGroup).bindTooltip(`Home · ${def.base.name}`, {
              direction: "top", className: "route-tooltip",
            });
          } else {
            // Loitering: show where the nose is pointed, nothing more.
            const rad = drone.heading * (Math.PI / 180);
            const toLat = drone.lat + Math.cos(rad) * 0.015;
            const toLng = drone.lng + Math.sin(rad) * 0.015;
            L.polyline([[drone.lat, drone.lng], [toLat, toLng]], {
              color, weight: 2.5, opacity: 0.55, dashArray: "5, 10",
            }).addTo(layerGroup);
          }

          routeLayersRef.current.set(drone.id, layerGroup);
        } else {
          if (routeLayersRef.current.has(drone.id)) {
            routeLayersRef.current.get(drone.id)!.remove();
            routeLayersRef.current.delete(drone.id);
          }
        }
        
        // Ziraat tarama alanını da temizle
        if (agriculturalScanRef.current.has(drone.id)) {
          agriculturalScanRef.current.get(drone.id)!.remove();
          agriculturalScanRef.current.delete(drone.id);
          agScanMissionIdRef.current.delete(drone.id);
        }
        return;
      }

      const toLat = mission.toLat;
      const toLng = mission.toLng;
      const fromLat = mission.fromLat;
      const fromLng = mission.fromLng;
      const color = getDroneColor(drone.type, drone.status);
      const progress = calcRouteProgress(drone, mission);

      // --- AGRICULTURAL FIELD ---
      // The plot is drawn as the rectangle the drone is actually treating, with
      // the lawnmower pattern inside it split into the part already sprayed and
      // the part still to come. Redrawn every tick so the progress is visible.
      if (drone.type === "agricultural" && mission.type === "agricultural") {
        if (agriculturalScanRef.current.has(drone.id)) {
          agriculturalScanRef.current.get(drone.id)!.remove();
        }
        agScanMissionIdRef.current.set(drone.id, mission.id);
        const scanLayer = L.layerGroup().addTo(map);

        const minLat = Math.min(mission.fromLat, mission.toLat);
        const maxLat = Math.max(mission.fromLat, mission.toLat);
        const minLng = Math.min(mission.fromLng, mission.toLng);
        const maxLng = Math.max(mission.fromLng, mission.toLng);
        const bounds: L.LatLngBoundsLiteral = [
          [minLat, minLng],
          [maxLat, maxLng],
        ];

        // The plot boundary.
        L.rectangle(bounds, {
          color, weight: 1.5, fillColor: color, fillOpacity: 0.07, dashArray: "5 5",
        }).addTo(scanLayer);

        const scanPoints = buildFieldSweepPath(mission);

        // Split the pattern at whichever waypoint the drone is nearest.
        let cut = 0;
        let cutDist = Infinity;
        scanPoints.forEach(([wLat, wLng], i) => {
          const dist = Math.hypot(wLat - drone.lat, wLng - drone.lng);
          if (dist < cutDist) { cutDist = dist; cut = i; }
        });

        const treated = scanPoints.slice(0, cut + 1);
        const pending = scanPoints.slice(cut);

        if (pending.length > 1) {
          L.polyline(pending, { color, weight: 1.5, opacity: 0.3, dashArray: "3 6" }).addTo(scanLayer);
        }
        if (treated.length > 1) {
          // Sprayed ground: a heavier line, so coverage reads at a glance.
          L.polyline(treated, { color, weight: 5, opacity: 0.32 }).addTo(scanLayer);
          L.polyline(treated, { color, weight: 1.5, opacity: 0.9 }).addTo(scanLayer);
        }

        const covered = Math.round((cut / Math.max(1, scanPoints.length - 1)) * 100);
        const sideM = Math.round((maxLat - minLat) * 111000);
        const widthM = Math.round((maxLng - minLng) * 84000);
        L.rectangle(bounds, { color, weight: 0, fillOpacity: 0 })
          .addTo(scanLayer)
          .bindTooltip(
            `${mission.title} · ${sideM}\u00d7${widthM} m · ${covered}% treated`,
            { direction: "top", className: "route-tooltip" },
          );

        agriculturalScanRef.current.set(drone.id, scanLayer);
      } else if (agriculturalScanRef.current.has(drone.id)) {
        agriculturalScanRef.current.get(drone.id)!.remove();
        agriculturalScanRef.current.delete(drone.id);
        agScanMissionIdRef.current.delete(drone.id);
      }

      // --- ROUTE ---
      // Drones fly straight legs, so the route is drawn as straight legs: home
      // pad → pickup → drop-off. The leg the aircraft is actually on is drawn
      // solid and full strength; the rest of the plan sits behind it, dashed
      // and dimmer but still plainly readable. Selecting an aircraft thickens
      // its route rather than being the only way to see it.
      if (routeLayersRef.current.has(drone.id)) routeLayersRef.current.get(drone.id)!.remove();
      const layerGroup = L.layerGroup().addTo(map);

      const inbound = drone.phase === "takeoff" || drone.phase === "cruise";
      const legTo: [number, number] = inbound ? [fromLat, fromLng] : [toLat, toLng];
      const focused = selectedDroneId === drone.id;
      const def = definitionFor(drone.id);

      /** Casing underneath, colour on top — see CASING. */
      const leg = (
        pts: [number, number][],
        opts: { weight: number; opacity: number; dash?: string },
      ) => {
        L.polyline(pts, {
          color: CASING, weight: opts.weight + 3.5, opacity: 0.5,
        }).addTo(layerGroup);
        return L.polyline(pts, {
          color, weight: opts.weight, opacity: opts.opacity, dashArray: opts.dash,
        }).addTo(layerGroup);
      };

      // Where it came from. Thin, so it reads as history rather than plan.
      if (def && inbound) {
        leg([[def.base.lat, def.base.lng], [fromLat, fromLng]], {
          weight: focused ? 2 : 1.6, opacity: focused ? 0.45 : 0.3, dash: "2, 7",
        });
      }

      // The leg it is flying right now.
      leg([[drone.lat, drone.lng], legTo], {
        weight: focused ? 5 : 3.5,
        opacity: focused ? 1 : 0.88,
      }).bindTooltip(
        `${drone.name} · ${inbound ? "inbound to pick-up" : "carrying"} · ${mission.title}`,
        { direction: "top", className: "route-tooltip" },
      );

      // The part of the job still ahead of it.
      if (inbound) {
        leg([[fromLat, fromLng], [toLat, toLng]], {
          weight: focused ? 3.5 : 2.6,
          opacity: focused ? 0.8 : 0.58,
          dash: "9, 7",
        });
      }

      // Pickup: hollow. Drop-off: filled. Both labelled with the job.
      L.circleMarker([fromLat, fromLng], {
        radius: focused ? 7 : 5.5, color, fillColor: CASING,
        fillOpacity: 1, weight: 2.5, opacity: focused ? 1 : 0.9,
      }).addTo(layerGroup).bindTooltip(`Pick up · ${mission.title}`, { direction: "top", className: "route-tooltip" });

      L.circleMarker([toLat, toLng], {
        radius: focused ? 8 : 6.5, color, fillColor: color,
        fillOpacity: focused ? 0.95 : 0.8, weight: 2.5, opacity: 1,
      }).addTo(layerGroup).bindTooltip(`Drop off · ${mission.title}`, { direction: "top", className: "route-tooltip" });

      if (focused && !inbound && progress > 5 && progress < 95) {
        const midLat = (drone.lat + toLat) / 2;
        const midLng = (drone.lng + toLng) / 2;
        const progressIcon = L.divIcon({
          html: `<div style="background:rgba(12,17,22,0.88);border:1px solid ${color}55;padding:2px 7px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:${color};">${progress}%</div>`,
          className: "", iconSize: [54, 18], iconAnchor: [27, 9],
        });
        L.marker([midLat, midLng], { icon: progressIcon, interactive: false }).addTo(layerGroup);
      }

      routeLayersRef.current.set(drone.id, layerGroup);
    });
  }, [drones, missions, filterType, selectedDroneId]);

  // Update drone markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    drones.forEach((drone) => {
      // Filter logic
      if (filterType !== "all" && drone.type !== filterType) {
        if (droneMarkersRef.current.has(drone.id)) {
          droneMarkersRef.current.get(drone.id)!.remove();
          droneMarkersRef.current.delete(drone.id);
        }
        return;
      }

      const color = getDroneColor(drone.type, drone.status);
      const isSelected = drone.id === selectedDroneId;
      const icon = L.divIcon({
        html: droneIconSvg(color, drone.heading, isSelected),
        className: "", iconSize: [32, 32], iconAnchor: [16, 16],
      });

      if (droneMarkersRef.current.has(drone.id)) {
        const marker = droneMarkersRef.current.get(drone.id)!;
        marker.setLatLng([drone.lat, drone.lng]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([drone.lat, drone.lng], { icon }).addTo(map);
        marker.on("click", () => onDroneClick?.(drone));
        droneMarkersRef.current.set(drone.id, marker);
      }

      // Evade/Obstacle Warning System integration for Popup
      const marker = droneMarkersRef.current.get(drone.id)!;
      marker.unbindPopup();
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;color:#F8FAFC;background:rgba(18,23,34,0.9);padding:14px;border-radius:12px;min-width:200px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 32px rgba(0,0,0,0.5);backdrop-filter:blur(16px)">
          <div style="font-weight:700;margin-bottom:8px;color:${color};font-size:14px;letter-spacing:0.5px;display:flex;align-items:center;gap:6px">🛸 ${drone.name}</div>
          <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">Tür: <span style="color:#F8FAFC;text-transform:capitalize">${drone.type}</span></div>
          <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">Batarya: <span style="color:${drone.battery < 20 ? "#EF4444" : drone.battery < 50 ? "#F59E0B" : "#10B981"};font-weight:700">%${drone.battery.toFixed(0)}</span></div>
          <div style="font-size:12px;color:#94A3B8;margin-bottom:4px">İrtifa: <span style="color:#F8FAFC">${drone.altitude}m</span> <span style="opacity:0.5">|</span> Hız: <span style="color:#F8FAFC">${drone.speed}km/s</span></div>
        </div>`
      );
    });

    // Remove drones not matching filter
    droneMarkersRef.current.forEach((marker, id) => {
      if (!drones.find(d => d.id === id) || (filterType !== "all" && drones.find(d => d.id === id)?.type !== filterType)) {
        marker.remove();
        droneMarkersRef.current.delete(id);
      }
    });
  }, [drones, onDroneClick, selectedDroneId, filterType]);

  // Handle selected drone flyTo
  useEffect(() => {
    if (!mapRef.current || !selectedDroneId) return;
    const drone = drones.find((d) => d.id === selectedDroneId);
    if (drone) {
      mapRef.current.flyTo([drone.lat, drone.lng], 14, { animate: true, duration: 1.5 });
    }
  }, [selectedDroneId, drones]);

  return <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 400 }} />;
}
