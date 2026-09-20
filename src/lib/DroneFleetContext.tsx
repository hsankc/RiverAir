"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { DroneAgent, Mission } from "./data";
import { useDroneSimulator, useTerminalLogs } from "./hooks/useSimulation";

export interface TerminalLog {
  time: string;
  msg: string;
  type: string;
}

interface FleetContextType {
  drones: DroneAgent[];
  liveMissions: Mission[];
  logs: { time: string; drone: string; level: string; msg: string }[];
  /** False during SSR and the first client render, so callers can show a skeleton. */
  ready: boolean;
  /** Put a mission on the board the fleet reads from. */
  postMission: (mission: Mission) => void;
}

const EMPTY: Omit<FleetContextType, "postMission"> = {
  drones: [],
  liveMissions: [],
  logs: [],
  ready: false,
};

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export function DroneFleetProvider({ children }: { children: ReactNode }) {
  const { drones, liveMissions, postMission } = useDroneSimulator();
  const logs = useTerminalLogs(drones);

  // The simulation seeds itself from Math.random() and new Date(), so the server
  // and the browser produce different fleets and different timestamps. Holding
  // it back until after mount keeps the first client render identical to the
  // server's, which is what hydration actually requires.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value = useMemo<FleetContextType>(
    () =>
      mounted
        ? { drones, liveMissions, logs, ready: true, postMission }
        : { ...EMPTY, postMission },
    [mounted, drones, liveMissions, logs, postMission],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useDroneFleet() {
  const context = useContext(FleetContext);
  if (context === undefined) {
    throw new Error("useDroneFleet must be used within a DroneFleetProvider");
  }
  return context;
}
