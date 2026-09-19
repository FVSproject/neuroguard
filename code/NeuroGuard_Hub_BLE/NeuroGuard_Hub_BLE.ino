// ============================================================================
//  NeuroGuard  —  Unit 1: Smart Pacifier Hub  (Web-Bluetooth flavour)
//  Seeed XIAO ESP32-S3
//
//  Same sensor set + detection logic as RFP602_Test.ino, but the WiFi SoftAP +
//  embedded web server have been replaced with a BLE peripheral role. The
//  companion Next.js web app subscribes to a single characteristic and gets
//  the combined hub+bracelet snapshot as a 77-byte packed struct every second.
//
//  Sensors on this node:
//    D1  RFP-602 FSR    → intra-oral sucking pressure (NNS dynamics)
//    D2  MAX4466 mic    → airflow / breathing sounds  (respiratory + apnea)
//    D4  I2C SDA  ┐
//    D5  I2C SCL  ┘    → ENS160 (eCO2 / TVOC / AQI) + AHT21 (T / RH)
//
//  Wiring (unchanged from the AP-mode sketch):
//    RFP-602:   3V3 ── 47kΩ ── D1 ── RFP-602 ── GND   (pull-up divider)
//    MAX4466:   VCC→3V3, GND→GND, OUT→D2
//    ENS160+AHT21: VCC→3V3, GND→GND, SDA→D4, SCL→D5, ADDR→GND (ENS160 @0x52)
//
//  Libraries (Library Manager):
//    - ScioSense ENS160  (ScioSense)
//    - Adafruit AHTX0    (Adafruit)  + BusIO + Unified Sensor
//    (BLE stack ships with the ESP32 core — no external library.)
//
//  Board:  XIAO_ESP32S3   |   Serial: 115200 baud, USB CDC On Boot = Enabled
//
//  ---------------------------------------------------------------------------
//  Web app pairing:
//    Open  https://<your-vercel-domain>/live  in Chrome / Edge on Android or
//    desktop, tap "Connect to hub", and pick "NG-Pacifier" from the picker.
//    (iOS Safari is not supported by Web Bluetooth — Apple platform limit.)
//  ---------------------------------------------------------------------------
//
//  NOTE: at boot, keep pacifier UNPRESSED and room QUIET for ~1 s
//        (FSR baseline + mic warm-up are captured then).
// ============================================================================

#include <Wire.h>
#include <math.h>

#include <ScioSense_ENS160.h>
#include <Adafruit_AHTX0.h>

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

// ============================================================================
//  BLE identifiers
// ============================================================================
// Bracelet peer (this hub scans + subscribes)
static BLEUUID NG_BRACELET_SVC_UUID("a1b2c3d4-9999-4a2b-9c1e-1a2b3c4d5e6f");
static BLEUUID NG_BRACELET_CHR_UUID("a1b2c3d5-9999-4a2b-9c1e-1a2b3c4d5e6f");

// Hub's own service exposed to the browser (this device advertises + notifies)
static BLEUUID NG_HUB_WEB_SVC_UUID ("b2c3d4e5-9999-4a2b-9c1e-1a2b3c4d5e6f");
static BLEUUID NG_HUB_WEB_CHR_UUID ("b2c3d4e6-9999-4a2b-9c1e-1a2b3c4d5e6f");
// Command characteristic — browser writes a 1-byte opcode to trigger actions
// on the hub (e.g. drop cached bracelet MAC and restart discovery).
static BLEUUID NG_HUB_CMD_CHR_UUID ("b2c3d4e7-9999-4a2b-9c1e-1a2b3c4d5e6f");

// Command opcodes written by the web app.
enum HubCmd : uint8_t {
  HUB_CMD_RESCAN_BRACELET = 0x01,   // forget cached MAC + restart scan
};

// ============================================================================
//  Wire structs — must stay byte-exact with webapp/src/lib/packet.ts
// ============================================================================
enum PostureCode : uint8_t {
  POS_UNKNOWN = 0, POS_FLAT, POS_TILT_LEFT, POS_TILT_RIGHT,
  POS_TOE_UP, POS_TOE_DOWN, POS_TILTED
};
enum HrSource : uint8_t { HRSRC_NONE = 0, HRSRC_BEAT = 1, HRSRC_ALGO = 2 };

struct __attribute__((packed)) BraceletWire {
  uint32_t ts_ms;                    //  0
  uint8_t  finger_present;           //  4
  uint32_t ir_raw;                   //  5
  uint16_t hr_bpm;                   //  9
  uint8_t  hr_src;                   // 11
  uint16_t rr_last_ms;               // 12
  uint16_t rr_mean_ms;               // 14
  float    sdnn_ms;                  // 16
  float    rmssd_ms;                 // 20
  uint8_t  pnn50_pct;                // 24
  int8_t   spo2_pct;                 // 25
  uint8_t  spo2_valid;               // 26
  float    activity_index;           // 27
  int16_t  pitch_x10;                // 31
  int16_t  roll_x10;                 // 33
  uint8_t  posture;                  // 35
  uint16_t motion_events_min;        // 36
  uint16_t seconds_since_movement;   // 38
  uint8_t  stillness_alert;          // 40
};                                   // 41 bytes total
static_assert(sizeof(BraceletWire) == 41, "BraceletWire drifted");

struct __attribute__((packed)) HubWire {
  uint32_t ts_ms;                    //  0
  uint8_t  fsr_pct_now;              //  4
  uint16_t sucks_per_min;            //  5
  uint16_t bursts_per_min;           //  7
  uint8_t  mean_peak_pct;            //  9
  uint16_t mean_burst_ms;            // 10
  uint16_t regularity_cv_x1000;      // 12
  uint16_t mic_pkpk_now;             // 14
  uint16_t resp_events_per_min;      // 16
  uint16_t est_breaths_per_min;      // 18
  uint16_t seconds_since_last_breath;// 20
  uint8_t  apnea_alert;              // 22
  int16_t  temp_c_x10;               // 23
  uint16_t rh_x10;                   // 25
  uint16_t eco2_ppm;                 // 27
  uint16_t tvoc_ppb;                 // 29
  uint8_t  aqi;                      // 31
};                                   // 32 bytes total
static_assert(sizeof(HubWire) == 32, "HubWire drifted");

struct __attribute__((packed)) CombinedWire {
  HubWire      hub;                  //  0
  uint8_t      bracelet_present;     // 32
  uint16_t     bracelet_age_s;       // 33
  uint8_t      _reserved;            // 35 — keeps BraceletWire on a byte boundary
  BraceletWire bracelet;             // 36
};                                   // 77 bytes total
static_assert(sizeof(CombinedWire) == 77, "CombinedWire drifted");

// ============================================================================
//  Pins + sensor tunables (unchanged from RFP602_Test.ino)
// ============================================================================
const int FSR_PIN = D1;
const int MIC_PIN = D2;

const float    R_DIV_OHM        = 47000.0f;
const int      FSR_DEADBAND     = 20;
const int      FSR_FULL_SCALE   = 3800;
// 8 % rising threshold catches gentle sucks; parents want "every press
// counts". Kept in lockstep with SUCK_ON_PCT in the web app so the meter's
// teal tick lines up with the trigger.
const float    SUCK_ON_PCT      = 8.0f;    // rising threshold to register suck
const float    SUCK_OFF_PCT     = 3.0f;    // hysteresis (~40 % of ON)
const uint32_t BURST_GAP_MS     = 1500;

const uint32_t MIC_WINDOW_MS      = 50;
// 17 % of the 12-bit ADC's 2048 half-swing → 348, rounded to 350.
// Matches the color-transition point of the MicLevel meter in the web app;
// keep both in sync so the parent sees the bar turn teal exactly when
// firmware fires a breath event.
const int      BREATH_ON_PKPK     = 350;   // ~17 % pk-pk
// Tick cadence: fire one breath event every N ms while pk-pk stays above
// BREATH_ON_PKPK. 1000 ms → the "N ev" chip on the web app ticks up by 1
// per second the user is breathing/blowing over the mic threshold.
const uint32_t BREATH_REFRACT_MS  = 1000;
const uint32_t APNEA_ALERT_SEC    = 10;

const uint32_t WINDOW_MS          = 60000;
const uint32_t ENV_PERIOD_MS      = 1000;
const uint32_t PACKET_PERIOD_MS   = 1000;
const int      MAX_EVENTS         = 160;

// ============================================================================
//  Runtime state
// ============================================================================
ScioSense_ENS160 ens160(ENS160_I2CADDR_0);   // 0x52 (ADDR→GND)
Adafruit_AHTX0   aht;
bool ensOk = false, ahtOk = false;

int      fsrBaseline = 4095;

struct Event { uint32_t t_ms; float val; };
Event    suckEvents[MAX_EVENTS];   int nSuck = 0;
Event    breathEvents[MAX_EVENTS]; int nBreath = 0;

bool     suckActive     = false;
float    suckPeakPct    = 0.0f;
uint32_t lastBreathMs   = 0;

float    lastTempC = 25.0f, lastRH = 50.0f;
uint16_t lastECO2  = 0, lastTVOC = 0;
uint8_t  lastAQI   = 0;

uint32_t lastEnvMs = 0, lastPacketMs = 0;

// ============================================================================
//  BLE — central role (subscribes to the bracelet)
// ============================================================================
BraceletWire lastBracelet{};
volatile uint32_t lastBraceletMs = 0;
bool bleConnected = false;
bool bleScanning  = false;
BLEClient*                pBleClient  = nullptr;
BLERemoteCharacteristic*  pBleChr     = nullptr;
BLEAdvertisedDevice*      pBleTarget  = nullptr;

// Cache the bracelet's MAC after the FIRST successful discovery. Subsequent
// reconnects skip scanning entirely and use a directed connect straight to
// this address — typical reconnect time drops from 5–15 s to <1 s.
static BLEAddress g_cachedBraceletMac((uint8_t*)"\x00\x00\x00\x00\x00\x00");
static bool       g_haveCachedMac    = false;
static uint8_t    g_cachedAddrType   = BLE_ADDR_PUBLIC;

// Bluedroid's default connect timeout is portMAX_DELAY, so a stale MAC would
// stall the main loop for tens of seconds. Cap directed connect to 2 s — if
// the bracelet isn't reachable, we fall back to a scan on the next tick.
static const uint32_t DIRECTED_CONNECT_TIMEOUT_MS = 2000;

static void braceletNotifyCB(BLERemoteCharacteristic* /*c*/, uint8_t* data, size_t len, bool /*isNotify*/) {
  if (len == sizeof(BraceletWire)) {
    memcpy(&lastBracelet, data, len);
    lastBraceletMs = millis();
  }
}

class NgScanCB : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice adv) override {
    if (adv.haveServiceUUID() && adv.isAdvertisingService(NG_BRACELET_SVC_UUID)) {
      Serial.print("[BLE central] MATCH  "); Serial.println(adv.getAddress().toString().c_str());
      BLEDevice::getScan()->stop();
      if (pBleTarget) delete pBleTarget;
      pBleTarget = new BLEAdvertisedDevice(adv);
      bleScanning = false;
    }
  }
};

class NgClientCB : public BLEClientCallbacks {
  void onConnect(BLEClient* /*c*/) override { Serial.println("[BLE central] connected"); }
  void onDisconnect(BLEClient* /*c*/) override {
    bleConnected = false;
    Serial.println("[BLE central] disconnected");
  }
};

// Finish the connect: discover service, subscribe to notifications. Shared by
// both the "discovered via scan" path and the "directed reconnect via cached
// MAC" path.
bool finishConnect() {
  auto svc = pBleClient->getService(NG_BRACELET_SVC_UUID);
  if (!svc) { Serial.println("[BLE central] service NOT FOUND"); pBleClient->disconnect(); return false; }
  pBleChr = svc->getCharacteristic(NG_BRACELET_CHR_UUID);
  if (!pBleChr) { Serial.println("[BLE central] char NOT FOUND");   pBleClient->disconnect(); return false; }
  if (pBleChr->canNotify()) pBleChr->registerForNotify(braceletNotifyCB);
  bleConnected = true;
  Serial.println("[BLE central] subscribed to bracelet");
  return true;
}

bool tryConnectBracelet() {
  if (!pBleTarget) return false;
  if (pBleClient) { pBleClient->disconnect(); delete pBleClient; pBleClient = nullptr; }

  pBleClient = BLEDevice::createClient();
  pBleClient->setClientCallbacks(new NgClientCB());
  if (!pBleClient->connect(pBleTarget)) { Serial.println("[BLE central] connect() failed"); return false; }

  // Cache the MAC + address type so subsequent reconnects skip scanning.
  g_cachedBraceletMac = pBleTarget->getAddress();
  g_cachedAddrType    = pBleTarget->getAddressType();
  g_haveCachedMac     = true;
  Serial.print("[BLE central] cached bracelet MAC: ");
  Serial.println(g_cachedBraceletMac.toString().c_str());

  return finishConnect();
}

// Directed reconnect: use the cached MAC to connect straight to the bracelet
// without scanning first. Bluedroid's scan discovery is slow (5–15 s in
// practice), so bypassing it collapses reconnect to <1 s in the common case.
bool tryDirectedReconnect() {
  if (!g_haveCachedMac) return false;
  if (pBleClient) { pBleClient->disconnect(); delete pBleClient; pBleClient = nullptr; }

  Serial.print("[BLE central] directed reconnect to ");
  Serial.println(g_cachedBraceletMac.toString().c_str());
  pBleClient = BLEDevice::createClient();
  pBleClient->setClientCallbacks(new NgClientCB());
  if (!pBleClient->connect(g_cachedBraceletMac, g_cachedAddrType, DIRECTED_CONNECT_TIMEOUT_MS)) {
    Serial.println("[BLE central] directed connect() timed out — falling back to scan");
    return false;
  }
  return finishConnect();
}

void bleCentralTick() {
  // 1) A previous scan found the bracelet — connect using that discovery.
  if (pBleTarget && !bleConnected) {
    if (tryConnectBracelet()) { delete pBleTarget; pBleTarget = nullptr; }
    else                      { delete pBleTarget; pBleTarget = nullptr; bleScanning = false; }
    return;
  }
  // 2) Not connected, not scanning. If we have a cached MAC (i.e. this is a
  //    reconnect after a previously successful pairing), try directed connect
  //    first — much faster than re-scanning.
  if (!bleConnected && !bleScanning && g_haveCachedMac) {
    if (tryDirectedReconnect()) return;
    // Directed connect failed — fall through and start a fresh scan.
  }
  // 3) Fallback / cold-boot: active scan at ~100 % duty for lowest discovery
  //    latency on Bluedroid.
  if (!bleConnected && !bleScanning) {
    BLEScan* s = BLEDevice::getScan();
    s->setActiveScan(true);
    s->setInterval(96);     // 60 ms
    s->setWindow(96);       // 60 ms → 100 % duty (scan continuously)
    s->start(0, nullptr, false);
    bleScanning = true;
    Serial.println("[BLE central] scanning for NG-Bracelet…");
  }
}

// ============================================================================
//  BLE — peripheral role (advertises + notifies the browser)
// ============================================================================
BLEServer*         pBleServer  = nullptr;
BLECharacteristic* pWebChr     = nullptr;
BLECharacteristic* pCmdChr     = nullptr;
bool               webSubscribed = false;

// Forward declarations for handlers invoked by the command char.
void handleRescanBraceletCmd();

class NgWebServerCB : public BLEServerCallbacks {
  void onConnect(BLEServer* /*s*/) override {
    Serial.println("[BLE web] browser connected");
  }
  void onDisconnect(BLEServer* /*s*/) override {
    Serial.println("[BLE web] browser disconnected — restarting advertising");
    webSubscribed = false;
    BLEDevice::startAdvertising();
  }
};

class NgCmdChrCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.empty()) return;
    uint8_t op = (uint8_t)v[0];
    Serial.print("[BLE web] cmd op=0x"); Serial.println(op, HEX);
    switch (op) {
      case HUB_CMD_RESCAN_BRACELET:
        handleRescanBraceletCmd();
        break;
      default:
        Serial.println("[BLE web] unknown cmd — ignored");
    }
  }
};

void startBleWebPeripheral() {
  pBleServer = BLEDevice::createServer();
  pBleServer->setCallbacks(new NgWebServerCB());

  BLEService* pSvc = pBleServer->createService(NG_HUB_WEB_SVC_UUID);
  pWebChr = pSvc->createCharacteristic(
    NG_HUB_WEB_CHR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pWebChr->addDescriptor(new BLE2902());

  // Command characteristic — browser writes a 1-byte opcode. WRITE_NR
  // (write without response) keeps the round-trip fast for UI actions.
  pCmdChr = pSvc->createCharacteristic(
    NG_HUB_CMD_CHR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pCmdChr->setCallbacks(new NgCmdChrCB());

  pSvc->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(NG_HUB_WEB_SVC_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE web] advertising as NG-Pacifier — browser can now connect");
}

// Drop the cached bracelet MAC and kill any in-flight connection so the next
// central tick starts a fresh scan. Called from the CMD characteristic write.
void handleRescanBraceletCmd() {
  Serial.println("[BLE central] RESCAN command — clearing cache + reconnecting");
  g_haveCachedMac = false;
  if (pBleClient) {
    pBleClient->disconnect();
    // Don't delete here — the disconnect callback will flip bleConnected=false
    // and the next tick will recreate the client via tryConnectBracelet().
  }
  if (pBleTarget) { delete pBleTarget; pBleTarget = nullptr; }
  bleConnected = false;
  bleScanning  = false;   // next tick starts a fresh scan
}

// ============================================================================
//  Sensors + detectors (verbatim from RFP602_Test — see comments there)
// ============================================================================
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
  for (int i = 0; i < n; i++) if (now - buf[i].t_ms <= WINDOW_MS) buf[keep++] = buf[i];
  n = keep;
}
void pushEvent(Event* buf, int& n, uint32_t t, float v) {
  if (n < MAX_EVENTS) { buf[n++] = {t, v}; return; }
  for (int i = 1; i < MAX_EVENTS; i++) buf[i-1] = buf[i];
  buf[MAX_EVENTS - 1] = {t, v};
}
void updateSuckDetector(float pct, uint32_t now) {
  if (!suckActive) {
    if (pct >= SUCK_ON_PCT) { suckActive = true; suckPeakPct = pct; }
  } else {
    if (pct > suckPeakPct) suckPeakPct = pct;
    if (pct <= SUCK_OFF_PCT) {
      pushEvent(suckEvents, nSuck, now, suckPeakPct);
      suckActive = false;
    }
  }
}
// Simple tick-counter: while pk-pk is at or above BREATH_ON_PKPK (17 %),
// fire one event per BREATH_REFRACT_MS (= 1000 ms below). When pk-pk drops
// below the threshold, no events fire — the counter pauses, doesn't reset.
// That gives the "0,1,2,3,4 while blowing, stops when quiet" behavior the
// user wants without any adaptive-baseline complexity.
void updateBreathDetector(int pkpk, uint32_t now) {
  if (pkpk >= BREATH_ON_PKPK && (now - lastBreathMs) >= BREATH_REFRACT_MS) {
    lastBreathMs = now;
    pushEvent(breathEvents, nBreath, now, (float)pkpk);
    Serial.print("[BREATH] tick pkpk="); Serial.print(pkpk);
    Serial.print(" n=");                 Serial.println(nBreath);
  }
}

struct NnsMetrics { uint16_t sucks; uint16_t bursts; float meanPeak; float meanBurstSec; float cv; };
NnsMetrics computeNns(uint32_t /*now*/) {
  NnsMetrics m{0,0,0,0,0};
  m.sucks = nSuck;
  if (nSuck == 0) return m;
  float sumPeak = 0;
  for (int i = 0; i < nSuck; i++) sumPeak += suckEvents[i].val;
  m.meanPeak = sumPeak / nSuck;

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
      isiSum += (double)gap; isiSumSq += (double)gap * (double)gap; isiN++;
    }
    burstLast = suckEvents[i].t_ms;
  }
  totalBurstMs += (burstLast - burstStart);
  m.bursts = bursts;
  m.meanBurstSec = (float)(totalBurstMs / bursts) / 1000.0f;
  if (isiN > 1) {
    double mean = isiSum / isiN;
    double var  = (isiSumSq / isiN) - mean * mean;
    if (var < 0) var = 0;
    double sd   = sqrt(var);
    m.cv = (mean > 0) ? (float)(sd / mean) : 0.0f;
  }
  return m;
}

// ============================================================================
//  Environment
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
void tryInitEnv(bool verbose = false) {
  if (!ahtOk) {
    ahtOk = aht.begin();
    if (ahtOk && verbose) Serial.println("[env] AHT21 came online.");
  }
  if (!ensOk) {
    ensOk = ens160.begin();
    if (ensOk) { ens160.setMode(ENS160_OPMODE_STD); if (verbose) Serial.println("[env] ENS160 came online."); }
  }
}
void updateEnvironment() {
  if (!ahtOk || !ensOk) tryInitEnv(true);
  if (ahtOk) {
    sensors_event_t h, t;
    if (aht.getEvent(&h, &t)) {
      lastTempC = t.temperature; lastRH = h.relative_humidity;
    } else { ahtOk = false; }
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

// ============================================================================
//  Combined packet build + notify
// ============================================================================
void buildAndPushCombined(uint32_t now, float fsrPct, int micPkPk) {
  CombinedWire pkt{};
  auto nns = computeNns(now);

  pkt.hub.ts_ms                     = now;
  pkt.hub.fsr_pct_now               = (uint8_t)constrain((int)roundf(fsrPct), 0, 100);
  pkt.hub.sucks_per_min             = nns.sucks;
  pkt.hub.bursts_per_min            = nns.bursts;
  pkt.hub.mean_peak_pct             = (uint8_t)constrain((int)roundf(nns.meanPeak), 0, 100);
  pkt.hub.mean_burst_ms             = (uint16_t)constrain((int)roundf(nns.meanBurstSec * 1000.0f), 0, 65535);
  pkt.hub.regularity_cv_x1000       = (uint16_t)constrain((int)roundf(nns.cv * 1000.0f), 0, 65535);
  pkt.hub.mic_pkpk_now              = (uint16_t)constrain(micPkPk, 0, 65535);
  pkt.hub.resp_events_per_min       = nBreath;
  // Main "breaths/min" value shown on the Breathing Rate card. With the
  // simplified tick-per-second detector, this IS nBreath — one event per
  // second above 17 % = one "breath" in the display. Don't divide by 2
  // (that was the old inhale+exhale heuristic; no longer applies).
  pkt.hub.est_breaths_per_min       = nBreath;
  uint32_t sinceMs = (lastBreathMs > 0) ? (now - lastBreathMs) : now;
  pkt.hub.seconds_since_last_breath = (uint16_t)constrain((int)(sinceMs / 1000), 0, 65535);
  pkt.hub.apnea_alert               = (pkt.hub.seconds_since_last_breath >= APNEA_ALERT_SEC) ? 1 : 0;
  pkt.hub.temp_c_x10                = (int16_t) roundf(lastTempC * 10.0f);
  pkt.hub.rh_x10                    = (uint16_t)constrain((int)roundf(lastRH * 10.0f), 0, 65535);
  pkt.hub.eco2_ppm                  = lastECO2;
  pkt.hub.tvoc_ppb                  = lastTVOC;
  pkt.hub.aqi                       = lastAQI;

  uint32_t bAgeS = (lastBraceletMs > 0) ? ((now - lastBraceletMs) / 1000) : 999;
  bool bLinked  = bleConnected && (lastBraceletMs > 0) && (bAgeS < 5);
  pkt.bracelet_present = bLinked ? 1 : 0;
  pkt.bracelet_age_s   = (uint16_t)min<uint32_t>(bAgeS, 65535);
  if (bLinked) memcpy(&pkt.bracelet, &lastBracelet, sizeof(BraceletWire));

  if (pWebChr) {
    pWebChr->setValue((uint8_t*)&pkt, sizeof(pkt));
    pWebChr->notify();
  }
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
  delay(50);

  Serial.println();
  Serial.println("################################################");
  Serial.println("#  NeuroGuard  —  Hub (BLE Web-Bluetooth mode) #");
  Serial.println("################################################");

  i2cScan();

  for (int i = 0; i < 5 && (!ahtOk || !ensOk); i++) {
    tryInitEnv(false);
    if (!ahtOk || !ensOk) delay(150);
  }
  Serial.print("AHT21  @0x38 : "); Serial.println(ahtOk ? "OK" : "NOT FOUND");
  Serial.print("ENS160 @0x52 : "); Serial.println(ensOk ? "OK" : "NOT FOUND");
  Serial.print("FSR baseline raw: "); Serial.println(fsrBaseline);

  // ---- BLE stack (dual role) ----
  BLEDevice::init("NG-Pacifier");
  BLEDevice::setPower(ESP_PWR_LVL_P9);
  // Peripheral side FIRST so `startAdvertising()` is registered before the
  // scanner begins (matters on some Bluedroid builds).
  startBleWebPeripheral();
  // Central-side scan callback
  BLEScan* s = BLEDevice::getScan();
  s->setAdvertisedDeviceCallbacks(new NgScanCB(), false);

  Serial.println("BLE up. Central role scans for NG-Bracelet; peripheral role advertises NG-Pacifier.");
  Serial.println("Streaming CombinedWire packets every 1 s over the web characteristic.");
}

// ============================================================================
//  Loop
// ============================================================================
void loop() {
  uint32_t now = millis();

  bleCentralTick();

  int rawFsr    = readFsrAveraged(8);
  float fsrPct  = rawToFsrPct(rawFsr);
  int micPkPk   = readMicPkPk();

  updateSuckDetector(fsrPct, now);
  updateBreathDetector(micPkPk, now);

  trimOld(suckEvents,   nSuck,   now);
  trimOld(breathEvents, nBreath, now);

  if (now - lastEnvMs >= ENV_PERIOD_MS) {
    lastEnvMs = now;
    updateEnvironment();
  }

  if (now - lastPacketMs >= PACKET_PERIOD_MS) {
    lastPacketMs = now;
    buildAndPushCombined(now, fsrPct, micPkPk);
  }
}
