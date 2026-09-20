# Project Overview

## What is RiverAir?

Turkey builds some of the best drones in the world and puts almost none of them to everyday
work. RiverAir is the layer that was missing — an agentic network where autonomous fleets
are dispatched, priced and paid the moment the job is done. Crop spraying, cargo, patrol,
fire watch: the everyday problems a drone solves faster than anything on the ground.

The money is handled properly underneath. A customer books a job and pays from their bank
account in lira. The operator who flies it is paid into their bank account in lira. In
between, the payment sits in a Soroban contract on Stellar that releases it only once the
work is done — and refuses to release it if the exchange rate it is settling against has
gone stale.

Built for the Rise In × Stellar Pro Hackathon 2026, Genesis Track, on Stellar testnet.

---

## The problem

Turkey has the drones and it has the work — agriculture that needs spraying, fire seasons
that get longer every year, junctions nobody has the staff to survey, parcels that move
slower than the roads they sit on. What is missing is everything after the flight.

**The drone problem.** Autonomy today stops at the airframe. An aircraft can fly a pattern,
but it cannot take the job, prove it did it, or be paid for it. Drone networks are closed
systems: one company buys the aircraft, builds the charging infrastructure, runs the
dispatch software, and handles payments and compliance. That is an enormous barrier to
anyone who owns two drones and wants to put them to work.

**The money problem.** A Turkish operator quotes and is paid in lira. Their customers,
equipment suppliers and cloud bills are frequently in dollars. The
lira moves enough that the gap between agreeing a price and being paid is itself a risk.
The escrow arrangements that would normally absorb that risk do not exist for a two-person
operation flying agricultural jobs outside İzmir — the fees and the paperwork are built for
much larger contracts.

Solve both and a drone stops being equipment a company owns and starts being a business
that runs itself.

---

## The approach

1. **Neither side leaves lira.** The customer pays from a Turkish bank account; the
   operator is paid into one. The dollar-denominated leg in the middle is mechanical and
   invisible to both of them.
2. **The payment is escrowed for the length of the job.** USDC is locked in a contract when
   the mission is posted. The lira figure and the rate it was struck at are recorded on
   chain, so the payout can be audited against what the customer actually agreed to.
3. **The contract is allowed to refuse.** Settlement reads a price feed first. A stale
   reading, or USDC drifting off its dollar peg, aborts the payout and leaves the funds
   locked rather than paying out at a rate nobody can vouch for.
4. **Operators claim work themselves.** A mission is taken by whoever signs for it, and
   only that key can settle it.
5. **Drones carry their own identity.** Ed25519 keys, the same cryptography Stellar
   accounts use, so a flight record can be signed at the edge.

---

## Who it is for

| Stakeholder | What they get |
|---|---|
| **Drone operators** | Work without building a service company around it, and payment that cannot be withheld once the job is verified. |
| **Customers** | A price agreed in lira, held by a contract instead of by the counterparty, refundable if the job is not taken. |
| **Infrastructure owners** | A rooftop becomes a charging pod earning per-kWh micropayments. |

---

## Product modules

| Module | Route | What it does |
|---|---|---|
| **Lira and USDC** | `/ramp` | Cash in and out through a SEP-6 anchor, plus what SEP-1 discovery returned |
| **Missions** | `/marketplace` | Post work priced in lira and funded into escrow; claim work with your own key |
| **Operations** | `/dashboard` | Live fleet on a map, telemetry, mission board, agent terminal |
| **Charging** | `/sky-charge` | Distributed pods with per-kWh micropayment metering |
| **Manual control** | `/control` | FPV-style operator takeover with keyboard flight |
| **Flight record** | `/flight-logs` | Searchable audit trail with CSV export |
| **Dispatcher** | overlay | Natural-language fleet commands, OpenAI with a deterministic fallback |

See [DEMO_STATUS.md](DEMO_STATUS.md) for exactly which of these run against the live
network and which are simulated.

---

## The fleet

Eight aircraft, two per discipline, each defined in its own file under
`src/lib/fleet/` with its base, the work it accepts and how it flies.

| Aircraft | Role | Airframe | Base | What it does |
|---|---|---|---|---|
| **Kadikoy-01** | Courier | DJI FlyCart 30 | Kadıköy Hub | Collects a parcel and carries it across the city |
| **Bakirkoy-05** | Courier | Autel Dragonfish Standard | Bakırköy Sahil | Fixed-wing VTOL; takes the long western runs |
| **Silivri-03** | Sprayer | DJI Agras T40 | Silivri Agro Station | Treats a marked plot on a lawnmower pattern |
| **Catalca-07** | Sprayer | DJI Agras T25 | Çatalca Field Station | Smaller tank for broken plots with obstacles |
| **Levent-12** | Observer | DJI Matrice 30T | Levent Deck | Orbits a junction while the traffic survey runs |
| **Atasehir-09** | Observer | DJI Mavic 3 Enterprise | Ataşehir Deck | Tight orbit over a single Anatolian-side junction |
| **Belgrad-02** | Responder | DJI Matrice 350 RTK | Belgrad Forest Station | Holds over a fire and streams thermal |
| **Aydos-11** | Responder | Autel EVO II Dual 640T V3 | Aydos Forest Post | First on scene in the eastern forest |

Each flies a different envelope: the sprayers crawl a field at 28–30 m and
under 25 km/h, the FlyCart cruises a straight line at 130 m, the Dragonfish
transits on a wing at 90 km/h, the responders climb above the smoke to 200 m.

The two aircraft in a discipline are never duplicates. The pairing is always a
heavy and a light, based at opposite ends of the city, so the same job gets
flown differently depending on who takes it.

> Airframes are reference models, not integrations. RiverAir targets any
> **MAVLink-compatible** aircraft. Nothing is connected to this build.
