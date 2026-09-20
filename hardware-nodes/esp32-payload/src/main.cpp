// =============================================================================
// RiverAir payload node
// ESP32-S3 · Arduino framework · firmware 1.0.0
// =============================================================================
//
// WHAT THIS BOARD IS FOR
//
// The escrow contract on Stellar releases a mission's payment against a
// 32-byte flight-record hash. That record is only worth anything if the
// measurements inside it came from the aircraft rather than from someone's
// laptop. This node is where that guarantee starts.
//
// It holds an Ed25519 keypair — the same curve Stellar accounts use, so its
// signature verifies against an on-chain identity with no translation layer —
// generated on first boot and never leaving the chip. Every telemetry frame is
// signed here, at the sensor, before it goes anywhere. The companion computer
// upstream can relay frames, batch them and hash them, but it cannot forge one
// and it cannot alter a litre count without invalidating the signature.
//
// WHY IT IS NOT THE FLIGHT CONTROLLER
//
// The Pixhawk must never miss a control-loop deadline. Flow metering runs off
// an interrupt, the pump relay switches an inductive load, and the I2C bus can
// stall for milliseconds at a time. None of that belongs anywhere near the
// attitude loop, so it lives on its own microcontroller with its own power
// domain and talks to the companion computer over a UART.
//
// WHAT IT REFUSES TO DO
//
// The node enforces its own safety envelope. If the aircraft climbs above
// spraying height, the wind exceeds the drift limit, or the link goes quiet,
// it stops the payload itself without waiting to be told. A pump that keeps
// running after the aircraft has left the plot is a regulatory incident, and
// the link is the least reliable part of the system.
//
// =============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <INA226.h>
#include <ESP32Servo.h>
#include <Ed25519.h>
#include <Preferences.h>

#include "config.h"

// -----------------------------------------------------------------------------
// Peripherals
// -----------------------------------------------------------------------------

static Adafruit_BME280 bme;
static INA226 ina(ADDR_INA226);
static Servo cargoServo;
static Preferences nvs;
static HardwareSerial link(LINK_UART_NUM);

static bool bmePresent = false;
static bool inaPresent = false;

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

static uint8_t privateKey[32];
static uint8_t publicKey[32];

/**
 * Load this node's keypair, generating one on first boot.
 *
 * The private half is written to NVS once and read back on every boot after
 * that. On a production node NVS is encrypted with a key burned into eFuse, so
 * pulling the flash off the board yields ciphertext; see README.md. A node that
 * is re-keyed becomes a different identity and its old flight records stay
 * verifiable against the old public key.
 */
static void loadOrCreateIdentity() {
  nvs.begin("riverair", false);

  if (nvs.getBytesLength("sk") == sizeof(privateKey)) {
    nvs.getBytes("sk", privateKey, sizeof(privateKey));
    Ed25519::derivePublicKey(publicKey, privateKey);
  } else {
    Ed25519::generatePrivateKey(privateKey);
    Ed25519::derivePublicKey(publicKey, privateKey);
    nvs.putBytes("sk", privateKey, sizeof(privateKey));
  }

  nvs.end();
}

// -----------------------------------------------------------------------------
// Flow metering
// -----------------------------------------------------------------------------

// Written from an ISR, read from the main loop.
static volatile uint32_t flowPulses = 0;

static void IRAM_ATTR onFlowPulse() {
  flowPulses++;
}

/** Millilitres dispensed since boot, from the pulse count. */
static uint32_t millilitresDispensed() {
  noInterrupts();
  const uint32_t pulses = flowPulses;
  interrupts();
  return static_cast<uint32_t>((pulses / FLOW_PULSES_PER_LITRE) * 1000.0f);
}

// -----------------------------------------------------------------------------
// Payload state
// -----------------------------------------------------------------------------

enum class Payload : uint8_t {
  Idle = 0,     // nothing armed
  Armed = 1,    // authorised for this mission, not yet running
  Running = 2,  // pump on / cargo carried
  Released = 3, // cargo dropped
  Inhibited = 4 // stopped by the safety envelope
};

static Payload payloadState = Payload::Idle;

/** State the aircraft reports to us; we never measure position ourselves. */
struct Vehicle {
  double lat = 0.0;
  double lng = 0.0;
  float altitudeM = 0.0f;
  float windMps = 0.0f;
  uint32_t lastCommandMs = 0;
};

static Vehicle vehicle;

static void stopPump() {
  digitalWrite(PIN_PUMP_RELAY, LOW);
}

/**
 * The envelope check, run every frame regardless of what the link is saying.
 *
 * Returns the reason the payload was inhibited, or nullptr if it may run.
 */
static const char *envelopeBreach() {
  if (millis() - vehicle.lastCommandMs > LINK_TIMEOUT_MS) return "link";
  if (vehicle.altitudeM > MAX_SPRAY_ALT_M) return "altitude";
  if (vehicle.windMps > MAX_WIND_MPS) return "wind";
  return nullptr;
}

// -----------------------------------------------------------------------------
// Frame encoding
// -----------------------------------------------------------------------------

static uint32_t sequence = 0;

static void appendHex(String &out, const uint8_t *bytes, size_t len) {
  static const char *digits = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out += digits[bytes[i] >> 4];
    out += digits[bytes[i] & 0x0F];
  }
}

/**
 * Emit one signed telemetry frame.
 *
 * The wire format is a pipe-delimited line so it can be read by a human on a
 * serial monitor during a field test, which matters more than the handful of
 * bytes a binary encoding would save at 5 Hz:
 *
 *   RA1|seq|uptime_ms|lat|lng|alt_m|ml|temp_c|rh|hpa|mv|ma|state|<sig hex>
 *
 * The signature covers every field before it, joined exactly as transmitted.
 * Anything that wants to verify a frame re-joins those fields and checks
 * against this node's public key — no canonicalisation rules to get wrong.
 */
static void emitFrame() {
  float tempC = 0.0f, humidity = 0.0f, pressureHpa = 0.0f;
  if (bmePresent) {
    tempC = bme.readTemperature();
    humidity = bme.readHumidity();
    pressureHpa = bme.readPressure() / 100.0f;
  }

  int32_t busMv = 0, currentMa = 0;
  if (inaPresent) {
    busMv = static_cast<int32_t>(ina.getBusVoltage() * 1000.0f);
    currentMa = static_cast<int32_t>(ina.getCurrent_mA());
  }

  String payload = "RA1";
  payload += "|" + String(++sequence);
  payload += "|" + String(millis());
  payload += "|" + String(vehicle.lat, 6);
  payload += "|" + String(vehicle.lng, 6);
  payload += "|" + String(vehicle.altitudeM, 1);
  payload += "|" + String(millilitresDispensed());
  payload += "|" + String(tempC, 2);
  payload += "|" + String(humidity, 1);
  payload += "|" + String(pressureHpa, 1);
  payload += "|" + String(busMv);
  payload += "|" + String(currentMa);
  payload += "|" + String(static_cast<int>(payloadState));

  uint8_t signature[64];
  Ed25519::sign(signature, privateKey, publicKey,
                reinterpret_cast<const uint8_t *>(payload.c_str()), payload.length());

  String frame = payload + "|";
  appendHex(frame, signature, sizeof(signature));

  link.println(frame);
  Serial.println(frame);
}

// -----------------------------------------------------------------------------
// Command handling
// -----------------------------------------------------------------------------

/**
 * Commands from the companion computer, one per line:
 *
 *   VEH|lat|lng|alt_m|wind_mps    vehicle state, expected at >= 1 Hz
 *   ARM|<mission id>              authorise the payload for this mission
 *   RUN                           pump on / carry
 *   STOP                          pump off
 *   DROP                          release the cargo hook
 *   ID                            print the public key
 *
 * Nothing here is trusted with safety. ARM and RUN are requests; the envelope
 * check in the main loop is what actually decides whether the payload runs.
 */
static void handleCommand(const String &line) {
  if (line.startsWith("VEH|")) {
    int a = line.indexOf('|');
    int b = line.indexOf('|', a + 1);
    int c = line.indexOf('|', b + 1);
    int d = line.indexOf('|', c + 1);
    if (b < 0 || c < 0 || d < 0) return;

    vehicle.lat = line.substring(a + 1, b).toDouble();
    vehicle.lng = line.substring(b + 1, c).toDouble();
    vehicle.altitudeM = line.substring(c + 1, d).toFloat();
    vehicle.windMps = line.substring(d + 1).toFloat();
    vehicle.lastCommandMs = millis();
    return;
  }

  if (line.startsWith("ARM|")) {
    payloadState = Payload::Armed;
    flowPulses = 0;  // a new mission meters from zero
    return;
  }

  if (line == "RUN") {
    if (payloadState == Payload::Armed || payloadState == Payload::Running) {
      payloadState = Payload::Running;
    }
    return;
  }

  if (line == "STOP") {
    stopPump();
    if (payloadState == Payload::Running) payloadState = Payload::Armed;
    return;
  }

  if (line == "DROP") {
    if (payloadState == Payload::Armed || payloadState == Payload::Running) {
      cargoServo.write(SERVO_RELEASED_DEG);
      payloadState = Payload::Released;
    }
    return;
  }

  if (line == "ID") {
    String out = "PUBKEY|";
    appendHex(out, publicKey, sizeof(publicKey));
    link.println(out);
    Serial.println(out);
    return;
  }
}

static void readCommands() {
  static String buffer;

  while (link.available()) {
    const char ch = static_cast<char>(link.read());
    if (ch == '\n') {
      buffer.trim();
      if (buffer.length() > 0) handleCommand(buffer);
      buffer = "";
    } else if (buffer.length() < 200) {
      buffer += ch;
    } else {
      buffer = "";  // overlong line: drop it rather than growing without bound
    }
  }
}

// -----------------------------------------------------------------------------
// Setup and loop
// -----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  link.begin(115200, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);

  pinMode(PIN_PUMP_RELAY, OUTPUT);
  stopPump();

  pinMode(PIN_STATUS_LED, OUTPUT);

  pinMode(PIN_FLOW_PULSE, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_PULSE), onFlowPulse, FALLING);

  cargoServo.attach(PIN_CARGO_SERVO);
  cargoServo.write(SERVO_LOCKED_DEG);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  bmePresent = bme.begin(ADDR_BME280);
  inaPresent = ina.begin();
  if (inaPresent) {
    ina.setMaxCurrentShunt(INA226_MAX_AMPS, INA226_SHUNT_OHMS);
  }

  loadOrCreateIdentity();

  String banner = "BOOT|" RIVERAIR_FW_VERSION "|bme:";
  banner += bmePresent ? "1" : "0";
  banner += "|ina:";
  banner += inaPresent ? "1" : "0";
  banner += "|pub:";
  appendHex(banner, publicKey, sizeof(publicKey));
  link.println(banner);
  Serial.println(banner);
}

void loop() {
  readCommands();

  // The envelope decides, every cycle, regardless of what was last commanded.
  const char *breach = envelopeBreach();
  if (breach != nullptr) {
    if (payloadState == Payload::Running || payloadState == Payload::Armed) {
      stopPump();
      payloadState = Payload::Inhibited;

      String notice = "INHIBIT|";
      notice += breach;
      link.println(notice);
      Serial.println(notice);
    }
  } else if (payloadState == Payload::Inhibited) {
    // Recovered: back to armed, but not running. Resuming is a decision the
    // operator makes, not one the node makes for them.
    payloadState = Payload::Armed;
  }

  digitalWrite(PIN_PUMP_RELAY, payloadState == Payload::Running ? HIGH : LOW);
  digitalWrite(PIN_STATUS_LED, payloadState == Payload::Running ? HIGH : LOW);

  static uint32_t lastFrameMs = 0;
  const uint32_t now = millis();
  if (now - lastFrameMs >= FRAME_PERIOD_MS) {
    lastFrameMs = now;
    emitFrame();
  }
}
