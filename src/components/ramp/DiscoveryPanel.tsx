"use client";

import { useEffect, useState } from "react";

interface Discovery {
  homeDomain: string;
  endpoints: Record<string, string | null>;
  signingKey: string;
  currencies: Array<{ code: string; issuer: string }>;
}

const LABELS: Record<string, string> = {
  auth: "SEP-10 auth",
  transfer: "SEP-6 transfer",
  kyc: "SEP-12 KYC",
  quotes: "SEP-38 quotes",
};

/**
 * Proof that the integration is portable rather than hardcoded: every endpoint
 * the app uses was read from the home domain's stellar.toml at runtime. Point
 * the app at a production anchor and this panel fills with its values instead.
 */
export function DiscoveryPanel() {
  const [data, setData] = useState<Discovery | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/anchor/info")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <section className="panel">
      <div className="placard">
        <span>Discovery</span>
        <span className="font-mono normal-case tracking-normal">SEP-1</span>
      </div>

      <div className="p-4">
        <p className="mb-3.5 text-[12px] leading-relaxed text-text-muted">
          The app knows two things about this anchor: a home domain and an asset code.
          Everything below was discovered from its stellar.toml when the page loaded.
        </p>

        {error && (
          <p className="text-[12px] text-warning">
            The anchor&apos;s stellar.toml could not be read. The ramp is unavailable
            until it responds.
          </p>
        )}

        {data && (
          <div className="space-y-2.5">
            <Row label="Home domain" value={data.homeDomain} tone="nav" />

            {Object.entries(data.endpoints).map(([key, value]) =>
              value ? (
                <Row
                  key={key}
                  label={LABELS[key] ?? key}
                  value={value.replace(/^https:\/\//, "")}
                />
              ) : null,
            )}

            {data.currencies.map((c) => (
              <Row
                key={c.issuer}
                label={`${c.code} issuer`}
                value={`${c.issuer.slice(0, 6)}…${c.issuer.slice(-6)}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "nav";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-bezel pb-2 last:border-0 last:pb-0">
      <span className="readout-label shrink-0">{label}</span>
      <code
        className={`truncate font-mono text-[11.5px] ${
          tone === "nav" ? "text-nav" : "text-text-secondary"
        }`}
        title={value}
      >
        {value}
      </code>
    </div>
  );
}
