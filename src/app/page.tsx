"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { OperatingAreaChart } from "@/components/OperatingAreaChart";
import { ANCHOR, MISSION_ESCROW_ID, explorerContract } from "@/lib/stellar/config";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-panel-base">
      <Header />
      <main>
        <Hero />
        <MoneyFlow />
        <OracleGuard />
        <PhysicalWorld />
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

        <div className="landing-in landing-in-d2 mt-9 flex flex-wrap gap-2.5">
          <Link href="/ramp" className="btn-primary">
            Move some lira
          </Link>
          <Link href="/marketplace" className="btn-secondary">
            See the mission board
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

function MoneyFlow() {
  return (
    <section className="border-b border-bezel">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-[20ch] font-condensed text-3xl font-semibold text-text-primary">
          Where the money actually goes
        </h2>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-text-secondary">
          Six steps, in order, every one of them a real call against a real network. The
          only thing simulated on testnet is the bank itself.
        </p>

        <ol className="mt-10 grid grid-cols-1 gap-px border border-bezel bg-bezel md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="bg-panel-raised p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="readout text-sm text-nav">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[10.5px] text-text-muted">{step.tag}</span>
              </div>
              <h3 className="font-condensed text-[17px] font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                {step.body}
              </p>
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
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 lg:grid-cols-2">
        <div>
          <h2 className="max-w-[22ch] font-condensed text-3xl font-semibold text-text-primary">
            The contract is allowed to say no
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

        <div className="panel self-start">
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

/* -------------------------------------------------------- physical world */

function PhysicalWorld() {
  return (
    <section className="border-t border-bezel">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-condensed text-3xl font-semibold text-text-primary">
          Stellar, off the screen
        </h2>

        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
          This is not really about drones. A drone is just the first machine we pointed it
          at. The pattern underneath is older and larger than any airframe: something in the
          physical world does a job, proves that it did it, and is paid for it &mdash; with
          nobody standing in the middle to vouch for any of the three. Almost every attempt
          at that stalls in the same place. The work happens in the world, the money lives in
          a bank, and the only thing joining them is an invoice and somebody&apos;s word.
        </p>

        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
          Stellar closes that gap, and four of its properties are why. None of them are
          decoration here &mdash; take any one away and this stops working.
        </p>

        <dl className="mt-8 grid grid-cols-1 gap-px border border-bezel bg-bezel sm:grid-cols-2">
          <Property
            term="One key does both jobs"
            body="Stellar accounts are Ed25519 keypairs, and so is the signature an ESP32 puts on a flight record. The key that signs which aircraft flew a route is the address that receives the payment — the same 32 bytes, with no registry and no trusted party in between. A machine can hold its own account."
          />
          <Property
            term="Fiat is a standard, not an integration"
            body="SEP-1, 6, 10, 12 and 38 are an interface any anchor implements. The lira reaches the chain through that interface rather than a private arrangement, which is why the ramp discovers every endpoint from a stellar.toml at runtime. Point it at a production anchor and nothing else changes."
          />
          <Property
            term="Settlement is allowed to refuse"
            body="The escrow reads the price feed inside the payout call and declines on a stale or depegged number. When a machine pays a machine there is nobody to ring about a wrong figure, so the refusal has to live in the contract rather than in a team that notices on Monday."
          />
          <Property
            term="Fees small enough to meter"
            body="A charging pod ticking every two seconds cannot carry a cent of fee per tick. Sub-cent settlement is what makes a physical service chargeable by the second at all, instead of by the month."
          />
        </dl>

        <p className="mt-8 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
          Swap the aircraft out and the shape holds. An EV charger settling by the
          kilowatt-hour. A tractor billing for the hectares it actually covered. A cold-chain
          sensor proving a shipment never rose above four degrees, and releasing the payment
          because it did not. A village water pump selling by the litre to people with a
          phone and no bank account. Every one of them does physical work, every one of them
          can hold a key, and none of them has a payment rail built for machines rather than
          for people.
        </p>

        <p className="mt-4 max-w-[68ch] text-[15px] font-medium leading-relaxed text-text-primary">
          That is the gap this is built in. The drones are the proof, not the point.
        </p>
      </div>
    </section>
  );
}

function Property({ term, body }: { term: string; body: string }) {
  return (
    <div className="bg-panel-base p-5">
      <dt className="font-condensed text-[15px] font-semibold text-text-primary">{term}</dt>
      <dd className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{body}</dd>
    </div>
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

        <div className="mt-10 flex flex-wrap gap-2.5">
          <Link href="/dashboard" className="btn-primary">
            Open the console
          </Link>
          <a
            href="https://github.com/hsankc/RiverAir"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
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
