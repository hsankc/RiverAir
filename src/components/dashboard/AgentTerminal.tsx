"use client";

import { useEffect, useRef } from "react";
import { Radio } from "lucide-react";
import { logLevelColor } from "./utils";

export function AgentTerminal({
  logs,
}: {
  logs: { time: string; drone: string; level: string; msg: string }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal h-full flex flex-col">
      <div className="terminal-header">
        <div className="terminal-dot bg-danger" />
        <div className="terminal-dot bg-warning" />
        <div className="terminal-dot bg-success" />
        <span className="text-xs text-text-muted ml-2">agent_terminal.log</span>
        <span className="ml-auto text-xs text-success animate-glow-pulse flex items-center gap-1">
          <Radio className="w-3 h-3" /> LIVE
        </span>
      </div>
      <div ref={scrollRef} className="terminal-body flex-1 overflow-y-auto no-scrollbar relative min-h-0">
        <div className="terminal-scanline" />
        <div className="space-y-1.5">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              <span className="text-text-muted shrink-0">[{log.time}]</span>
              <span className="text-accent-cyan shrink-0">{log.drone}</span>
              <span className="text-text-muted">→</span>
              <span className={logLevelColor(log.level)}>{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
