# System Architecture

RiverAir connects drone operations to a payment rail that starts and ends in a Turkish bank
account. The system is organised into seven layers: the browser, the fleet definitions, fleet
state, AI dispatch, the anchor that moves lira, the Stellar contract that holds the
money, and the hardware edge.

The two layers that carry the product are the **anchor** and the **contract**. The rest of
the system is arranged around them.

---

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       BROWSER CLIENT                         │
│      Next.js 16 (App Router) · React 19 · TypeScript 5       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐  │
│  │Operations│ │ Missions │ │Lira↔USDC │ │Charge│ │ Control │  │
│  │  SkyMap  │ │  Escrow  │ │   Ramp   │ │ DePIN│ │ FPV/3D  │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──┬───┘ └────┬────┘  │
│       └───────────┴────────────┴──────────┴──────────┘       │
│  ┌───────────────────────┐   ┌──────────────────────────┐    │
│  │  DroneFleetContext    │   │   WalletContext          │    │
│  │  useSimulation        │   │   Stellar Wallets Kit    │    │
│  └───────────────────────┘   └────────────┬─────────────┘    │
└───────────────────┬───────────────────────┼──────────────────┘
                    │                       │ signs everything
        ┌───────────┴──────────┐            │
        ▼                      ▼            ▼
┌────────────────┐   ┌──────────────┐  ┌──────────────────────┐
│ /api/anchor/*  │   │  OpenAI API  │  │   Stellar testnet    │
│  SEP proxy     │   │(gpt-4o-mini) │  │ ┌──────────────────┐ │
│  (server-side) │   │ + fallback   │  │ │  mission-escrow  │ │
└───────┬────────┘   └──────────────┘  │ │  (Soroban, Rust) │ │
        │                              │ └────────┬─────────┘ │
        ▼                              │          │ reads     │
┌────────────────┐                     │          ▼           │
│   TR anchor    │  pays real USDC ──▶ │  ┌───────────────┐   │
│ SEP-1/6/10/38  │                     │  │   Reflector   │   │
└───────┬────────┘                     │  │  price feed   │   │
        │ FAST / EFT                   │  └───────────────┘   │
        ▼                              │  Horizon · RPC · SAC │
┌────────────────┐                     └──────────────────────┘
│  Turkish bank  │ ← simulated by the anchor on testnet
└────────────────┘
```

---

## 1. Frontend and presentation

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | Routing, server-side route handlers, rendering |
| **React 19** | Component architecture |
| **TypeScript 5** | Type safety across the codebase |
| **Tailwind CSS 4** | CSS-first theming; instrument-panel design tokens in `globals.css` |
| **Leaflet** | `SkyMap` fleet map on the operations screen |
| **MapLibre GL JS** | 3D city view on `/control`, field picker on mission creation |

`AppShell` is the frame every operational screen sits in — rail, designation strip, live
system readouts, wallet. Pages supply a title and content and nothing else.

---

## 2. The fleet

Each aircraft is defined in its own file under `src/lib/fleet/`: its home base,
the mission types it accepts, its altitude and speed envelope, how it works a
site, and a plain-language list of what it does. The simulation reads those
definitions and holds no per-type table of its own, so adding an aircraft is a
new file plus one line in `index.ts`.

The eight bases sit far apart on purpose, and the two aircraft in each
discipline are split across the city — Silivri and Çatalca out west on the
farmland, Belgrad Forest north and Aydos east, Levent and Ataşehir watching
either side of the Bosphorus, Kadıköy and Bakırköy running parcels from
opposite shores. No two aircraft share a pad or fly the same corridor. Each
takes off from and returns to its own base rather than the nearest pad, which
gives every flight a fixed start and end.

Within a discipline the two airframes are deliberately different — a heavy and
a light. They accept the same work and fly it in different envelopes, so which
aircraft claims a job changes how the job looks.

## 3. Fleet state

- **DroneFleetContext** — shared live fleet state for every page that shows drones.
- **useSimulation** — client-side physics, mission assignment and completion loop.
- The simulation seeds from `Math.random()` and `new Date()`, so the provider withholds it
  until after mount. Otherwise the server and the browser render different fleets and
  hydration fails.

---

## 4. AI dispatch

| Component | Role |
|---|---|
| **`/api/ai-dispatch`** | Turns a natural-language command into a structured intent |
| **`/api/agent-decision`** | Fleet decisions; returns 404 when no API key is configured |
| **OpenAI gpt-4o-mini** | Primary interpreter |
| **Fallback parser** | Deterministic rules when no key is present, so the demo never depends on one |

---

## 5. Anchor layer — where lira becomes USDC

This is the layer that makes the product a payment rail rather than a dashboard.

| Standard | Endpoint | Role |
|---|---|---|
| **SEP-1** | `/.well-known/stellar.toml` | Discovery. Every other endpoint is read from here at runtime, never hardcoded. |
| **SEP-10** | `/auth` | Login by signing a challenge with the user's Stellar key. No password, no account. |
| **SEP-6** | `/sep6/deposit`, `/sep6/withdraw` | Programmatic cash in and cash out. |
| **SEP-12** | `/sep12` | KYC. Simulated and auto-approved on this anchor; no personal data is collected. |
| **SEP-38** | `/sep38/price`, `/sep38/quote` | Indicative and firm TRY↔USDC rates, sourced from Reflector. |

Implementation notes:

- `src/lib/stellar/anchor.ts` speaks all of the above over plain `fetch`. The official
  wallet SDK was rejected because its SEP-10 helper wants the user's secret key, which a
  non-custodial app never has.
- Calls run **server-side** in `src/app/api/anchor/*`. The browser talks only to our own
  API, which keeps the session token off the client and sidesteps CORS.
- Rates are normalised to **lira per USDC** in the route handler. SEP-38's `price` is a mid
  rate and inverts between deposit and withdrawal; deriving from `sell_amount` and
  `buy_amount` removes both traps.

---

## 6. Contract layer — where the money waits

**`mission-escrow`**, Rust on `soroban-sdk` 28, deployed to Stellar testnet.

| Function | Role |
|---|---|
| `fund_mission` | Moves USDC from the customer into the contract; records the lira price and the rate it was struck at |
| `assign` | An operator claims an open mission with their own key |
| `complete` | Reads Reflector, then releases the USDC against a flight-record hash |
| `cancel` | Refunds the customer; admin can unwind a claimed mission before its deadline |
| `oracle_health` | The same check `complete` runs, read-only, so a client can show why a payout would be refused |

**The oracle is load-bearing.** `complete()` calls Reflector *inside* the settlement path
and aborts on three conditions: `StalePrice` (older than 15 minutes), `Depegged` (USDC more
than 2% off the dollar), `NoPrice`. All three leave the funds locked.

| Component | Role |
|---|---|
| **Stellar Wallets Kit** | Wallet connection and signing; the user's key never leaves their wallet |
| **USDC via SAC** | The anchor's own USDC issuer, exposed to Soroban as a contract token |
| **Reflector** | Price feed, called cross-contract with a locally declared `#[contractclient]` |
| **Horizon / Soroban RPC** | Balances, trustlines, transaction submission |

---

## 7. Hardware edge

Each drone is designed for a dual-compute architecture. Nothing here is connected in this
build; the simulation stands in for it.

```
┌─────────────────────────────┐
│      RiverAir Edge Node     │
├─────────────────────────────┤
│  Jetson Orin Nano  (AI)     │ ← Computer vision, obstacle detection
│  Pixhawk Cube      (FC)     │ ← MAVLink flight control
│  4G/5G Modem                │ ← RPC backhaul via WireGuard
│  Ed25519 Keystore           │ ← Signed telemetry attestation
│  RTK GPS · Thermal · ADS-B  │ ← ±2cm positioning, airspace awareness
└─────────────────────────────┘
              ↕
     ┌──────────────────┐
     │ Stellar testnet  │
     └──────────────────┘
```

Ed25519 is the same signature scheme Stellar accounts use, so a flight record signed at the
edge verifies against an on-chain identity without a translation layer. `complete()` already
stores a 32-byte hash of that record — the attachment point for proof of flight.

> See [`HARDWARE.md`](../HARDWARE.md) and [`hardware-nodes/`](../hardware-nodes/).

---

## Directory structure

```
contracts/
└── mission-escrow/src/
    ├── lib.rs               # The escrow: funding, claiming, oracle-gated settlement
    └── test.rs              # 13 tests, including both oracle-refusal paths

scripts/
└── deploy.sh                # Build, deploy, verify the oracle read, write .env.local

src/
├── lib/fleet/               # ONE FILE PER AIRCRAFT — the fleet is defined here
│   ├── kadikoy-cargo.ts     #   Kadikoy-01  COURIER    base, work, envelope, duties
│   ├── bakirkoy-cargo.ts    #   Bakirkoy-05 COURIER    fixed-wing VTOL, long range
│   ├── silivri-agri.ts      #   Silivri-03  SPRAYER
│   ├── catalca-agri.ts      #   Catalca-07  SPRAYER
│   ├── levent-watch.ts      #   Levent-12   OBSERVER
│   ├── atasehir-watch.ts    #   Atasehir-09 OBSERVER
│   ├── belgrad-fire.ts      #   Belgrad-02  RESPONDER
│   ├── aydos-fire.ts        #   Aydos-11    RESPONDER
│   ├── types.ts             #   the definition shape + toAgent()
│   └── index.ts             #   the roster
├── app/
│   ├── page.tsx             # Landing
│   ├── ramp/                # Lira ↔ USDC
│   ├── marketplace/         # Missions and escrow funding
│   ├── dashboard/           # Operations
│   ├── sky-charge/          # Charging pods
│   ├── control/             # FPV manual control
│   ├── flight-logs/         # Audit trail
│   └── api/
│       ├── anchor/          # SEP proxy: challenge, token, deposit, withdraw,
│       │                    #   transaction, price, quote, info, simulate-bank
│       ├── ai-dispatch/
│       └── agent-decision/
├── components/
│   ├── AppShell.tsx         # The frame every operational screen sits in
│   ├── SystemStrip.tsx      # Live rate and price-feed readouts
│   ├── WalletConnect.tsx    # Connect, balances, trustline
│   ├── ramp/                # DepositPanel, WithdrawPanel, DiscoveryPanel
│   ├── missions/            # FundMissionPanel, MissionCard
│   ├── SkyMap.tsx           # Leaflet fleet map
│   └── dashboard/           # Rail and panel components
└── lib/
    ├── stellar/
    │   ├── config.ts        # Network, assets, contract and feed addresses
    │   ├── anchor.ts        # SEP-1/6/10/38 client
    │   ├── escrow.ts        # Contract client, bindings read from the deployed spec
    │   └── WalletContext.tsx# Wallet session, balances, trustlines, SEP-10
    ├── ai/dispatcher.ts
    ├── hooks/useSimulation.ts
    ├── DroneFleetContext.tsx
    └── data.ts              # Seed fleet and mission data

hardware-nodes/
├── core/                    # Ed25519 node signer (Python)
├── jetson-thermal/          # Fire detection (Python)
├── pixhawk-mavlink/         # MAVLink bridge (Python)
└── raspberry-agras/         # Agricultural pump relay (Python)
```
