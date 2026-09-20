// RiverAir payload node — pin map and operating limits.
//
// Everything a builder has to change when wiring a different airframe lives in
// this one file. Nothing below it reaches for a raw pin number.

#pragma once

#include <stdint.h>

// ── I2C bus: environment and payload power ────────────────────────────────
// BME280 at 0x76, INA226 at 0x40. Both are 3.3 V parts; do not put them on a
// 5 V bus with the servo rail.
constexpr uint8_t PIN_I2C_SDA = 8;
constexpr uint8_t PIN_I2C_SCL = 9;
constexpr uint8_t ADDR_BME280 = 0x76;
constexpr uint8_t ADDR_INA226 = 0x40;

// The shunt the INA226 measures the payload circuit across.
constexpr float INA226_SHUNT_OHMS = 0.002f;
constexpr float INA226_MAX_AMPS = 20.0f;

// ── Flow meter (spraying airframes) ───────────────────────────────────────
// YF-S201 Hall-effect meter on the pump outlet. It emits a square wave whose
// frequency tracks flow; this pin must be interrupt-capable and must not be a
// strapping pin, or the node will not boot with the sensor attached.
constexpr uint8_t PIN_FLOW_PULSE = 4;

// Datasheet figure for the YF-S201: 450 pulses per litre. Calibrate per unit
// against a measuring jug and put the real number here — a sprayer that
// reports litres it did not dispense is a node that signs a false record.
constexpr float FLOW_PULSES_PER_LITRE = 450.0f;

// ── Actuators ─────────────────────────────────────────────────────────────
// Pump relay (agricultural) and release servo (cargo). One airframe carries
// one of the two; both are declared so a single firmware image serves both.
constexpr uint8_t PIN_PUMP_RELAY = 5;
constexpr uint8_t PIN_CARGO_SERVO = 6;

constexpr int SERVO_LOCKED_DEG = 15;
constexpr int SERVO_RELEASED_DEG = 105;

// ── Status ────────────────────────────────────────────────────────────────
constexpr uint8_t PIN_STATUS_LED = 48;  // on-board addressable LED on the S3 DevKitC

// ── Timing ────────────────────────────────────────────────────────────────
// 5 Hz. Fast enough that a spray pass is metered in usable slices, slow enough
// that signing every frame leaves the CPU almost entirely idle.
constexpr uint32_t FRAME_PERIOD_MS = 200;

// ── Safety envelope ───────────────────────────────────────────────────────
// The node cuts its own payload if the drone leaves the envelope the work was
// authorised for. This is deliberately enforced here rather than upstream: the
// link to the companion computer can drop, and a pump that keeps running after
// the aircraft has left the plot is a regulatory incident.
constexpr float MAX_SPRAY_ALT_M = 60.0f;   // above this the boom is not over a field
constexpr float MAX_WIND_MPS = 8.0f;       // spray drift limit
constexpr uint32_t LINK_TIMEOUT_MS = 2000; // no command in 2 s = stop the payload
