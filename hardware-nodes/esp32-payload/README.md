# RiverAir payload node — ESP32-S3

The board that signs what the aircraft actually did.

The escrow contract releases a mission's payment against a 32-byte flight-record
hash. That record is worth nothing if its measurements could have come from a
laptop. This node is where the guarantee starts: it holds an Ed25519 keypair
generated on first boot that never leaves the chip, and it signs every telemetry
frame at the sensor before the frame goes anywhere.

Ed25519 is the same curve Stellar accounts use, so the node's public key **is** a
Stellar address. A flight record signed here verifies against an on-chain
identity with no translation layer in between.

---

## Where it sits

```
   ┌──────────────┐  MAVLink   ┌────────────────────┐   4G/5G    ┌──────────┐
   │   Pixhawk    │◄──────────►│ Companion computer │◄──────────►│  Stellar │
   │  flight ctl  │   UART2    │  Jetson / Pi 4     │    RPC     │  testnet │
   └──────────────┘            └─────────┬──────────┘            └──────────┘
                                         │ UART1, 115200
                                         │ signed frames up
                                         │ vehicle state down
                               ┌─────────┴──────────┐
                               │   ESP32-S3         │
                               │   payload node     │  ← this directory
                               └─────────┬──────────┘
                     ┌───────────────────┼───────────────────┐
                 I2C │               GPIO│               GPIO│
              ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
              │ BME280      │     │ YF-S201     │     │ Pump relay  │
              │ INA226      │     │ flow meter  │     │ Cargo servo │
              └─────────────┘     └─────────────┘     └─────────────┘
```

**Why a second microcontroller at all.** The Pixhawk must never miss a control
loop deadline. Flow metering runs off an interrupt, the pump relay switches an
inductive load, and an I2C bus can stall for milliseconds. None of that belongs
near the attitude loop, so it gets its own MCU and its own power domain.

---

## Bill of materials

| Part | Model | Role | Approx. |
|---|---|---|---|
| MCU | ESP32-S3-DevKitC-1 (N8R2) | Signing, metering, payload control | $12 |
| Environment | Bosch BME280 (I2C, 0x76) | Temperature, humidity, pressure — spray drift is a regulated condition | $6 |
| Payload power | TI INA226 + 2 mΩ shunt (I2C, 0x40) | Bus voltage and current on the payload circuit | $7 |
| Flow meter | YF-S201 Hall effect | Litres dispensed, the figure an agricultural invoice is built on | $5 |
| Pump switch | 12 V SPDT relay + flyback diode | Drives the spray pump | $3 |
| Release | MG996R servo | Cargo hook | $6 |
| Power | 5 V/3 A UBEC off the main pack | Isolated from the FC rail | $8 |

---

## Pin map

| ESP32-S3 pin | Connects to | Note |
|---|---|---|
| GPIO 8 | BME280 SDA, INA226 SDA | 3.3 V bus, 4.7 kΩ pull-ups |
| GPIO 9 | BME280 SCL, INA226 SCL | shared with the above |
| GPIO 4 | YF-S201 signal | interrupt-capable, internal pull-up on |
| GPIO 5 | Relay module IN | relay coil runs off 5 V, **not** the 3.3 V rail |
| GPIO 6 | MG996R signal | servo power comes from the UBEC, never the ESP32 |
| GPIO 17 | Companion computer RX | UART1 TX |
| GPIO 18 | Companion computer TX | UART1 RX |
| GND | common with FC, UBEC, relay, servo | **required** — a floating ground makes every reading noise |

---

## Wiring diagrams

### The whole node

Three rails and one rule: **every ground must be common.** A floating ground makes every
reading noise and can put the I2C bus into a state that only a power cycle clears.

```
   6S LiPo (22.2 V)
        │
        ├──────────────► Pixhawk power module ──► FC (its own 5 V rail)
        │
        ├──────────────► 12 V BEC ──► pump ──┐
        │                                     │  (switched by relay, below)
        └──────────────► 5 V / 3 A UBEC ──────┼──┬──► ESP32-S3  5V pin
                                              │  ├──► relay module VCC
                                              │  └──► MG996R servo V+
                                              │
   ═══ COMMON GROUND ═════════════════════════┴══════════════════════════
        FC GND · UBEC GND · ESP32 GND · relay GND · servo GND · pump GND


   ┌─────────────────────── ESP32-S3-DevKitC-1 ───────────────────────┐
   │                                                                  │
   │  5V  ◄──── UBEC 5 V                        GPIO 17 ────► COMP RX │
   │  GND ◄──── common ground                   GPIO 18 ◄──── COMP TX │
   │  3V3 ────► BME280 VCC, INA226 VCC                   UART1 115200 │
   │                                                                  │
   │  GPIO 8  ◄──┬──► BME280 SDA    ┐                                 │
   │  GPIO 9  ◄──┴──► INA226 SDA    │  I2C, 3.3 V,                    │
   │             ├──► BME280 SCL    │  4.7 kΩ pull-ups to 3V3         │
   │             └──► INA226 SCL    ┘                                 │
   │                                                                  │
   │  GPIO 4  ◄────── YF-S201 signal   (interrupt, internal pull-up)  │
   │  GPIO 5  ──────► relay module IN  (opto input, 3.3 V logic OK)   │
   │  GPIO 6  ──────► MG996R signal    (power from UBEC, NOT the ESP) │
   │  GPIO 48 ──────► on-board status LED                             │
   └──────────────────────────────────────────────────────────────────┘
```

> **The ESP32-S3 is a 3.3 V part.** Drive the relay's opto-isolated input from GPIO and
> power its coil from the UBEC. Never source servo current from the board — an MG996R
> stalls at over 2 A and will brown out the MCU mid-frame.

> **GPIO 4 must be interrupt-capable and must not be a strapping pin.** With a flow sensor
> pulling on a strapping pin the node will not boot.

---

### Where it mounts on the airframe

```
        ┌─────────── airframe, top plate ───────────┐
        │                                            │
        │   ┌────────┐            ┌──────────────┐   │
        │   │ Pixhawk│            │  Companion   │   │   vibration-isolated
        │   │   FC   │◄── UART2 ──┤  computer    │   │   FC on its own mount
        │   └────────┘   MAVLink  │ Jetson / Pi  │   │
        │                         └──────┬───────┘   │
        │                                │ UART1     │
        │                         ┌──────┴───────┐   │
        │                         │   ESP32-S3   │   │   away from ESCs and
        │                         │ payload node │   │   power leads: they
        │                         └──────┬───────┘   │   couple into I2C
        │                                │           │
        └────────────────────────────────┼───────────┘
                                         │
        ┌────────────── payload rail ────┼───────────┐
        │                                │           │
        │   the three diagrams below differ here     │
        └────────────────────────────────────────────┘
```

Route the I2C pair away from the ESC leads and the main power run. I2C at 3.3 V over
400 kHz is not a robust bus, and a motor lead laid alongside it will corrupt reads under
throttle.

---

### Template A — Sprayer (`Silivri-03`, `Catalca-07`)

The flow meter goes **downstream of the pump and upstream of the boom**, so it counts what
actually reached the nozzles rather than what the pump tried to push.

```
   tank ──► pump ──► ╔═══════════╗ ──► boom ──► nozzles
                     ║  YF-S201  ║
                     ╚═════╤═════╝
                           │ signal
                           ▼
                      GPIO 4 (ESP32)

   GPIO 5 ──► relay IN ─┐
                        ├─── relay contacts ─── 12 V BEC ──► pump +
                        │
                    flyback diode across the pump terminals
                    (1N4007, band to +) — an unclamped pump
                    coil will reset the MCU every time it stops

   GPIO 6 ── unused on this build
```

Calibrate `FLOW_PULSES_PER_LITRE` against a measuring jug on the real boom. The datasheet
figure of 450 is a starting point, not an answer — this number is the invoice.

---

### Template B — Courier (`Kadikoy-01`, `Bakirkoy-05`)

```
                    ┌── HX711 ──► GPIO 8/9 (I2C) ──┐
   parcel ──► hook ─┤   20 kg load cell            │  mass before and after
                    └── MG996R ◄── GPIO 6 ─────────┘  confirms the release

   servo V+  ◄── UBEC 5 V   (never the ESP32 5V pin)
   servo GND ◄── common ground

   GPIO 4 ── unused     GPIO 5 ── unused
```

A delivery is a mass going to zero. That is a measurement the node can sign, rather than a
claim the operator makes.

---

### Template C — Observer and Responder (`Levent-12`, `Atasehir-09`, `Belgrad-02`, `Aydos-11`)

No actuator at all. The node is there to sign, and to report the payload circuit's power
draw while the gimbal and thermal core are running.

```
   GPIO 4 ── unused     GPIO 5 ── unused     GPIO 6 ── unused

   INA226 shunt in series with the gimbal / thermal supply:

       UBEC 5 V ──┬── 2 mΩ shunt ──┬──► gimbal + thermal core
                  │                │
               IN+ │              │ IN−
                  └──── INA226 ────┘
                          │ I2C
                          ▼
                    GPIO 8 / GPIO 9
```

The counting happens on the companion computer; the node signs the frames that say the
aircraft was on station with the payload powered.

---

### Bring-up checklist

| Step | Expect |
|---|---|
| 1. Power the node alone, USB only | `BOOT\|1.0.0\|bme:0\|ina:0\|pub:…` |
| 2. Add the I2C pair | `bme:1\|ina:1` |
| 3. Blow through the flow meter | `ml` field climbs |
| 4. Send `ID` | `PUBKEY\|…` matches the BOOT line |
| 5. Send `VEH\|41.07\|28.24\|20\|2` then `ARM\|1` then `RUN` | relay clicks, LED on |
| 6. Stop sending `VEH` for 2 s | `INHIBIT\|link`, relay releases |
| 7. Capture 20 frames, run `verify_frame.py` | `verified 20/20 frames` |

Step 6 is the one to actually do. It is the failure mode that matters, and it is the one
that is easiest to assume works.

---

## Wire protocol

Both directions are line-oriented ASCII at 115200 8N1, so a field test can be
watched on a serial monitor without tooling.

### Up — one frame per 200 ms

```
RA1|seq|uptime_ms|lat|lng|alt_m|ml|temp_c|rh|hpa|mv|ma|state|<signature hex>
```

The signature covers every field before it, joined exactly as transmitted.
A verifier re-joins those fields and checks them against the node's public key —
there are no canonicalisation rules to get wrong.

`state` is `0` idle, `1` armed, `2` running, `3` released, `4` inhibited.

### Down — from the companion computer

| Command | Meaning |
|---|---|
| `VEH\|lat\|lng\|alt_m\|wind_mps` | Vehicle state. Expected at ≥ 1 Hz; silence for 2 s stops the payload. |
| `ARM\|<mission id>` | Authorise the payload and reset the litre count to zero. |
| `RUN` | Pump on. |
| `STOP` | Pump off. |
| `DROP` | Release the cargo hook. |
| `ID` | Print the public key. |

---

## What the node refuses to do

The safety envelope is enforced on this board, every cycle, whatever the link
says. `RUN` is a request, not an instruction.

| Condition | Limit | Why it is enforced here |
|---|---|---|
| No `VEH` for 2 s | `LINK_TIMEOUT_MS` | The link is the least reliable part of the system, and a pump running after the aircraft has left the plot is a regulatory incident |
| Altitude above 60 m | `MAX_SPRAY_ALT_M` | Above spraying height the boom is no longer over a field |
| Wind above 8 m/s | `MAX_WIND_MPS` | Spray drift onto neighbouring land |

A breach stops the payload and emits `INHIBIT|<reason>`. When the condition
clears the node returns to **armed**, not to running — resuming is the
operator's decision, not the firmware's.

---

## Build and flash

```bash
pio run                 # build
pio run -t upload       # flash over USB
pio device monitor      # watch the signed frames
```

First boot generates the keypair and prints it:

```
BOOT|1.0.0|bme:1|ina:1|pub:3f8a…c412
```

---

## Verifying a frame

`verify_frame.py` in this directory checks a captured line against the node's
public key. This is the same check the companion computer runs before it will
put a frame into a flight record.

```bash
python verify_frame.py --pubkey 3f8a…c412 --frame "RA1|41|8200|41.073000|…|2|9d2f…"
```

---

## Key storage

The private key is written to NVS once and read back on every boot.

On a bench node that is plain NVS, which is readable if the flash is pulled off
the board. On a production node, enable flash encryption and NVS encryption so
the partition is sealed to a key burned into eFuse:

```bash
idf.py menuconfig
  → Security features → Enable flash encryption on boot
  → Component config → NVS → Enable NVS encryption
```

Re-keying a node makes it a different identity. Flight records signed by the old
key stay verifiable against the old public key, which is the correct behaviour —
history should not change because hardware was replaced.

---

## Status

This firmware is written against real parts and a real pin map, and the frame
format and signature scheme are what the rest of the system expects. **It has
not been flown.** Nothing in the deployed RiverAir build is connected to an
aircraft; the simulation stands in for the fleet. Do not point this at a vehicle
carrying a payload without your own bench testing and the appropriate SHGM
authorisation.
