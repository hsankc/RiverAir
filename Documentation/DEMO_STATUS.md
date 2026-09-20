# What is real and what is simulated

A drone-and-payments demo invites a fair question: how much of this actually runs? This
page answers it line by line, because the parts that are real are only worth anything if
the parts that are not are named.

---

## Real, against live Stellar testnet

Nothing in this section is mocked. Every item produces a transaction you can open on
[stellar.expert](https://stellar.expert/explorer/testnet).

| | What runs |
|---|---|
| **Escrow contract** | `mission-escrow`, Rust / `soroban-sdk` 28, deployed to testnet. Funding, claiming, oracle-gated settlement and refunds all execute on chain. 13 unit tests, including both oracle-refusal paths. |
| **Oracle read** | `complete()` calls Reflector's price feed *inside* the settlement path. A stale or depegged reading aborts the payout and the USDC stays locked. The header readout is that same call, run read-only. |
| **Settlement gate** | The panel on `/marketplace` runs the contract's own check read-only and states whether a payout would clear or be refused, measured against `max_price_age` and `depeg_bps` read from the deployed contract rather than restated in the UI. Settling a claimed mission calls `complete()` with a SHA-256 flight-record hash. |
| **Wallet** | Stellar Wallets Kit. The user's key signs every transaction and never leaves their wallet. |
| **SEP-10 auth** | A real challenge transaction, signed by the user's key, traded for a session token. No password, no account. |
| **SEP-6 deposit** | A real deposit record at the anchor. Real testnet USDC is paid to the user's own account. |
| **SEP-6 withdraw** | The wallet signs and submits an actual USDC payment to the anchor's treasury carrying the memo the anchor issued. |
| **SEP-38 quotes** | Live rates from the anchor, which sources them from Reflector. The rate that prices a mission is the rate that funds the escrow. |
| **SEP-1 discovery** | Every endpoint above is read from the anchor's `stellar.toml` at runtime. `/ramp` shows what came back. |
| **Trustlines** | Created through a real `changeTrust` operation, with the reserve checked first. |

## Simulated, and why

| | What stands in | What would replace it |
|---|---|---|
| **The Turkish bank** | The anchor is a testnet mock with no bank behind it, so the incoming lira transfer is triggered by an endpoint instead of arriving. The button that does it is labelled as a sandbox action. | A production anchor, where the customer's actual transfer triggers it and the button does not exist. |
| **KYC** | SEP-12, auto-approved, collects and stores no personal data. | The anchor's real KYC, same endpoint shape. |
| **The drone fleet** | Positions, telemetry, battery levels, charging sessions and the mission board are a client-side simulation. | MAVLink telemetry over `hardware-nodes/pixhawk-mavlink/node_bridge.py`. No aircraft is connected. |
| **Charging sessions** | A timer meters energy and accrues a micropayment figure. | An ESP32 pod controller with a real energy meter. |
| **AI dispatcher** | Gemini `gemini-3.8-flash` when a key is set, deterministic fallback replies otherwise. | Unchanged; it is real either way, just optional. |

## Not claimed

- **TRY is not read on chain.** Reflector carries the lira on mainnet but not on testnet, so
  the rate reaches the contract through the anchor's SEP-38 quote and Reflector guards the
  settlement asset instead. See the README for the one-line mainnet change.
- **Escrowed funds earn nothing.** The DeFindex leg does not close on testnet — its vaults
  hold a different USDC issuer than the anchor pays out. Deferred, deliberately.
- **This is not flight software.** Do not point it at an aircraft.

---

## Next

- Proof of flight: `complete()` already stores a 32-byte hash of the flight record, which
  is where a Groth16 verifier would attach.
- Revisit DeFindex once a testnet vault accepts anchor USDC, or on mainnet where the
  issuer question disappears.
- Charging micropayments as a payment channel — the pod meter ticks every two seconds,
  which is the traffic shape MPP Session mode exists for.
