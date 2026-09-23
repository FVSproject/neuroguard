// ============================================================================
//  NeuroGuard  —  Unit 1: Smart Pacifier Node (Seeed XIAO ESP32-S3)
//  Multi-sensor monitor for NNS dynamics, respiratory biomarkers, and ambient
//  air, contributing to detection of arousal dysfunction associated with SIDS.
//
//  Sensors on this node:
//    D1  RFP-602 FSR    → intra-oral sucking pressure (NNS dynamics)
//    D2  MAX4466 mic    → airflow / breathing sounds (respiratory rate, apnea)
//    D4  I2C SDA  ┐
//    D5  I2C SCL  ┘    → ENS160 (eCO2 / TVOC / AQI) + AHT21 (T / RH)
//
//  Wiring:
//    RFP-602:   3V3 ── 47kΩ ── D1 ── RFP-602 ── GND   (pull-up divider)
//    MAX4466:   VCC→3V3, GND→GND, OUT→D2
//    ENS160+AHT21: VCC→3V3, GND→GND, SDA→D4, SCL→D5, ADDR→GND (ENS160 @0x52)
//
//  Libraries (Library Manager):
//    - ScioSense ENS160  (ScioSense)
//    - Adafruit AHTX0    (Adafruit)  + BusIO + Unified Sensor
//    (WiFi + WebServer come with the ESP32 core.)
//
//  Board:  XIAO_ESP32S3   |   Serial: 115200 baud, USB CDC On Boot = Enabled
//
//  ---------------------------------------------------------------------------
//  Web dashboard (SoftAP mode):
//    Connect a phone/laptop to WiFi:  "NeuroGuard-Pacifier"  (password below)
//    then open  http://192.168.4.1  in a browser.
//  ---------------------------------------------------------------------------
//
//  NOTE: at boot, keep pacifier UNPRESSED and room QUIET for ~1 s
//        (FSR baseline + mic warm-up are captured then).
// ============================================================================

#include <Wire.h>
#include <math.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ScioSense_ENS160.h>
#include <Adafruit_AHTX0.h>

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#include "web.h"

// ---------------------------- WiFi AP ---------------------------------------
const char* AP_SSID = "NeuroGuard-Pacifier";
const char* AP_PASS = "neuroguard";       // >= 8 chars, or "" for open network
const int   AP_CHAN = 6;
WebServer server(80);

// ---------------------------- Forward declarations --------------------------
// Needed so the Arduino IDE's auto-generated prototypes for functions that take
// Event*/PacifierPacket& see these types even before their full definitions
// appear further down in the file.
struct Event;
struct PacifierPacket;

// ---------------------------- BLE link (Unit 2 bracelet) --------------------
// Byte-exact mirror of BraceletWire in NeuroGuard_Unit2.ino. Do NOT reorder.
enum PostureCode : uint8_t {
  POS_UNKNOWN = 0, POS_FLAT, POS_TILT_LEFT, POS_TILT_RIGHT,
  POS_TOE_UP, POS_TOE_DOWN, POS_TILTED
};
enum HrSource : uint8_t { HRSRC_NONE = 0, HRSRC_BEAT = 1, HRSRC_ALGO = 2 };

struct __attribute__((packed)) BraceletWire {
  uint32_t ts_ms;
  uint8_t  finger_present;
  uint32_t ir_raw;
  uint16_t hr_bpm;
  uint8_t  hr_src;
  uint16_t rr_last_ms;
  uint16_t rr_mean_ms;
  float    sdnn_ms;
  float    rmssd_ms;
  uint8_t  pnn50_pct;
  int8_t   spo2_pct;
  uint8_t  spo2_valid;
  float    activity_index;
  int16_t  pitch_x10;
  int16_t  roll_x10;
  uint8_t  posture;
  uint16_t motion_events_min;
  uint16_t seconds_since_movement;
  uint8_t  stillness_alert;
};
static_assert(sizeof(BraceletWire) == 41, "BraceletWire layout drifted");

static BLEUUID NG_SVC_UUID("a1b2c3d4-9999-4a2b-9c1e-1a2b3c4d5e6f");
static BLEUUID NG_CHR_UUID("a1b2c3d5-9999-4a2b-9c1e-1a2b3c4d5e6f");

BraceletWire lastBracelet{};
volatile uint32_t lastBraceletMs = 0;
bool bleConnected = false;
bool bleScanning  = false;
BLEClient*                pBleClient  = nullptr;
BLERemoteCharacteristic*  pBleChr     = nullptr;
BLEAdvertisedDevice*      pBleTarget  = nullptr;

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

// ---------------------------- Pins ------------------------------------------
const int FSR_PIN = D1;
const int MIC_PIN = D2;

// ---------------------------- FSR / NNS -------------------------------------
const float   R_DIV_OHM        = 47000.0f;
const int     FSR_DEADBAND     = 20;
const int     FSR_FULL_SCALE   = 3800;    // raw drop that maps to 100 %
// Same thresholds as NeuroGuard_Hub_BLE.ino — see the comment there.
const float   SUCK_ON_PCT      = 25.0f;   // rising threshold to register suck
const float   SUCK_OFF_PCT     = 15.0f;   // release; 10-point gap stops double counts
const uint32_t BURST_GAP_MS    = 1500;    // inter-suck gap > this ⇒ new burst

// --------------------------- Mic / Respiration ------------------------------
const uint32_t MIC_WINDOW_MS      = 50;   // pk-pk sampling window
// 17 % of the 12-bit ADC's 2048 half-swing → 348, rounded to 350.
// Matches the color-transition point of the MicLevel meter in the web app;
// keep both in sync so the parent sees the bar turn teal exactly when
// firmware fires a breath event.
const int      BREATH_ON_PKPK     = 350;  // ~17 % pk-pk to register a resp event
const int      BREATH_OFF_PKPK    = 175;  // hysteresis at half of ON
const uint32_t BREATH_REFRACT_MS  = 250;  // minimum spacing between events
const uint32_t APNEA_ALERT_SEC    = 10;   // demo threshold (clinical ~20 s)

// --------------------------- Rolling window ---------------------------------
const uint32_t WINDOW_MS          = 60000;   // 60 s
const uint32_t ENV_PERIOD_MS      = 1000;    // ENS/AHT update cadence
const uint32_t PACKET_PERIOD_MS   = 1000;    // downstream packet cadence
const int      MAX_EVENTS         = 160;     // ring buffer capacity per stream

// --------------------------- Data model -------------------------------------
struct PacifierPacket {
  uint32_t ts_ms;
  // NNS dynamics
  float    fsr_pct_now;
  uint16_t sucks_per_min;
  uint16_t bursts_per_min;
  float    mean_peak_pct;
  float    mean_burst_sec;
  float    regularity_cv;      // CV of intra-burst inter-suck intervals
  // Respiratory
  uint16_t mic_pkpk_now;
  uint16_t resp_events_per_min;   // raw envelope events
  uint16_t est_breaths_per_min;   // ≈ events / 2  (inhale + exhale)
  uint16_t seconds_since_last_breath;
  bool     apnea_alert;
  // Environmental
  float    temp_c;
  float    rh_pct;
  uint16_t eco2_ppm;
  uint16_t tvoc_ppb;
  uint8_t  aqi;                // 1..5
};

struct Event { uint32_t t_ms; float val; };

// --------------------------- Globals ----------------------------------------
ScioSense_ENS160 ens160(ENS160_I2CADDR_0);   // 0x52 (ADDR→GND)
Adafruit_AHTX0   aht;
bool ensOk = false, ahtOk = false;

int      fsrBaseline = 4095;

Event    suckEvents[MAX_EVENTS];   int nSuck = 0;
Event    breathEvents[MAX_EVENTS]; int nBreath = 0;

bool     suckActive     = false;
float    suckPeakPct    = 0.0f;
bool     breathActive   = false;
uint32_t lastBreathMs   = 0;

float    lastTempC = 25.0f, lastRH = 50.0f;
uint16_t lastECO2  = 0, lastTVOC = 0;
uint8_t  lastAQI   = 0;

uint32_t lastEnvMs = 0, lastPacketMs = 0;

// Shared snapshot for the web dashboard (updated at PACKET_PERIOD_MS cadence).
PacifierPacket lastPacket{};

// --------------------------- Helpers ----------------------------------------
int readFsrAveraged(int n = 8) {
  uint32_t acc = 0;
  for (int i = 0; i < n; i++) { acc += analogRead(FSR_PIN); delayMicroseconds(500); }
  return acc / n;
}

int readMicPkPk() {
  uint32_t t0 = millis();
  int mn = 4095, mx = 0;
  while (millis() - t0 < MIC_WINDOW_MS) {
    int s = analogRead(MIC_PIN);
    if (s < mn) mn = s;
    if (s > mx) mx = s;
  }
  return mx - mn;
}

float rawToFsrPct(int raw) {
  int drop = fsrBaseline - raw;
  if (drop < FSR_DEADBAND) drop = 0;
  float pct = (drop * 100.0f) / (float)FSR_FULL_SCALE;
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void trimOld(Event* buf, int& n, uint32_t now) {
  int keep = 0;
  for (int i = 0; i < n; i++) {
    if (now - buf[i].t_ms <= WINDOW_MS) buf[keep++] = buf[i];
  }
  n = keep;
}

void pushEvent(Event* buf, int& n, uint32_t t, float v) {
  if (n < MAX_EVENTS) { buf[n++] = {t, v}; return; }
  // buffer full — drop oldest
  for (int i = 1; i < MAX_EVENTS; i++) buf[i-1] = buf[i];
  buf[MAX_EVENTS - 1] = {t, v};
}

// --------------------------- Suck detector ----------------------------------
void updateSuckDetector(float pct, uint32_t now) {
  if (!suckActive) {
    if (pct >= SUCK_ON_PCT) {
      suckActive  = true;
      suckPeakPct = pct;
    }
  } else {
    if (pct > suckPeakPct) suckPeakPct = pct;
    if (pct <= SUCK_OFF_PCT) {
      pushEvent(suckEvents, nSuck, now, suckPeakPct);
      Serial.print("  + SUCK   peak=");
      Serial.print(suckPeakPct, 1); Serial.println(" %");
      suckActive = false;
    }
  }
}

// --------------------------- Breath detector --------------------------------
void updateBreathDetector(int pkpk, uint32_t now) {
  if (!breathActive) {
    if (pkpk >= BREATH_ON_PKPK && (now - lastBreathMs) > BREATH_REFRACT_MS) {
      breathActive  = true;
      lastBreathMs  = now;
      pushEvent(breathEvents, nBreath, now, (float)pkpk);
      Serial.print("  + BREATH pkpk=");
      Serial.println(pkpk);
    }
  } else if (pkpk <= BREATH_OFF_PKPK) {
    breathActive = false;
  }
}

// --------------------------- Metrics ----------------------------------------
void computeNNS(uint32_t now, PacifierPacket& p) {
  p.sucks_per_min  = nSuck;
  p.bursts_per_min = 0;
  p.mean_peak_pct  = 0;
  p.mean_burst_sec = 0;
  p.regularity_cv  = 0;
  if (nSuck == 0) return;

  float sumPeak = 0;
  for (int i = 0; i < nSuck; i++) sumPeak += suckEvents[i].val;
  p.mean_peak_pct = sumPeak / nSuck;

  int bursts = 1;
  uint32_t burstStart = suckEvents[0].t_ms;
  uint32_t burstLast  = suckEvents[0].t_ms;
  float totalBurstMs  = 0;

  int isiN = 0;
  double isiSum = 0, isiSumSq = 0;

  for (int i = 1; i < nSuck; i++) {
    uint32_t gap = suckEvents[i].t_ms - burstLast;
    if (gap > BURST_GAP_MS) {
      totalBurstMs += (burstLast - burstStart);
      bursts++;
      burstStart = suckEvents[i].t_ms;
    } else {
      isiSum   += (double)gap;
      isiSumSq += (double)gap * (double)gap;
      isiN++;
    }
    burstLast = suckEvents[i].t_ms;
  }
  totalBurstMs += (burstLast - burstStart);

  p.bursts_per_min = bursts;
  p.mean_burst_sec = (float)(totalBurstMs / bursts) / 1000.0f;
  if (isiN > 1) {
    double mean = isiSum / isiN;
    double var  = (isiSumSq / isiN) - mean * mean;
    if (var < 0) var = 0;
    double sd   = sqrt(var);
    p.regularity_cv = (mean > 0) ? (float)(sd / mean) : 0.0f;
  }
}

void computeResp(uint32_t now, PacifierPacket& p) {
  p.resp_events_per_min = nBreath;
  p.est_breaths_per_min = nBreath / 2;

  uint32_t sinceMs = (lastBreathMs > 0) ? (now - lastBreathMs) : now;
  p.seconds_since_last_breath = sinceMs / 1000;
  p.apnea_alert = (p.seconds_since_last_breath >= APNEA_ALERT_SEC);
}

// --------------------------- Environment ------------------------------------
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

void tryInitEnv(bool verbose = false) {
  if (!ahtOk) {
    ahtOk = aht.begin();
    if (ahtOk && verbose) Serial.println("[env] AHT21 came online.");
  }
  if (!ensOk) {
    ensOk = ens160.begin();
    if (ensOk) {
      ens160.setMode(ENS160_OPMODE_STD);
      if (verbose) Serial.println("[env] ENS160 came online (warming up).");
    }
  }
}

void updateEnvironment() {
  if (!ahtOk || !ensOk) tryInitEnv(true);   // recover from a failed boot probe

  if (ahtOk) {
    sensors_event_t h, t;
    if (aht.getEvent(&h, &t)) {
      lastTempC = t.temperature;
      lastRH    = h.relative_humidity;
    } else {
      ahtOk = false;   // I2C hiccup → force re-probe next tick
    }
  }
  if (ensOk) {
    ens160.set_envdata(lastTempC, lastRH);
    if (ens160.available()) {
      ens160.measure(true);
      lastAQI  = ens160.getAQI();
      lastTVOC = ens160.getTVOC();
      lastECO2 = ens160.geteCO2();
    }
  }
}

// --------------------------- Serial output ----------------------------------
const char* aqiLabel(uint8_t a) {
  switch (a) {
    case 1: return "excellent";
    case 2: return "good";
    case 3: return "moderate";
    case 4: return "poor";
    case 5: return "unhealthy";
    default: return "n/a";
  }
}

void printPacket(const PacifierPacket& p) {
  Serial.println();
  Serial.print("=== NeuroGuard Pacifier  t=");
  Serial.print(p.ts_ms / 1000.0f, 1); Serial.println(" s ===");

  Serial.print("[NNS]   fsr_now=");    Serial.print(p.fsr_pct_now, 1);   Serial.print("% ");
  Serial.print(" sucks/min=");         Serial.print(p.sucks_per_min);
  Serial.print(" bursts/min=");        Serial.print(p.bursts_per_min);
  Serial.print(" meanPeak=");          Serial.print(p.mean_peak_pct, 1); Serial.print("%");
  Serial.print(" meanBurst=");         Serial.print(p.mean_burst_sec, 2); Serial.print("s");
  Serial.print(" regularityCV=");      Serial.println(p.regularity_cv, 3);

  Serial.print("[RESP]  mic_pkpk=");   Serial.print(p.mic_pkpk_now);
  Serial.print(" respEvents/min=");    Serial.print(p.resp_events_per_min);
  Serial.print(" ~breaths/min=");      Serial.print(p.est_breaths_per_min);
  Serial.print(" lastBreath=");        Serial.print(p.seconds_since_last_breath); Serial.print("s ago");
  if (p.apnea_alert) Serial.print("  !! APNEA");
  Serial.println();

  Serial.print("[ENV]   AHT=");        Serial.print(ahtOk ? "OK" : "--");
  Serial.print(" ENS=");               Serial.print(ensOk ? "OK" : "--");
  Serial.print("  T=");                Serial.print(p.temp_c, 1);  Serial.print(" C");
  Serial.print(" RH=");                Serial.print(p.rh_pct, 1);  Serial.print(" %");
  Serial.print(" eCO2=");              Serial.print(p.eco2_ppm);   Serial.print(" ppm");
  Serial.print(" TVOC=");              Serial.print(p.tvoc_ppb);   Serial.print(" ppb");
  Serial.print(" AQI=");               Serial.print(p.aqi);        Serial.print(" (");
  Serial.print(aqiLabel(p.aqi));                                    Serial.println(")");
}

// ============================================================================
//  Web dashboard (SoftAP + HTTP)
// ============================================================================
void handleIndex() {
  server.sendHeader("Cache-Control", "no-store");
  server.send_P(200, "text/html; charset=utf-8", INDEX_HTML);
}

void handleData() {
  const PacifierPacket& p = lastPacket;
  const BraceletWire&   b = lastBracelet;
  uint32_t nowMs = millis();
  uint32_t bAgeS = (lastBraceletMs > 0) ? (nowMs - lastBraceletMs) / 1000 : 999;
  bool bLinked  = bleConnected && (lastBraceletMs > 0) && (bAgeS < 5);

  char buf[1400];
  snprintf(buf, sizeof(buf),
    "{\"ts\":%lu,"
    "\"nns\":{\"fsr_now\":%.1f,\"sucks_per_min\":%u,\"bursts_per_min\":%u,"
      "\"mean_peak_pct\":%.1f,\"mean_burst_sec\":%.2f,\"regularity_cv\":%.3f},"
    "\"resp\":{\"mic_pkpk\":%u,\"events_per_min\":%u,\"breaths_per_min\":%u,"
      "\"since_last_breath_s\":%u,\"apnea\":%s},"
    "\"env\":{\"aht_ok\":%s,\"ens_ok\":%s,\"temp_c\":%.1f,\"rh_pct\":%.1f,"
      "\"eco2_ppm\":%u,\"tvoc_ppb\":%u,\"aqi\":%u},"
    "\"bracelet\":{\"linked\":%s,\"age_s\":%lu,"
      "\"finger\":%s,\"ir_raw\":%lu,"
      "\"hr_bpm\":%u,\"hr_src\":\"%s\","
      "\"rr_last_ms\":%u,\"rr_mean_ms\":%u,"
      "\"sdnn_ms\":%.1f,\"rmssd_ms\":%.1f,\"pnn50_pct\":%u,"
      "\"spo2_pct\":%d,\"spo2_valid\":%s,"
      "\"activity_g\":%.3f,\"pitch_deg\":%d,\"roll_deg\":%d,"
      "\"posture\":\"%s\",\"posture_code\":%u,"
      "\"motion_events_min\":%u,\"still_for_s\":%u,\"stillness_alert\":%s}"
    "}",
    (unsigned long)p.ts_ms,
    p.fsr_pct_now, p.sucks_per_min, p.bursts_per_min,
    p.mean_peak_pct, p.mean_burst_sec, p.regularity_cv,
    p.mic_pkpk_now, p.resp_events_per_min, p.est_breaths_per_min,
    p.seconds_since_last_breath, p.apnea_alert ? "true" : "false",
    ahtOk ? "true" : "false", ensOk ? "true" : "false",
    p.temp_c, p.rh_pct,
    p.eco2_ppm, p.tvoc_ppb, p.aqi,
    bLinked ? "true" : "false", (unsigned long)bAgeS,
    b.finger_present ? "true" : "false", (unsigned long)b.ir_raw,
    b.hr_bpm, hrSrcLabel(b.hr_src),
    b.rr_last_ms, b.rr_mean_ms,
    b.sdnn_ms, b.rmssd_ms, b.pnn50_pct,
    (int)b.spo2_pct, b.spo2_valid ? "true" : "false",
    b.activity_index, b.pitch_x10 / 10, b.roll_x10 / 10,
    postureLabel(b.posture), b.posture,
    b.motion_events_min, b.seconds_since_movement,
    b.stillness_alert ? "true" : "false");
  server.sendHeader("Cache-Control", "no-store");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", buf);
}

// ============================================================================
//  BLE central — subscribes to the bracelet's notification characteristic
// ============================================================================
static void braceletNotifyCB(BLERemoteCharacteristic* c, uint8_t* data, size_t len, bool /*isNotify*/) {
  if (len == sizeof(BraceletWire)) {
    memcpy(&lastBracelet, data, len);
    lastBraceletMs = millis();
  }
}

class NgScanCB : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice adv) override {
    // Verbose: print every advertisement so it's clear whether the bracelet is
    // even visible. Filter to entries that have a name OR a service UUID.
    String name = adv.haveName() ? String(adv.getName().c_str()) : String("");
    if (adv.haveServiceUUID() && adv.isAdvertisingService(NG_SVC_UUID)) {
      Serial.print("[BLE scan] MATCH  "); Serial.print(adv.getAddress().toString().c_str());
      Serial.print("  rssi="); Serial.print(adv.getRSSI());
      Serial.print("  name='"); Serial.print(name); Serial.println("'");
      BLEDevice::getScan()->stop();
      if (pBleTarget) delete pBleTarget;
      pBleTarget = new BLEAdvertisedDevice(adv);
      bleScanning = false;
    } else if (name.length() > 0 || adv.haveServiceUUID()) {
      Serial.print("[BLE scan] seen   "); Serial.print(adv.getAddress().toString().c_str());
      Serial.print("  rssi="); Serial.print(adv.getRSSI());
      Serial.print("  name='"); Serial.print(name); Serial.print("'");
      if (adv.haveServiceUUID()) {
        Serial.print("  svc="); Serial.print(adv.getServiceUUID().toString().c_str());
      }
      Serial.println();
    }
  }
};

class NgClientCB : public BLEClientCallbacks {
  void onConnect(BLEClient* /*c*/) override { Serial.println("[BLE] connected"); }
  void onDisconnect(BLEClient* /*c*/) override {
    bleConnected = false;
    Serial.println("[BLE] disconnected");
  }
};

bool tryConnectBracelet() {
  if (!pBleTarget) return false;
  if (pBleClient) { pBleClient->disconnect(); delete pBleClient; pBleClient = nullptr; }

  Serial.print("[BLE] connecting to "); Serial.println(pBleTarget->getAddress().toString().c_str());
  pBleClient = BLEDevice::createClient();
  pBleClient->setClientCallbacks(new NgClientCB());
  if (!pBleClient->connect(pBleTarget)) {
    Serial.println("[BLE] connect() failed");
    return false;
  }
  Serial.println("[BLE] connect() ok, resolving service…");
  auto svc = pBleClient->getService(NG_SVC_UUID);
  if (!svc) { Serial.println("[BLE] service NOT FOUND on peer"); pBleClient->disconnect(); return false; }
  Serial.println("[BLE] service ok, resolving characteristic…");
  pBleChr = svc->getCharacteristic(NG_CHR_UUID);
  if (!pBleChr) { Serial.println("[BLE] char NOT FOUND"); pBleClient->disconnect(); return false; }
  if (pBleChr->canNotify()) {
    pBleChr->registerForNotify(braceletNotifyCB);
    Serial.println("[BLE] subscribed to notifications");
  } else {
    Serial.println("[BLE] characteristic has no notify property!?");
  }
  bleConnected = true;
  return true;
}

void bleTick() {
  // If we found a target but haven't connected, try now (in the main task —
  // the ESP32 BLE stack is not safe to call from the scan callback).
  if (pBleTarget && !bleConnected) {
    if (tryConnectBracelet()) {
      delete pBleTarget; pBleTarget = nullptr;
    } else {
      delete pBleTarget; pBleTarget = nullptr;
      bleScanning = false;    // will restart below
    }
  }
  // If not connected and not scanning, kick off a scan.
  if (!bleConnected && !bleScanning) {
    BLEScan* s = BLEDevice::getScan();
    s->setActiveScan(true);
    s->setInterval(160);
    s->setWindow(120);
    s->start(0, nullptr, false);   // continuous — CB stops it when found
    bleScanning = true;
    Serial.println("[BLE] scanning for NG-Bracelet…");
  }
}

void startBleCentral() {
  BLEDevice::init("NG-Pacifier");
  BLEDevice::setPower(ESP_PWR_LVL_P9);   // max TX power on this core
  BLEScan* s = BLEDevice::getScan();
  s->setAdvertisedDeviceCallbacks(new NgScanCB(), false);
}

void startWebDashboard() {
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  bool ok = WiFi.softAP(AP_SSID, (strlen(AP_PASS) >= 8) ? AP_PASS : nullptr, AP_CHAN);
  IPAddress ip = WiFi.softAPIP();

  Serial.println();
  Serial.println("---- Web dashboard ----");
  Serial.print("SoftAP  : ");   Serial.print(AP_SSID);
  Serial.print("  ("); Serial.print(ok ? "up" : "FAILED"); Serial.println(")");
  if (strlen(AP_PASS) >= 8) { Serial.print("Password: "); Serial.println(AP_PASS); }
  else                      { Serial.println("Password: (open network)"); }
  Serial.print("Open    : http://"); Serial.println(ip);
  Serial.println("-----------------------");

  server.on("/",     HTTP_GET, handleIndex);
  server.on("/data", HTTP_GET, handleData);
  server.onNotFound([]() { server.send(404, "text/plain", "not found"); });
  server.begin();
}

// ============================================================================
//  Setup
// ============================================================================
void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {}

  analogReadResolution(12);
  analogSetPinAttenuation(FSR_PIN, ADC_11db);
  analogSetPinAttenuation(MIC_PIN, ADC_11db);

  delay(300);
  fsrBaseline = readFsrAveraged(64);
  for (int i = 0; i < 8; i++) { analogRead(MIC_PIN); delay(2); }

  Wire.begin(D4, D5);
  Wire.setClock(100000);
  delay(50);                            // let the I2C devices settle after power-up

  Serial.println();
  Serial.println("################################################");
  Serial.println("#  NeuroGuard  —  Unit 1: Smart Pacifier Node  #");
  Serial.println("################################################");

  i2cScan();                            // expect: 0x38 (AHT21) and 0x52 (ENS160)

  // Retry init up to 5x — some ENS160 modules need a couple of tries after cold boot
  for (int i = 0; i < 5 && (!ahtOk || !ensOk); i++) {
    tryInitEnv(false);
    if (!ahtOk || !ensOk) delay(150);
  }
  Serial.print("AHT21  @0x38 : "); Serial.println(ahtOk ? "OK" : "NOT FOUND");
  Serial.print("ENS160 @0x52 : "); Serial.println(ensOk ? "OK" : "NOT FOUND");
  Serial.print("FSR baseline raw: "); Serial.println(fsrBaseline);
  Serial.println("ENS160 warms up over ~3 min before eCO2/TVOC settle.");
  Serial.println("Streaming packets every 1 s; event markers printed live.");

  startWebDashboard();
  startBleCentral();     // begins scanning for the NG-Bracelet on first bleTick()
}

// ============================================================================
//  Loop
// ============================================================================
void loop() {
  uint32_t now = millis();

  // ---- serve web dashboard clients ----
  server.handleClient();
  bleTick();                        // (re)scan and (re)connect to the bracelet

  // ---- sample ----
  int rawFsr    = readFsrAveraged(8);
  float fsrPct  = rawToFsrPct(rawFsr);
  int micPkPk   = readMicPkPk();

  // ---- event detection ----
  updateSuckDetector(fsrPct, now);
  updateBreathDetector(micPkPk, now);

  // ---- rolling window maintenance ----
  trimOld(suckEvents,   nSuck,   now);
  trimOld(breathEvents, nBreath, now);

  // ---- keep the packet's live fields fresh even between emissions,
  //      so the web dashboard shows real-time FSR% and mic amplitude.
  lastPacket.ts_ms        = now;
  lastPacket.fsr_pct_now  = fsrPct;
  lastPacket.mic_pkpk_now = micPkPk;

  // ---- environmental (throttled) ----
  if (now - lastEnvMs >= ENV_PERIOD_MS) {
    lastEnvMs = now;
    updateEnvironment();
  }

  // ---- packet emission (throttled) ----
  if (now - lastPacketMs >= PACKET_PERIOD_MS) {
    lastPacketMs = now;

    lastPacket.ts_ms        = now;
    lastPacket.fsr_pct_now  = fsrPct;
    lastPacket.mic_pkpk_now = micPkPk;
    lastPacket.temp_c       = lastTempC;
    lastPacket.rh_pct       = lastRH;
    lastPacket.eco2_ppm     = lastECO2;
    lastPacket.tvoc_ppb     = lastTVOC;
    lastPacket.aqi          = lastAQI;
    computeNNS(now,  lastPacket);
    computeResp(now, lastPacket);

    printPacket(lastPacket);
  }
}
