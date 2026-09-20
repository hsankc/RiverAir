"use client";

import { useState, useRef, useEffect } from "react";
import {
  Brain,
  Send,
  Mic,
  Loader2,
  Zap,
  Crosshair,
  Package,
  Radio,
  X,
  ChevronUp,
} from "lucide-react";
import type { ParsedCommand } from "@/lib/ai/dispatcher";
import { randomTxHash, initialDrones } from "@/lib/data";

// Find drone names in text and make them clickable
const DRONE_NAMES = initialDrones.map(d => d.name);

function renderWithDroneLinks(text: string) {
  // Find drone names with regex
  const pattern = new RegExp(`(${DRONE_NAMES.join("|")})`, "g");
  const parts = text.split(pattern);
  
  return parts.map((part, i) => {
    const drone = initialDrones.find(d => d.name === part);
    if (drone) {
      return (
        <button
          key={i}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("select-drone", { detail: { droneId: drone.id } })
            );
          }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-cyan/20 text-accent-cyan font-semibold hover:bg-accent-cyan/30 transition-colors cursor-pointer border border-accent-cyan/30 hover:border-accent-cyan/50 mx-0.5"
        >
          🛸 {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  parsed?: ParsedCommand;
  txHash?: string;
  timestamp: Date;
}

const exampleCommands = [
  "Send the nearest drone to Beşiktaş",
  "How many drones are charging?",
  "Deploy 2 drones to fire zone",
  "Launch Kadikoy-01",
  "Show fleet battery status",
];

function actionIcon(action: string) {
  switch (action) {
    case "createMission": return Package;
    case "sendCommand": return Crosshair;
    case "deploySwarm": return Radio;
    default: return Brain;
  }
}

function actionLabel(action: string) {
  switch (action) {
    case "createMission": return "Create Mission";
    case "selectDrone": return "Select Agent";
    case "sendCommand": return "Send Command";
    case "queryStatus": return "Status Check";
    case "deploySwarm": return "Deploy Swarm";
    case "chargeDrone": return "Charge Agent";
    default: return action;
  }
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "RiverAir dispatcher online. Ask about the fleet, or name a drone and a destination.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();

      if (data.success && data.parsed) {
        // Dispatch event for other components to react (like useDroneSimulator)
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ai-command", { detail: data.parsed })
          );
        }

        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: data.parsed.explanation || "Command processed successfully.",
          parsed: data.parsed,
          txHash: randomTxHash(),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "system",
            content: data.error || "I couldn't process this request.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: "System offline. Please try again later.",
          timestamp: new Date(),
        },
      ]);
    }

    setLoading(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg hover:scale-110 transition-transform animate-drone-blip"
      >
        <Brain className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[400px] max-w-[calc(100vw-2rem)] flex flex-col bg-[#0f111a]/95 backdrop-blur-2xl border border-white/10 !rounded-2xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] animate-fade-in-up"
      style={{ height: 520 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-accent-cyan/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide">AI Dispatcher</div>
            <div className="text-xs text-success flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Active
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-text-muted hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-0 bg-gradient-to-b from-transparent to-black/20">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-accent-cyan/80 to-accent-blue/80 text-white rounded-br-sm shadow-accent-cyan/20 border border-white/10"
                  : msg.role === "ai"
                  ? "bg-[#1e2235] text-white rounded-bl-sm border border-white/5"
                  : "bg-accent-violet/20 border border-accent-violet/30 text-white rounded-bl-sm shadow-accent-violet/10"
              }`}
            >
              <div className={msg.role === "system" ? "text-accent-violet-light font-medium" : ""}>
                {msg.role === "ai" ? renderWithDroneLinks(msg.content) : msg.content}
              </div>

              {msg.parsed && (
                <div className="mt-3 space-y-2 bg-black/30 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = actionIcon(msg.parsed.action);
                      return <Icon className="w-4 h-4 text-accent-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]" />;
                    })()}
                    <span className="text-xs font-semibold text-accent-cyan tracking-wide uppercase">
                      {actionLabel(msg.parsed.action)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-success/20 text-success font-bold border border-success/20 ml-auto">
                      %{Math.round((msg.parsed.confidence || 0.8) * 100)}
                    </span>
                  </div>
                  {msg.parsed.params && Object.keys(msg.parsed.params).length > 0 && (
                    <div className="text-[11px] font-mono text-text-secondary">
                      {JSON.stringify(msg.parsed.params, null, 1)}
                    </div>
                  )}
                </div>
              )}

              {msg.txHash && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-success font-mono bg-success/10 px-2 py-1 rounded-md border border-success/20 inline-flex">
                  <Zap className="w-3 h-3 text-success fill-success" />
                  TX: {msg.txHash}
                </div>
              )}

              <div className={`text-[10px] mt-2 flex items-center gap-1 ${msg.role === "user" ? "text-white/70 justify-end" : "text-text-muted"}`}>
                {msg.timestamp.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-accent-cyan text-sm font-medium bg-accent-cyan/10 px-4 py-2.5 rounded-xl w-max border border-accent-cyan/20">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning neural network...
          </div>
        )}
      </div>

      {/* Example chips */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {exampleCommands.slice(0, 3).map((cmd) => (
            <button
              key={cmd}
              onClick={() => { setInput(cmd); }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-border text-text-secondary hover:border-accent-cyan hover:text-accent-cyan transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Send a command to the fleet (e.g. 'Launch Belgrad-02')"
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-accent-cyan transition-colors"
              disabled={loading}
            />
            <Mic className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          </div>
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
