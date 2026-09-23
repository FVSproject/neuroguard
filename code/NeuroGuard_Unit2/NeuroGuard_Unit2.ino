// ============================================================================
//  NeuroGuard  —  Unit 2: Foot Bracelet Node (Seeed XIAO nRF52840 Sense)
//  Continuous PPG (HR, SpO2, HRV) + motion for the infant wearable.
//
//  Sensors on this node (shared I2C, 400 kHz):
//    D4  SDA  ┐
//    D5  SCL  ┘   MAX30102  @0x57  — PPG → HR, SpO2, RR intervals, HRV
//                 MPU-6050  @0x68 (AD0→GND) — 3-axis accel + gyro
//    D2  = MAX30102 INT  (input; not yet used, reserved for FIFO IRQ)
//    D3  = MPU-6050 INT  (input; not yet used, reserved for motion IRQ)
//
//  XIAO nRF52840 silkscreen ↔ nRF pin:
//    D2=P0.28   D3=P0.29   D4=P0.04 (SDA)   D5=P0.05 (SCL)
//    (I2C pins are fixed by the variant — Wire.begin() takes no arguments here.)
//
//  Board setup (Arduino IDE):
//    File ▸ Preferences ▸ Additional Board Manager URLs, add:
//      https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
//    Tools ▸ Board ▸ Seeed nRF52 mbed-enabled Boards ▸ "Seeed XIAO nRF52840 Sense"
//
//  Libraries (Manage Libraries):
//    - "SparkFun MAX3010x Pulse and Proximity Sensor Library"
//    - "Adafruit MPU6050"   (pulls in Adafruit Unified Sensor + BusIO)
//  BLE library: use the **Bluefruit** library that ships bundled with the Seeed
//  nRF52 core — DO NOT install ArduinoBLE, it has no HCI transport for this
//  Adafruit-based core and will fail to link (undefined reference `HCITransport`).
//
//  Serial: 115200 baud (native USB CDC).
//
//  NOTE: HR/HRV need firm skin contact on the MAX30102 optical window;
//        the first ~5 s of contact are noisy — RRs are validated 300–2000 ms.
//        Wireless link to Unit 1 will be BLE (nRF52 = peripheral, ESP32-S3 =
//        central via NimBLE) — the BraceletPacket struct is already POD so
//        it drops straight into a BLE characteristic notify.
// ============================================================================

#include <Wire.h>
#include <math.h>

#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#include <bluefruit.h>   // Adafruit-based Seeed nRF52 core BLE stack

// ---------------------------- BLE link --------------------------------------
// Custom NeuroGuard bracelet service — one characteristic that notifies a
// BraceletWire payload every second to the pacifier (ESP32-S3 as central).
// Bluefruit takes 128-bit UUIDs as little-endian byte arrays. Both UUIDs below
// correspond to the string form used on the ESP32 side:
//   service:  a1b2c3d4-9999-4a2b-9c1e-1a2b3c4d5e6f
//   char:     a1b2c3d5-9999-4a2b-9c1e-1a2b3c4d5e6f
static const uint8_t NG_SVC_UUID_LE[16] = {
  0x6f,0x5e,0x4d,0x3c,0x2b,0x1a,0x1e,0x9c,
  0x2b,0x4a,0x99,0x99,0xd4,0xc3,0xb2,0xa1
};
static const uint8_t NG_CHR_UUID_LE[16] = {
  0x6f,0x5e,0x4d,0x3c,0x2b,0x1a,0x1e,0x9c,
  0x2b,0x4a,0x99,0x99,0xd5,0xc3,0xb2,0xa1
};

// ---------------------------- Pins ------------------------------------------
const int PIN_MAX_INT = D2;
const int PIN_MPU_INT = D3;

// ---------------------------- Cardiac / PPG ---------------------------------
const uint32_t FINGER_MIN_IR    = 50000;   // below this ⇒ no finger / bad contact
const int      RR_MIN_MS        = 300;     // > 200 bpm → reject
const int      RR_MAX_MS        = 2000;    // <  30 bpm → reject
const int      RR_WINDOW        = 60;      // HRV rolling window (beats)
const uint32_t SPO2_PERIOD_MS   = 3000;    // re-run SpO2 algorithm cadence

// ---------------------------- Motion ----------------------------------------
const uint32_t MPU_PERIOD_MS      = 20;     // 50 Hz read
const float    MOTION_THRESH_G    = 0.15f;  // net |a|-1g above this = movement
const uint32_t MOTION_REFRACT_MS  = 300;    // event debounce
const uint32_t STILL_ALERT_SEC    = 120;    // long stillness watchdog (demo)
const uint32_t WINDOW_MS          = 60000;  // 1-minute rolling window
const int      MAX_MOTION_EVENTS  = 128;
const uint32_t PACKET_PERIOD_MS   = 1000;

// --------------------------- Data model -------------------------------------
// Posture as a compact enum so the wire packet stays POD/packed.
enum PostureCode : uint8_t {
  POS_UNKNOWN = 0, POS_FLAT, POS_TILT_LEFT, POS_TILT_RIGHT,
  POS_TOE_UP, POS_TOE_DOWN, POS_TILTED
};
enum HrSource : uint8_t { HRSRC_NONE = 0, HRSRC_BEAT = 1, HRSRC_ALGO = 2 };

// Byte-exact layout — the same struct is redeclared on Unit 1 (ESP32-S3) and
// memcpy'd out of the BLE notification. Keep both copies in lockstep!
struct __attribute__((packed)) BraceletWire {
  uint32_t ts_ms;                    // 0
  uint8_t  finger_present;           // 4
  uint32_t ir_raw;                   // 5
  uint16_t hr_bpm;                   // 9
  uint8_t  hr_src;                   // 11 (HrSource)
  uint16_t rr_last_ms;               // 12
  uint16_t rr_mean_ms;               // 14
  float    sdnn_ms;                  // 16
  float    rmssd_ms;                 // 20
  uint8_t  pnn50_pct;                // 24
  int8_t   spo2_pct;                 // 25 (-1 = invalid)
  uint8_t  spo2_valid;               // 26
  float    activity_index;           // 27  (g RMS over 1 s)
  int16_t  pitch_x10;                // 31  (deg × 10)
  int16_t  roll_x10;                 // 33
  uint8_t  posture;                  // 35 (PostureCode)
  uint16_t motion_events_min;        // 36
  uint16_t seconds_since_movement;   // 38
  uint8_t  stillness_alert;          // 40
};                                   // 41 bytes total
typedef BraceletWire BraceletPacket; // local alias so existing code compiles

// --------------------------- Sensor objects ---------------------------------
MAX30105        ppg;
Adafruit_MPU6050 mpu;
bool ppgOk = false, mpuOk = false;

BLEService        neuroguardSvc(NG_SVC_UUID_LE);
BLECharacteristic braceletChr(NG_CHR_UUID_LE);
bool bleOk = false;

// --------------------------- Cardiac state ----------------------------------
uint32_t lastBeatMs   = 0;
uint16_t rrBuf[RR_WINDOW]; int rrCount = 0;
uint16_t currentBpm    = 0;
uint16_t lastRrMs      = 0;
bool     fingerPresent = false;
uint32_t lastIr        = 0;
uint32_t lastBeatSeenMs = 0;   // freshness gate for per-beat HR

// SpO2 rolling buffer (100 samples ~ 1 s at 100 Hz)
static const int BUFLEN = 100;
uint32_t irBuf[BUFLEN], redBuf[BUFLEN];
int  bufIdx = 0;
bool bufFilled = false;

int32_t spo2Value = -1, hrFromSpo2 = -1;
int8_t  spo2Valid = 0, hrValid = 0;
uint32_t lastSpo2Ms = 0;

// --------------------------- Motion state -----------------------------------
uint32_t lastMpuMs = 0;
uint32_t lastMotionMs = 0;
bool     motionActive = false;
float    accelScale = 1.0f;   // gravity-based auto-gain (see calibrateAccel)

// --------------------------- Custom beat detector state ---------------------
// Adaptive-threshold detector on the IR channel — much more robust for
// wrist/foot PPG than SparkFun's per-sample checkForBeat().
float    irEma = 0;
float    acEnvelope = 0;
uint32_t lastCustBeatMs = 0;
bool     beatArmed = false;

struct MotionEvent { uint32_t t_ms; };
MotionEvent motionEvents[MAX_MOTION_EVENTS]; int nMotion = 0;

// simple 1-second RMS accumulator for activity index
double   rmsAcc = 0.0;
int      rmsN   = 0;
float    activityIndex = 0.0f;
uint32_t lastRmsMs = 0;

float    lastPitch = 0, lastRoll = 0;

// --------------------------- Packet output ----------------------------------
BraceletPacket lastPacket{};
uint32_t lastPacketMs = 0;

// ============================================================================
//  Helpers
// ============================================================================
void i2cScan() {
  Serial.print("[i2c] scan: ");
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.print("0x"); if (a < 16) Serial.print('0'); Serial.print(a, HEX); Serial.print(' ');
      found++;
    }
  }
  if (!found) Serial.print("(no devices answered)");
  Serial.println();
}

// ---------------- HRV -------------------------------------------------------
void addRR(uint16_t ms) {
  if (ms < RR_MIN_MS || ms > RR_MAX_MS) return;
  if (rrCount < RR_WINDOW) rrBuf[rrCount++] = ms;
  else {
    for (int i = 1; i < RR_WINDOW; i++) rrBuf[i-1] = rrBuf[i];
    rrBuf[RR_WINDOW - 1] = ms;
  }
}

void computeHRV(BraceletPacket& p) {
  p.rr_mean_ms = 0; p.sdnn_ms = 0; p.rmssd_ms = 0; p.pnn50_pct = 0;
  if (rrCount < 2) return;
  double sum = 0;
  for (int i = 0; i < rrCount; i++) sum += rrBuf[i];
  double mean = sum / rrCount;
  p.rr_mean_ms = (uint16_t)(mean + 0.5);

  double var = 0;
  for (int i = 0; i < rrCount; i++) { double d = rrBuf[i] - mean; var += d*d; }
  p.sdnn_ms = (float)sqrt(var / rrCount);

  double sumSqDiff = 0;
  int nn50 = 0;
  for (int i = 1; i < rrCount; i++) {
    double diff = (double)rrBuf[i] - (double)rrBuf[i-1];
    sumSqDiff += diff * diff;
    if (fabs(diff) > 50.0) nn50++;
  }
  p.rmssd_ms  = (float)sqrt(sumSqDiff / (rrCount - 1));
  p.pnn50_pct = (uint8_t)((100.0 * nn50) / (rrCount - 1));
}

// ---------------- SpO2 ------------------------------------------------------
void pushPpgSample(uint32_t ir, uint32_t red) {
  irBuf[bufIdx]  = ir;
  redBuf[bufIdx] = red;
  bufIdx = (bufIdx + 1) % BUFLEN;
  if (bufIdx == 0) bufFilled = true;
}

void recomputeSpo2() {
  if (!bufFilled) return;
  // unroll ring → linear arrays for the algorithm
  static uint32_t lin_ir[BUFLEN], lin_red[BUFLEN];
  int start = bufIdx;
  for (int i = 0; i < BUFLEN; i++) {
    lin_ir[i]  = irBuf[(start + i) % BUFLEN];
    lin_red[i] = redBuf[(start + i) % BUFLEN];
  }
  maxim_heart_rate_and_oxygen_saturation(
    lin_ir, BUFLEN, lin_red,
    &spo2Value, &spo2Valid, &hrFromSpo2, &hrValid);
}

// ---------------- Custom beat detector --------------------------------------
// Feeds the same lastRrMs / currentBpm / RR ring buffer that per-beat HR + HRV
// stats read from. Uses EMA baseline for DC removal + an adaptive envelope for
// threshold. Refractory period = 350 ms (max ~170 bpm).
void customBeatDetect(uint32_t ir, uint32_t now) {
  if (irEma == 0) { irEma = ir; return; }
  irEma = 0.98f * irEma + 0.02f * (float)ir;
  float ac = (float)ir - irEma;

  // Positive-peak envelope with slow decay
  if (ac > acEnvelope) acEnvelope = ac;
  else                 acEnvelope *= 0.9995f;

  if (acEnvelope < 30.0f) return;              // signal too weak — no beat
  float threshold = acEnvelope * 0.5f;

  if (!beatArmed && ac >= threshold) {
    if (lastCustBeatMs > 0 && (now - lastCustBeatMs) > 350) {
      uint32_t delta = now - lastCustBeatMs;
      if (delta > RR_MIN_MS && delta < RR_MAX_MS) {
        lastRrMs       = (uint16_t)delta;
        currentBpm     = (uint16_t)(60000.0f / delta);
        lastBeatSeenMs = now;
        addRR(lastRrMs);
        Serial.print("  + BEAT  RR="); Serial.print(delta);
        Serial.print(" ms  HR="); Serial.print(currentBpm); Serial.println(" bpm");
      }
      lastCustBeatMs = now;
      beatArmed = true;
    } else if (lastCustBeatMs == 0) {
      lastCustBeatMs = now;                    // seed on first crossing
      beatArmed = true;
    }
  } else if (beatArmed && ac < threshold * 0.3f) {
    beatArmed = false;                         // ready for next beat
  }
}

// ---------------- Motion ----------------------------------------------------
void calibrateAccel() {
  // Assumes sensor is roughly still for ~0.6 s during boot. Averages the raw
  // magnitude and derives a gain so |a|_static ≈ 9.80665 m/s^2. This works
  // around MPU6050 clones that acknowledge range writes but don't honour them.
  const int N = 30;
  double sum = 0;
  int    n   = 0;
  for (int i = 0; i < N; i++) {
    sensors_event_t a, g, t;
    if (mpu.getEvent(&a, &g, &t)) {
      float ax = a.acceleration.x, ay = a.acceleration.y, az = a.acceleration.z;
      sum += sqrt(ax*ax + ay*ay + az*az);
      n++;
    }
    delay(20);
  }
  if (n == 0) return;
  double avg = sum / n;
  Serial.print("Accel calibration: raw |a|_avg = ");
  Serial.print(avg, 2); Serial.print(" m/s^2");
  if (avg > 5.0 && avg < 15.0) {
    accelScale = 1.0f;
    Serial.println("  (looks correct — no gain change)");
  } else {
    accelScale = (float)(9.80665 / avg);
    Serial.print("  → auto-gain × ");
    Serial.println(accelScale, 4);
  }
}

uint8_t classifyPosture(float pitch, float roll) {
  // Foot orientation, not body posture — descriptive only.
  if (fabs(pitch) < 20 && fabs(roll) < 20)  return POS_FLAT;
  if (roll >  60)  return POS_TILT_RIGHT;
  if (roll < -60)  return POS_TILT_LEFT;
  if (pitch >  60) return POS_TOE_UP;
  if (pitch < -60) return POS_TOE_DOWN;
  return POS_TILTED;
}

const char* postureLabel(uint8_t p) {
  switch (p) {
    case POS_FLAT:       return "flat";
    case POS_TILT_LEFT:  return "tilted left";
    case POS_TILT_RIGHT: return "tilted right";
    case POS_TOE_UP:     return "toe up";
    case POS_TOE_DOWN:   return "toe down";
    case POS_TILTED:     return "tilted";
    default:             return "unknown";
  }
}

const char* hrSrcLabel(uint8_t s) {
  switch (s) { case HRSRC_BEAT: return "beat"; case HRSRC_ALGO: return "algo"; default: return "--"; }
}

void processMotion(const sensors_event_t& a, uint32_t now) {
  float ax = a.acceleration.x * accelScale;
  float ay = a.acceleration.y * accelScale;
  float az = a.acceleration.z * accelScale;
  float mag = sqrtf(ax*ax + ay*ay + az*az);       // m/s^2, includes gravity
  // Reject bogus samples. After auto-cal, real |a| is ~9.8 m/s^2 at rest and up
  // to ~40 m/s^2 in vigorous motion. Anything outside this range is discarded.
  if (mag < 3.0f || mag > 60.0f) return;
  float net = fabsf(mag - 9.80665f) / 9.80665f;   // in g

  // 1 s RMS activity index
  rmsAcc += net * net; rmsN++;
  if (now - lastRmsMs >= 1000) {
    activityIndex = (rmsN > 0) ? sqrtf((float)(rmsAcc / rmsN)) : 0.0f;
    rmsAcc = 0; rmsN = 0; lastRmsMs = now;
  }

  // motion event detection
  if (!motionActive) {
    if (net >= MOTION_THRESH_G && (now - lastMotionMs) > MOTION_REFRACT_MS) {
      motionActive = true;
      lastMotionMs = now;
      if (nMotion < MAX_MOTION_EVENTS) motionEvents[nMotion++] = {now};
      Serial.print("  + MOVE  |a|="); Serial.print(net, 2); Serial.println(" g");
    }
  } else if (net < MOTION_THRESH_G * 0.5f) {
    motionActive = false;
  }

  // orientation
  lastPitch = atan2f(ay, sqrtf(ax*ax + az*az)) * 180.0f / (float)PI;
  lastRoll  = atan2f(-ax, az)                   * 180.0f / (float)PI;

  // trim old events
  int keep = 0;
  for (int i = 0; i < nMotion; i++)
    if (now - motionEvents[i].t_ms <= WINDOW_MS) motionEvents[keep++] = motionEvents[i];
  nMotion = keep;
}

// ---------------- Packet build + print --------------------------------------
void buildPacket(uint32_t now, BraceletPacket& p) {
  p.ts_ms          = now;
  p.finger_present = fingerPresent ? 1 : 0;
  p.ir_raw         = lastIr;
  p.rr_last_ms     = lastRrMs;

  // computeHRV expects the same field names — they're preserved in the wire struct.
  computeHRV(p);

  bool beatFresh = fingerPresent && currentBpm > 0 && (now - lastBeatSeenMs) < 4000;
  if (beatFresh) {
    p.hr_bpm = currentBpm;
    p.hr_src = HRSRC_BEAT;
  } else if (fingerPresent && hrValid && hrFromSpo2 > 0) {
    p.hr_bpm = (uint16_t)hrFromSpo2;
    p.hr_src = HRSRC_ALGO;
  } else {
    p.hr_bpm = 0;
    p.hr_src = HRSRC_NONE;
  }

  p.spo2_pct   = (spo2Valid && spo2Value > 0) ? (int8_t)spo2Value : -1;
  p.spo2_valid = (spo2Valid && spo2Value > 0 && fingerPresent) ? 1 : 0;

  p.activity_index         = activityIndex;
  p.pitch_x10              = (int16_t)(lastPitch * 10.0f);
  p.roll_x10               = (int16_t)(lastRoll  * 10.0f);
  p.posture                = classifyPosture(lastPitch, lastRoll);
  p.motion_events_min      = nMotion;
  uint32_t sinceMs         = (lastMotionMs > 0) ? (now - lastMotionMs) : now;
  p.seconds_since_movement = sinceMs / 1000;
  p.stillness_alert        = (p.seconds_since_movement >= STILL_ALERT_SEC) ? 1 : 0;
}

void printPacket(const BraceletPacket& p) {
  Serial.println();
  Serial.print("=== NeuroGuard Bracelet  t=");
  Serial.print(p.ts_ms / 1000.0f, 1); Serial.println(" s ===");

  Serial.print("[CARDIO] finger=");    Serial.print(p.finger_present ? "yes" : "no ");
  Serial.print(" IR=");                Serial.print(p.ir_raw);
  Serial.print(" HR=");                Serial.print(p.hr_bpm);       Serial.print(" bpm(");
  Serial.print(hrSrcLabel(p.hr_src));                                 Serial.print(")");
  Serial.print(" RRlast=");            Serial.print(p.rr_last_ms);   Serial.print(" ms");
  Serial.print(" RRmean=");            Serial.print(p.rr_mean_ms);   Serial.print(" ms");
  Serial.print(" SpO2=");
    if (p.spo2_valid) { Serial.print(p.spo2_pct); Serial.print(" %"); }
    else              { Serial.print("--"); }
  Serial.println();

  Serial.print("[HRV]    SDNN=");      Serial.print(p.sdnn_ms, 1);   Serial.print(" ms");
  Serial.print(" RMSSD=");             Serial.print(p.rmssd_ms, 1);  Serial.print(" ms");
  Serial.print(" pNN50=");             Serial.print(p.pnn50_pct);    Serial.print(" %");
  Serial.print(" (n=");                Serial.print(rrCount);        Serial.println(" beats)");

  Serial.print("[MOTION] act=");       Serial.print(p.activity_index, 3); Serial.print(" g");
  Serial.print(" events/min=");        Serial.print(p.motion_events_min);
  Serial.print(" stillFor=");          Serial.print(p.seconds_since_movement); Serial.print(" s");
  Serial.print(" posture=");           Serial.print(postureLabel(p.posture));
  Serial.print(" (pitch=");            Serial.print(p.pitch_x10 / 10);
  Serial.print(" roll=");              Serial.print(p.roll_x10  / 10);  Serial.print(")");
  if (p.stillness_alert) Serial.print("  !! STILLNESS");
  Serial.println();
}

// Also fix printPacket's [CARDIO] hr_src line: uint8_t now, need label.
// (Retained here as a helper for the existing print above.)

// ---------------- Sensor init -----------------------------------------------
bool initPpg() {
  if (!ppg.begin(Wire, I2C_SPEED_FAST)) return false;
  // Default configuration — Red + IR, 400 Hz, average 4, 411 μs pulse, 4096 nA
  byte ledBrightness = 60;   // 0=off ~ 255=max
  byte sampleAverage = 4;
  byte ledMode       = 2;    // 1=Red only, 2=Red+IR, 3=Red+IR+Green
  int  sampleRate    = 100;
  int  pulseWidth    = 411;
  int  adcRange      = 4096;
  ppg.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  ppg.setPulseAmplitudeRed(0x0A);
  ppg.setPulseAmplitudeIR(0x24);
  return true;
}

bool initMpu() {
  if (!mpu.begin(0x68)) return false;
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  return true;
}

// ============================================================================
//  Setup
// ============================================================================
void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {}

  pinMode(PIN_MAX_INT, INPUT);
  pinMode(PIN_MPU_INT, INPUT);

  Wire.begin();               // nRF52 core: SDA/SCL fixed to D4/D5 by variant
  Wire.setClock(400000);
  delay(50);

  Serial.println();
  Serial.println("################################################");
  Serial.println("#  NeuroGuard  —  Unit 2: Foot Bracelet Node   #");
  Serial.println("################################################");

  i2cScan();

  for (int i = 0; i < 5 && !ppgOk; i++) { ppgOk = initPpg(); if (!ppgOk) delay(150); }
  for (int i = 0; i < 5 && !mpuOk; i++) { mpuOk = initMpu(); if (!mpuOk) delay(150); }

  Serial.print("MAX30102 @0x57 : "); Serial.println(ppgOk ? "OK" : "NOT FOUND");
  Serial.print("MPU-6050 @0x68 : "); Serial.println(mpuOk ? "OK" : "NOT FOUND");

  if (mpuOk) calibrateAccel();          // gravity-based auto-gain — keep still 1 s

  // ---- BLE peripheral (Bluefruit / SoftDevice) ----
  Bluefruit.configPrphBandwidth(BANDWIDTH_HIGH);   // negotiate ATT MTU up to 247
  Bluefruit.begin();
  // +8 dBm is the nRF52840 maximum: extra link margin for a foot that is
  // moving, under a blanket, or turned away from the hub.
  Bluefruit.setTxPower(8);
  Bluefruit.setName("NG-Bracelet");
  // Preferred link params, matching what the hub requests after connecting:
  // one packet per second needs nothing faster than 50–100 ms, and a 6 s
  // supervision timeout rides out RF fades (the library default is 2 s).
  Bluefruit.Periph.setConnIntervalMS(50, 100);
  Bluefruit.Periph.setConnSupervisionTimeoutMS(6000);
  Bluefruit.Periph.setConnectCallback([](uint16_t h){
    Serial.print("[BLE] central connected, handle="); Serial.print(h);
    BLEConnection* c = Bluefruit.Connection(h);
    if (c) {
      Serial.print(" interval="); Serial.print(c->getConnectionInterval() * 1.25f);
      Serial.print(" ms, timeout="); Serial.print(c->getSupervisionTimeout() * 10);
      Serial.print(" ms");
    }
    Serial.println();
  });
  Bluefruit.Periph.setDisconnectCallback([](uint16_t h, uint8_t r){
    // 0x08 = supervision timeout (signal lost), 0x13 = hub closed the link,
    // 0x3E = connection failed to establish.
    Serial.print("[BLE] central disconnected, reason=0x"); Serial.println(r, HEX);
  });

  neuroguardSvc.begin();

  braceletChr.setProperties(CHR_PROPS_NOTIFY | CHR_PROPS_READ);
  braceletChr.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  braceletChr.setFixedLen(sizeof(BraceletWire));
  braceletChr.begin();
  BraceletWire zero{};
  braceletChr.write((uint8_t*)&zero, sizeof(zero));

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(neuroguardSvc);
  Bluefruit.Advertising.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  // Fast advertising for the first 60 s after (re)disconnect, then slow.
  // Numbers are in 0.625 ms units.
  //   fast: 32  → 20 ms   (rediscovery in <100 ms typical)
  //   slow: 244 → 152 ms  (long-term background)
  Bluefruit.Advertising.setInterval(32, 244);
  Bluefruit.Advertising.setFastTimeout(60);     // stay in fast mode 60 s after disconnect
  Bluefruit.Advertising.start(0);               // 0 = advertise forever
  bleOk = true;
  Serial.println("[BLE] advertising as NG-Bracelet (Bluefruit)");

  Serial.println("Streaming packets every 1 s; event markers printed live.");
}

// ============================================================================
//  Loop
// ============================================================================
void loop() {
  uint32_t now = millis();

  // ---- PPG: drain every available FIFO sample ----
  if (ppgOk) {
    ppg.check();
    while (ppg.available()) {
      uint32_t ir  = ppg.getIR();
      uint32_t red = ppg.getRed();
      pushPpgSample(ir, red);

      lastIr = ir;
      fingerPresent = (ir > FINGER_MIN_IR);
      if (fingerPresent) {
        customBeatDetect(ir, now);          // adaptive-threshold beat detector
      } else {
        currentBpm = 0;
        // reset detector state so a fresh contact starts clean
        irEma = 0; acEnvelope = 0; beatArmed = false; lastCustBeatMs = 0;
      }
      ppg.nextSample();
    }
  }

  // ---- IMU: 50 Hz ----
  if (mpuOk && (now - lastMpuMs >= MPU_PERIOD_MS)) {
    lastMpuMs = now;
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    processMotion(a, now);
  }

  // ---- SpO2: recompute every 3 s ----
  if (ppgOk && (now - lastSpo2Ms >= SPO2_PERIOD_MS)) {
    lastSpo2Ms = now;
    if (fingerPresent) recomputeSpo2();
    else { spo2Valid = 0; spo2Value = -1; }
  }

  // ---- Packet emission ----
  if (now - lastPacketMs >= PACKET_PERIOD_MS) {
    lastPacketMs = now;
    buildPacket(now, lastPacket);
    printPacket(lastPacket);
    if (bleOk) {
      // notify() sends to any subscribed central; write() also caches the
      // latest value so a fresh read after connect gets current data.
      braceletChr.write((uint8_t*)&lastPacket, sizeof(lastPacket));
      if (Bluefruit.connected()) braceletChr.notify((uint8_t*)&lastPacket, sizeof(lastPacket));
    }
  }
  // Bluefruit runs BLE housekeeping on the SoftDevice — no poll() needed.
}
