"use client";

import { useState, useEffect, useRef } from "react";
import { Radio, Send, Loader2 } from "lucide-react";
import { DroneAgent, initialMissions } from "@/lib/data";

export function DroneChat({ drone }: { drone: DroneAgent }) {
  const [messages, setMessages] = useState<{ role: "user" | "drone"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setMessages([{
      role: "drone",
      text: `Hello, I am ${drone.name}. ${drone.personality}. You can ask me questions or send commands.`
    }]);
  }, [drone.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);

    try {
      const mission = initialMissions.find(m => m.id === drone.missionId);
      const res = await fetch("/api/ai-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          droneContext: {
            id: drone.id, name: drone.name, type: drone.type,
            status: drone.status, battery: drone.battery,
            altitude: drone.altitude, speed: drone.speed,
            lat: drone.lat, lng: drone.lng, heading: drone.heading,
            reputation: drone.reputation, specs: drone.specs,
            mission: mission ? { title: mission.title, type: mission.type, payment: mission.payment, progress: "active" } : null,
            personality: drone.personality,
          },
        }),
      });
      const data = await res.json();
      const response = data.parsed?.explanation || data.error || "Command processed.";

      if (data.success && data.parsed && data.parsed.action !== "droneChat") {
        const parsed = { ...data.parsed, params: { ...data.parsed.params, droneId: drone.id } };
        window.dispatchEvent(new CustomEvent("ai-command", { detail: parsed }));
      }

      setMessages(prev => [...prev, { role: "drone", text: response }]);
    } catch {
      setMessages(prev => [...prev, { role: "drone", text: `Connection issue. Command queued, please retry.` }]);
    }
    setLoading(false);
  };

  return (
    <div className="bg-bg-tertiary/60 rounded-sm overflow-hidden flex flex-col" style={{ height: 220 }}>
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
        <Radio className="w-3.5 h-3.5 text-accent-cyan" />
        <span className="text-xs font-semibold text-accent-cyan">{drone.name}</span>
        <span className="text-[10px] text-text-muted">Chat</span>
        <span className="ml-auto text-[10px] text-success flex items-center gap-1">
          <span className="status-dot status-active" /> connected
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-sm px-3 py-2 text-[11px] leading-relaxed ${
              m.role === "user"
                ? "bg-accent-cyan/10 text-text-primary border border-accent-cyan/20"
                : "bg-white/[0.04] border border-white/[0.06] text-text-secondary"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-[11px] text-accent-cyan flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> {drone.name} is thinking...
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Ask ${drone.name}...`}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-sm px-3 py-1.5 text-[11px] focus:outline-none focus:border-accent-cyan/50"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-7 h-7 rounded-sm bg-accent-cyan/15 flex items-center justify-center disabled:opacity-30 hover:bg-accent-cyan/25 transition-colors"
          >
            <Send className="w-3 h-3 text-accent-cyan" />
          </button>
        </div>
      </div>
    </div>
  );
}
