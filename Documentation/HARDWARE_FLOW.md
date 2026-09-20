# Hardware Integration Flow

RiverAir operates at the intersection of **bits and atoms**. This document describes how physical hardware would interact with the RiverAir protocol on Stellar. No aircraft is connected to the current build — see [DEMO_STATUS.md](DEMO_STATUS.md).

---

## The Drone Stack

Each drone in the fleet is equipped with a **dual-compute architecture**:

### 1. Flight Control (Pixhawk)

- Handles the physics of flight (attitude, throttle, navigation)
- Reads gyroscopes, accelerometers, barometer, and GPS
- Communicates via **MAVLink 2** protocol over serial/UDP
- Executes waypoint missions, RTL (Return-to-Launch), and failsafe behaviors

### 2. Edge AI & Signer (Jetson Orin Nano)

- Runs the RiverAir **edge node** software bridge
- Holds the unique **Ed25519 keypair** for the specific drone
- Performs real-time **computer vision** (obstacle detection, fire detection)
- Connects to the internet via a **4G/5G LTE module**
- Maintains a **WireGuard** VPN tunnel for secure Stellar RPC access

### 3. Sensor Suite

| Sensor | Purpose |
|---|---|
| **RTK GPS** | ±2 cm precision positioning |
| **Thermal Camera** | Fire detection, search & rescue |
| **ADS-B Receiver** | Airspace awareness and collision avoidance |
| **LiDAR** (optional) | Terrain mapping and obstacle avoidance |

---

## The Mission Loop

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Client  │───▶│   Mission    │───▶│     AI       │───▶│    Drone     │───▶│  Settlement  │
│  Posts   │    │   Escrow     │    │  Dispatcher  │    │  Execution   │    │  On-Chain    │
│  Mission │    │ (USDC Lock)  │    │  (Matching)  │    │  (MAVLink)   │    │  (Release)   │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Step-by-Step

1. **Creation** — A client requests a mission via the Marketplace UI. Funds are locked in the `mission-escrow` contract on Stellar.

2. **Dispatch** — The AI Dispatcher (FleetAgent) evaluates all available drones by battery level, GPS proximity, sensor capability, and current task load. The optimal drone is assigned.

3. **Translation** — The Jetson edge node receives target coordinates via the cloud relay and translates them into MAVLink waypoint commands for the Pixhawk flight controller.

4. **Execution** — The Pixhawk flies the drone to the target coordinates while the Jetson streams telemetry (position, altitude, battery, speed) back to the RiverAir dashboard.

5. **Proof-of-Flight** — Upon mission completion, the Jetson signs a geographic proof using its onboard Ed25519 keypair. This cryptographic attestation includes final coordinates, timestamp, and mission hash.

6. **Settlement** — The signed proof is transmitted via LTE to Stellar RPC. `complete()` records the flight-record hash, reads the Reflector price feed, and releases the USDC to the operator — or refuses, if the feed is stale or USDC has left its peg.

---

## DePIN Sky-Charge Pods

Sky-Charge pods are community-owned physical charging stations that participate in the RiverAir DePIN economy.

### Pod Hardware

- **Controller:** ESP32 or Raspberry Pi with internet connectivity
- **Charging Interface:** Physical landing pad with contact pins
- **Energy Meter:** Per-kWh measurement for accurate billing
- **Wallet:** Stellar keypair for receiving micropayments

### Charging Flow

1. **Pod Deployed** — An operator installs a charging pod and registers it on-chain with their Stellar wallet.

2. **Drone Approaches** — The ChargingAgent detects a low-battery drone and routes it to the nearest available pod using GPS proximity and pod availability status.

3. **Physical Connection** — When the drone lands on the pod, a cryptographic handshake verifies both identities.

4. **Energy Metering** — The pod meters energy consumption in real-time (kWh) and streams session data to the RiverAir dashboard.

5. **Micropayment** — Upon charging completion, a USDC micropayment is automatically executed from the drone's wallet to the pod owner's wallet based on the metered energy.

---

## Edge Node Software

Reference implementations are available in [`hardware-nodes/`](../hardware-nodes/):

| Script | Location | Purpose |
|---|---|---|
| `node_signer.py` | `hardware-nodes/core/` | Ed25519 keypair management and telemetry signing |
| `node_bridge.py` | `hardware-nodes/pixhawk-mavlink/` | MAVLink ↔ RiverAir cloud bridge |
| `fire_detection.py` | `hardware-nodes/jetson-thermal/` | Thermal camera fire detection pipeline |
| `pump_relay.py` | `hardware-nodes/raspberry-agras/` | Agricultural spray pump relay control |

---

## Security Considerations

- All drone telemetry is **cryptographically signed** with Ed25519 to prevent spoofing
- WireGuard tunnels ensure **encrypted** communication between edge nodes and Stellar RPC
- Pod ↔ drone handshakes use **mutual authentication** before energy transfer
- Mission escrow contracts only release funds upon **verified proof-of-flight**
