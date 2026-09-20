"use client";

import { useState, useEffect } from "react";
import { Wind, Thermometer } from "lucide-react";

export function WeatherWidget() {
  const conditions = ["Clear", "Partly Cloudy", "Windy", "Light Rain"];
  const [weather, setWeather] = useState({ temp: 24, wind: 12, condition: conditions[0] });

  useEffect(() => {
    const iv = setInterval(() => {
      setWeather({
        temp: 20 + Math.round(Math.random() * 10),
        wind: 5 + Math.round(Math.random() * 20),
        condition: conditions[Math.floor(Math.random() * 4)],
      });
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="glass-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Wind className="w-5 h-5 text-accent-cyan" />
        <div>
          <div className="text-sm font-medium">{weather.condition}</div>
          <div className="text-xs text-text-muted">İstanbul</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Thermometer className="w-3.5 h-3.5 text-warning" />
          <span className="tabular-nums">{weather.temp}°C</span>
        </div>
        <div className="flex items-center gap-1">
          <Wind className="w-3.5 h-3.5 text-accent-cyan" />
          <span className="tabular-nums">{weather.wind} km/s</span>
        </div>
      </div>
    </div>
  );
}
