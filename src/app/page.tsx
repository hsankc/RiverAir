"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useReveal } from "@/lib/hooks/useReveal";
import { BrandLockup } from "@/components/BrandLockup";
import { OperatingAreaChart } from "@/components/OperatingAreaChart";
import { ANCHOR, MISSION_ESCROW_ID, explorerContract } from "@/lib/stellar/config";
import { FLEET } from "@/lib/fleet";

/* The four discipline colours, reused by every block below. */
const GOLD = "#ffb627";
const CYAN = "#45d4f0";
const GREEN = "#2fe08a";
const RED = "#ff5a5a";

export default function LandingPage() {
  useReveal();

  return (
    <div className="min-h-screen bg-panel-base">
      <Header />
      <main>
        <Hero />
        <MoneyFlow />
        <OracleGuard />
        <Disciplines />
        <Fleet />
        <PhysicalWorld />
        <UnderTheHood />
        <Foundations />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-bezel bg-panel-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">
        <BrandLockup size={30} priority />
        <nav className="ml-auto flex items-center gap-2">
          <Link
            href="/ramp"
            className="btn-secondary hidden whitespace-nowrap !py-1.5 text-[13px] sm:inline-block"
          >
            Cash in and out
          </Link>
          <Link
            href="/dashboard"
            className="btn-primary whitespace-nowrap !py-1.5 text-[13px]"
          >
            Open the console
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-bezel">
      {/* The operating area sits behind the headline rather than beside it, so
          the first thing on the page is the thing the product is about. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <OperatingAreaChart className="h-full w-full opacity-90" />
        {/* Enough scrim to hold the headline, and no more: the chart is the
            point of the hero, not a texture behind it. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--color-panel-base)_6%,rgba(7,13,19,0.9)_34%,rgba(7,13,19,0.15)_88%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-14 md:pt-20">
        <h1 className="display landing-in max-w-[13ch] text-text-primary">
          Autonomous Drone Network.
        </h1>

        <p className="landing-in landing-in-d1 mt-7 max-w-[52ch] text-[15.5px] leading-relaxed text-text-secondary">
          Turkey builds some of the best drones in the world and puts almost none of
          them to everyday work. RiverAir is the layer that was missing — an agentic
          network where fleets are dispatched, priced and paid the moment the job is
          done. Crop spraying, cargo, patrol, fire watch. Booked in lira, settled on
          Stellar. The country that builds the aircraft should be the one that puts
          them to work.
        </p>

        {/* The console is what the whole page is arguing for, so it gets the
            weight. The ramp keeps a quiet link: it matters, but only after
            somebody has decided to look. */}
        <div className="landing-in landing-in-d2 mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="btn-primary btn-lg inline-flex items-center gap-2"
          >
            Open the console
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
          <Link href="/marketplace" className="btn-secondary btn-lg">
            See the mission board
          </Link>
          <Link
            href="/ramp"
            className="ml-1 text-[14px] font-medium text-text-secondary underline decoration-bezel-lit underline-offset-[5px] transition-colors hover:text-nav"
          >
            Move some lira
          </Link>
        </div>
      </div>

      <LiveStrip />
    </section>
  );
}

/**
 * Real numbers, fetched on load. The rate is the anchor's live SEP-38 quote and
 * the feed reading comes from Reflector through the escrow — if either is
 * unhealthy the strip says so rather than showing a comfortable placeholder.
 */
function LiveStrip() {
  const [rate, setRate] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/anchor/price?try=1000")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { rate: string }) => live && setRate(d.rate))
        .catch(() => live && setFailed(true));

    void load();
    const id = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="landing-in landing-in-d3 mx-auto max-w-6xl px-5 pb-14">
      <dl className="grid grid-cols-2 gap-px border border-bezel bg-bezel md:grid-cols-4">
        <Figure
          label="One USDC buys"
          value={rate ? Number(rate).toFixed(4) : failed ? "no answer" : "\u00b7\u00b7\u00b7\u00b7"}
          unit={rate ? "TRY" : undefined}
          note={failed ? "The anchor is not responding" : "Live SEP-38 quote"}
          tone="data"
        />
        <Figure
          label="Settlement guard"
          value="Reflector"
          note="Read inside complete(), not beside it"
          tone="engaged"
        />
        <Figure label="Aircraft flying" value="8" note="Two in each discipline" tone="nav" />
        <Figure
          label="Escrow"
          value={MISSION_ESCROW_ID ? "Deployed" : "Not set"}
          note={MISSION_ESCROW_ID ? "Stellar testnet" : "Set NEXT_PUBLIC_MISSION_ESCROW_ID"}
          tone="data"
          href={MISSION_ESCROW_ID ? explorerContract(MISSION_ESCROW_ID) : undefined}
        />
      </dl>
    </div>
  );
}

function Figure({
  label,
  value,
  unit,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone: "data" | "engaged" | "nav";
  href?: string;
}) {
  const colour = { data: "text-data", engaged: "text-engaged", nav: "text-nav" }[tone];
  const body = (
    <div className="h-full bg-panel-raised px-4 py-4 transition-colors hover:bg-panel-high">
      <dt className="readout-label">{label}</dt>
      <dd className={`figure-lg mt-2.5 ${colour}`}>
        {value}
        {unit && <span className="ml-1.5 font-condensed text-sm text-text-muted">{unit}</span>}
      </dd>
      <p className="mt-2.5 text-[11.5px] leading-snug text-text-muted">{note}</p>
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {body}
    </a>
  ) : (
    body
  );
}

/* --------------------------------------------------------------- the flow */

const STEPS = [
  {
    title: "Lira leaves a bank account",
    body: "The customer signs in with their Stellar key — no password, no account to create — and the anchor returns an IBAN and a reference. A normal bank transfer does the rest.",
    tag: "SEP-10, SEP-6",
  },
  {
    title: "USDC lands in their wallet",
    body: "The anchor converts at a rate it holds firm for the transfer and pays real testnet USDC out to the customer's own account. They custody it, not us.",
    tag: "SEP-38",
  },
  {
    title: "The mission price is locked away",
    body: "Posting a job moves that USDC into the escrow contract. The lira figure and the rate it was struck at are both recorded on chain, so the payout can be checked against what the customer agreed to.",
    tag: "Soroban",
  },
  {
    title: "An operator claims it and flies",
    body: "Operators take work themselves; the contract records the key that signed for it. Nobody can settle the mission except that operator.",
    tag: "Soroban",
  },
  {
    title: "Settlement, if the oracle allows it",
    body: "On completion the contract reads Reflector before moving anything. A healthy feed releases the USDC to the operator. An unhealthy one leaves it locked.",
    tag: "Reflector",
  },
  {
    title: "Back to lira",
    body: "The operator sends USDC to the anchor's treasury with the memo it issued, and the lira arrives in their account over FAST.",
    tag: "SEP-6",
  },
];

/** Fiat in is gold, the chain is cyan, settlement is green. */
const FLOW_ACCENT = [GOLD, GOLD, CYAN, CYAN, GREEN, GREEN];

function MoneyFlow() {
  return (
    <section className="border-b border-bezel">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          num="01"
          label="Money"
          title={
            <>
              Where the money <Lit>actually goes</Lit>
            </>
          }
          lede="Six steps, in order, every one of them a real call against a real network. The only thing simulated on testnet is the bank itself."
        />

        <ol className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className={stagger(i)}>
              <GlowCard accent={FLOW_ACCENT[i]} className="h-full">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge accent={FLOW_ACCENT[i]}>{String(i + 1).padStart(2, "0")}</Badge>
                  <span className="font-mono text-[10.5px] text-text-muted">{step.tag}</span>
                </div>
                <h3 className="font-condensed text-[17px] font-semibold text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  {step.body}
                </p>
              </GlowCard>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ oracle guard */

function OracleGuard() {
  return (
    <section className="border-b border-bezel bg-panel-void">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-2">
        <div className="reveal">
          <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-bezel bg-panel-raised px-3 py-1">
            <span className="readout text-[11px] text-nav">02</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Settlement guard
            </span>
          </div>
          <h2 className="max-w-[22ch] font-condensed text-3xl font-semibold leading-[1.12] text-text-primary sm:text-[40px]">
            The contract is <Lit>allowed to say no</Lit>
          </h2>
          <p className="mt-4 max-w-[58ch] text-[14px] leading-relaxed text-text-secondary">
            A mission is agreed in lira but settled in USDC, so the escrow is exposed to
            the thing every stablecoin payout is exposed to: the rate being wrong at the
            moment it pays. Most demos ignore this. This one reads a price feed inside the
            settlement call and refuses to move money when it does not like the answer.
          </p>
          <p className="mt-4 max-w-[58ch] text-[14px] leading-relaxed text-text-secondary">
            Both refusals leave the funds where they are. Nothing is lost, and the mission
            settles later once the feed recovers — which is the behaviour you want from
            something holding somebody else&apos;s money.
          </p>
        </div>

        <div className="panel reveal reveal-d2 self-start">
          <div className="placard">
            <span>Settlement guard</span>
            <span className="font-mono normal-case tracking-normal">mission-escrow</span>
          </div>
          <div className="divide-y divide-bezel">
            <Refusal
              code="StalePrice"
              when="The newest price is older than 15 minutes"
              why="The feed publishes every 5 minutes. Three missed rounds means nobody knows what USDC is worth right now."
            />
            <Refusal
              code="Depegged"
              when="USDC has moved more than 2% off the dollar"
              why="The lira figure was struck against a dollar-pegged asset. If the peg has slipped, the payout no longer matches what was agreed."
            />
            <Refusal
              code="NoPrice"
              when="The feed has no reading for the asset at all"
              why="An oracle that returns nothing is not a reason to guess."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Refusal({ code, when, why }: { code: string; when: string; why: string }) {
  return (
    <div className="p-4">
      <div className="flex items-baseline gap-2.5">
        <span className="status-dot status-emergency" />
        <code className="font-mono text-[13px] text-warning">{code}</code>
      </div>
      <p className="mt-2 text-[13px] font-medium text-text-primary">{when}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{why}</p>
    </div>
  );
}

/* -------------------------------------------------------------- the facts */

/* ------------------------------------------------------ shared furniture */

/**
 * The numbered eyebrow, headline and lede every block below shares. Keeping
 * them in one component is what stops the sections drifting apart as they get
 * edited one at a time.
 */
function SectionHead({
  num,
  label,
  title,
  lede,
}: {
  num: string;
  label: string;
  title: ReactNode;
  lede: string;
}) {
  return (
    <div className="reveal">
      <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-bezel bg-panel-raised px-3 py-1">
        <span className="readout text-[11px] text-nav">{num}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {label}
        </span>
      </div>
      <h2 className="max-w-[26ch] font-condensed text-3xl font-semibold leading-[1.12] text-text-primary sm:text-[40px]">
        {title}
      </h2>
      <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-text-secondary">
        {lede}
      </p>
    </div>
  );
}

/** A phrase inside a headline, washed with the fleet's own colours. */
function Lit({ children }: { children: ReactNode }) {
  return (
    <span className="bg-[linear-gradient(100deg,var(--color-nav),var(--color-data)_52%,var(--color-engaged))] bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/** A card carrying a faint wash of whatever it is about. */
function GlowCard({
  accent,
  className,
  children,
}: {
  accent: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-bezel bg-panel-raised p-5 transition duration-300 hover:-translate-y-0.5 hover:border-bezel-lit ${className ?? ""}`}
      style={{
        backgroundImage: `radial-gradient(130% 110% at 0% 0%, ${accent}14 0%, transparent 58%)`,
      }}
    >
      {children}
    </div>
  );
}

/** The square that carries a step number, a callsign or a letter. */
function Badge({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <span
      className="readout flex h-9 shrink-0 items-center justify-center rounded-lg px-2.5 text-[12.5px]"
      style={{
        background: `${accent}1f`,
        color: accent,
        boxShadow: `inset 0 0 0 1px ${accent}33`,
      }}
    >
      {children}
    </span>
  );
}

/** Six delay classes, so a grid arrives as a sequence rather than a block. */
function stagger(i: number): string {
  return `reveal reveal-d${(i % 6) + 1}`;
}

/* ---------------------------------------------------------- disciplines */

const DISCIPLINES = [
  {
    letter: "A",
    kicker: "Agricultural",
    name: "Sprayer",
    tag: "2–6 m",
    accent: GREEN,
    body: "Arrives over a marked plot and flies a lawnmower pattern across it on its own, descending as it works and opening the pump only inside the envelope it is authorised for. The flow meter counts the litres actually dispensed, and that count is what the invoice is built from.",
  },
  {
    letter: "B",
    kicker: "Cargo",
    name: "Courier",
    tag: "70–105 m",
    accent: GOLD,
    body: "Collects a parcel at one address and puts it down at another, above the rooftops and below the helicopter lanes. A load cell confirms the parcel actually left, so a delivery is a measurement rather than a claim.",
  },
  {
    letter: "C",
    kicker: "Surveillance",
    name: "Observer",
    tag: "95–118 m",
    accent: CYAN,
    body: "Holds an orbit over a junction for the length of the survey, counting flow and queue length on board rather than shipping video home. What leaves the aircraft is a number, not a picture of the street below it.",
  },
  {
    letter: "D",
    kicker: "Emergency",
    name: "Responder",
    tag: "90–118 m",
    accent: RED,
    body: "Launches on an alert, runs direct to the coordinates and holds a close thermal picture over the seat of the fire until ground crews have it. The hotspot detection runs on the aircraft, not in a datacentre.",
  },
];

function Disciplines() {
  return (
    <section className="border-b border-bezel">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          num="03"
          label="Fleet behaviour"
          title={
            <>
              Four jobs, <Lit>four different aircraft</Lit>
            </>
          }
          lede="The work itself is autonomous, not just the routing. Each airframe decides which behaviour it is running from the mission it chose to take, and flies an envelope its licence class allows."
        />

        <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2">
          {DISCIPLINES.map((d, i) => (
            <li key={d.name} className={stagger(i)}>
              <GlowCard accent={d.accent} className="h-full">
                <div className="flex items-start gap-3.5">
                  <Badge accent={d.accent}>{d.letter}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                        {d.kicker}
                      </p>
                      <span className="font-mono text-[10.5px] text-text-muted">{d.tag}</span>
                    </div>
                    <h3 className="mt-1 font-condensed text-[19px] font-semibold text-text-primary">
                      {d.name}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                      {d.body}
                    </p>
                  </div>
                </div>
              </GlowCard>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- fleet */

/** Colour per discipline, so the roster reads the same way the map does. */
const TYPE_ACCENT: Record<string, string> = {
  cargo: GOLD,
  agricultural: GREEN,
  surveillance: CYAN,
  emergency: RED,
};

function Fleet() {
  return (
    <section className="border-b border-bezel bg-panel-void">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          num="04"
          label="The fleet"
          title={
            <>
              The aircraft, and <Lit>where they live</Lit>
            </>
          }
          lede="Nine airframes on nine pads, read straight from the fleet definitions the simulation runs on — so this roster cannot drift from what actually flies. Within a discipline the pairing is always a heavy and a light: they accept the same work and fly it differently."
        />

        <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FLEET.map((d, i) => {
            const accent = TYPE_ACCENT[d.type] ?? GOLD;
            return (
              <li key={d.id} className={stagger(i)}>
                <GlowCard accent={accent} className="flex h-full flex-col">
                  <div className="mb-3.5 flex items-start justify-between gap-3">
                    <Badge accent={accent}>{d.callsign}</Badge>
                    <span className="text-right font-mono text-[10px] leading-snug text-text-muted">
                      {d.specs.manufacturer}
                      <br />
                      {d.specs.model}
                    </span>
                  </div>

                  <h3 className="font-condensed text-[19px] font-semibold text-text-primary">
                    {d.name}
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">{d.base.name}</p>

                  <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-text-secondary">
                    {d.brief}
                  </p>

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-bezel pt-3">
                    <div>
                      <dt className="readout-label">Altitude</dt>
                      <dd className="readout mt-0.5 text-[12.5px]">
                        {d.envelope.cruiseAltitude[0]}&ndash;{d.envelope.cruiseAltitude[1]} m
                      </dd>
                    </div>
                    <div>
                      <dt className="readout-label">Cruise</dt>
                      <dd className="readout mt-0.5 text-[12.5px]">
                        {d.envelope.cruiseSpeed[0]}&ndash;{d.envelope.cruiseSpeed[1]}
                      </dd>
                    </div>
                    <div>
                      <dt className="readout-label">Licence</dt>
                      <dd className="readout mt-0.5 text-[12.5px]">{d.specs.license}</dd>
                    </div>
                  </dl>

                  {d.standby && (
                    <p
                      className="mt-3 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed text-text-secondary"
                      style={{ background: `${accent}12`, boxShadow: `inset 0 0 0 1px ${accent}2b` }}
                    >
                      Held off the public board. Flies only missions funded through the
                      escrow, so paid work never queues.
                    </p>
                  )}
                </GlowCard>
              </li>
            );
          })}
        </ul>

        <p className="reveal mt-8 max-w-[64ch] text-[13px] leading-relaxed text-text-muted">
          Every ceiling above sits under the 120 m SHGM allows for licensed commercial work
          under SHT-&#304;HA1 and &#304;HA2, and every cruise speed under the airframe&rsquo;s own
          rated maximum.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ under the hood */

const STACK = [
  {
    title: "Mission escrow",
    tag: "Soroban · Rust",
    body: "Holds the USDC for the length of the job and records the lira price beside the rate it was struck at. Thirteen tests, and both oracle-refusal paths are covered rather than assumed.",
  },
  {
    title: "The price guard",
    tag: "Reflector · SEP-40",
    body: "There is no published Reflector crate, so the interface is declared directly against the deployed spec. It is read inside the payout call, which is the only place a guard is worth anything.",
  },
  {
    title: "Lira on and off",
    tag: "SEP-1 · 6 · 10 · 12 · 38",
    body: "The app knows a home domain and an asset code. Every endpoint behind them is discovered from a stellar.toml at page load, which is what makes the integration portable instead of hardcoded.",
  },
  {
    title: "Wallet and identity",
    tag: "Wallets Kit v2",
    body: "Connection and signing through the eligible-partner kit. The SEP-10 challenge is signed by the user’s own key, so authentication needs no password and creates no account.",
  },
  {
    title: "The interface",
    tag: "Next.js 16 · React 19",
    body: "Typed end to end, with MapLibre carrying the operational map and the fleet simulation running as its own loop on a two-second tick. Server routes proxy the anchor so no key reaches the browser.",
  },
  {
    title: "The edge",
    tag: "ESP32 · Pixhawk · Jetson",
    body: "Node code for the hardware this is shaped around: Ed25519 frame signing, a MAVLink bridge, thermal hotspot detection and a pump relay. None of it is wired to an aircraft yet, and the README says so.",
  },
];

/** Contract green, oracle cyan, rails gold, edge red. */
const STACK_ACCENT = [GREEN, CYAN, GOLD, GOLD, CYAN, RED];

function UnderTheHood() {
  return (
    <section className="border-b border-bezel">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          num="06"
          label="The stack"
          title={
            <>
              What it is <Lit>actually made of</Lit>
            </>
          }
          lede="Six layers, and the interesting decisions are in the constraints rather than the library list."
        />

        <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s, i) => (
            <li key={s.title} className={stagger(i)}>
              <GlowCard accent={STACK_ACCENT[i]} className="h-full">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge accent={STACK_ACCENT[i]}>{String(i + 1).padStart(2, "0")}</Badge>
                  <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                    {s.tag}
                  </span>
                </div>
                <h3 className="font-condensed text-[18px] font-semibold text-text-primary">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{s.body}</p>
              </GlowCard>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- physical world */

const PROPERTIES = [
  {
    term: "One key does both jobs",
    accent: GREEN,
    body: "Stellar accounts are Ed25519 keypairs, and so is the signature an ESP32 puts on a flight record. The key that signs which aircraft flew a route is the address that receives the payment — the same 32 bytes, with no registry and no trusted party in between. A machine can hold its own account.",
  },
  {
    term: "Fiat is a standard",
    accent: GOLD,
    body: "SEP-1, 6, 10, 12 and 38 are an interface any anchor implements. The lira reaches the chain through that interface rather than a private arrangement, which is why the ramp discovers every endpoint from a stellar.toml at runtime. Point it at a production anchor and nothing else changes.",
  },
  {
    term: "Settlement can refuse",
    accent: RED,
    body: "The escrow reads the price feed inside the payout call and declines on a stale or depegged number. When a machine pays a machine there is nobody to ring about a wrong figure, so the refusal has to live in the contract rather than in a team that notices on Monday.",
  },
  {
    term: "Fees small enough to meter",
    accent: CYAN,
    body: "A charging pod ticking every two seconds cannot carry a cent of fee per tick. Sub-cent settlement is what makes a physical service chargeable by the second at all, instead of by the month.",
  },
];

function PhysicalWorld() {
  return (
    <section className="border-b border-bezel bg-panel-void">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          num="05"
          label="The thesis"
          title={
            <>
              Stellar, <Lit>off the screen</Lit>
            </>
          }
          lede="This is not really about drones. A drone is just the first machine we pointed it at. The pattern underneath is older and larger than any airframe: something in the physical world does a job, proves that it did it, and is paid for it — with nobody standing in the middle to vouch for any of the three."
        />

        <p className="reveal mt-4 max-w-[68ch] text-[14px] leading-relaxed text-text-secondary">
          Almost every attempt at that stalls in the same place. The work happens in the
          world, the money lives in a bank, and the only thing joining them is an invoice
          and somebody&apos;s word. Stellar closes that gap, and four of its properties are
          why &mdash; take any one away and this stops working.
        </p>

        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROPERTIES.map((p, i) => (
            <li key={p.term} className={stagger(i)}>
              <GlowCard accent={p.accent} className="h-full">
                <div className="mb-3 flex items-center gap-3">
                  <Badge accent={p.accent}>{String(i + 1).padStart(2, "0")}</Badge>
                  <h3 className="font-condensed text-[18px] font-semibold text-text-primary">
                    {p.term}
                  </h3>
                </div>
                <p className="text-[13.5px] leading-relaxed text-text-secondary">{p.body}</p>
              </GlowCard>
            </li>
          ))}
        </ul>

        <p className="reveal mt-10 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
          Swap the aircraft out and the shape holds. An EV charger settling by the
          kilowatt-hour. A tractor billing for the hectares it actually covered. A cold-chain
          sensor proving a shipment never rose above four degrees, and releasing the payment
          because it did not. A village water pump selling by the litre to people with a
          phone and no bank account. Every one of them does physical work, every one of them
          can hold a key, and none of them has a payment rail built for machines rather than
          for people.
        </p>

        <p className="reveal mt-4 max-w-[68ch] text-[17px] font-medium leading-relaxed text-text-primary">
          That is the gap this is built in. The drones are the proof, not the point.
        </p>
      </div>
    </section>
  );
}

function Foundations() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-condensed text-3xl font-semibold text-text-primary">
          What this is running on
        </h2>

        <dl className="mt-8 grid grid-cols-1 gap-px border border-bezel bg-bezel sm:grid-cols-2 lg:grid-cols-4">
          <Fact term="Network" value="Stellar testnet" note="Protocol 28" />
          <Fact
            term="Anchor"
            value={ANCHOR.homeDomain}
            note="Every endpoint discovered from its stellar.toml"
          />
          <Fact
            term="Escrow contract"
            value={
              MISSION_ESCROW_ID
                ? `${MISSION_ESCROW_ID.slice(0, 8)}…${MISSION_ESCROW_ID.slice(-6)}`
                : "not deployed"
            }
            note="soroban-sdk 28, Rust"
            href={MISSION_ESCROW_ID ? explorerContract(MISSION_ESCROW_ID) : undefined}
          />
          <Fact
            term="Price feed"
            value="Reflector"
            note="Read inside the settlement call, not alongside it"
          />
        </dl>

        <div className="reveal mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="btn-primary btn-lg inline-flex items-center gap-2"
          >
            Open the console
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
          <a
            href="https://github.com/hsankc/RiverAir"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-lg"
          >
            Read the source
          </a>
        </div>
      </div>
    </section>
  );
}

function Fact({
  term,
  value,
  note,
  href,
}: {
  term: string;
  value: string;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <dt className="readout-label">{term}</dt>
      <dd className="mt-2 break-all font-mono text-[13px] text-text-primary">{value}</dd>
      <dd className="mt-1.5 text-[11.5px] leading-relaxed text-text-muted">{note}</dd>
    </>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="bg-panel-raised p-5 transition-colors hover:bg-panel-high">
      {body}
    </a>
  ) : (
    <div className="bg-panel-raised p-5">{body}</div>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="border-t border-bezel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6">
        <BrandLockup size={22} />
        <p className="text-[11.5px] text-text-muted">
          A hackathon prototype on Stellar testnet. No real money moves, and it is not
          flight software — do not point it at an actual aircraft.
        </p>
      </div>
    </footer>
  );
}
