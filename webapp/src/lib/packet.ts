/**
 * Wire-format types shared with the ESP32-S3 hub firmware.
 *
 * The hub advertises a BLE peripheral characteristic that notifies a merged
 * "combined packet" — hub-local NNS + respiratory + environment data plus
 * the latest BraceletWire snapshot. This file defines the TypeScript views
 * of both structs, plus a parser that turns the raw byte payload into the
 * shape the dashboard uses.
 *
 * BraceletWire is byte-exact with `NeuroGuard_Unit2.ino`:
 *   struct __attribute__((packed)) BraceletWire {  // 41 bytes total
 *     uint32_t ts_ms;                    //  0
 *     uint8_t  finger_present;           //  4
 *     uint32_t ir_raw;                   //  5
 *     uint16_t hr_bpm;                   //  9
 *     uint8_t  hr_src;                   // 11
 *     uint16_t rr_last_ms;               // 12
 *     uint16_t rr_mean_ms;               // 14
 *     float    sdnn_ms;                  // 16
 *     float    rmssd_ms;                 // 20
 *     uint8_t  pnn50_pct;                // 24
 *     int8_t   spo2_pct;                 // 25
 *     uint8_t  spo2_valid;               // 26
 *     float    activity_index;           // 27
 *     int16_t  pitch_x10;                // 31
 *     int16_t  roll_x10;                 // 33
 *     uint8_t  posture;                  // 35
 *     uint16_t motion_events_min;        // 36
 *     uint16_t seconds_since_movement;   // 38
 *     uint8_t  stillness_alert;          // 40
 *   };
 */

export const BRACELET_WIRE_SIZE = 41;

export enum PostureCode {
  UNKNOWN = 0,
  FLAT = 1,
  TILT_LEFT = 2,
  TILT_RIGHT = 3,
  TOE_UP = 4,
  TOE_DOWN = 5,
  TILTED = 6,
}

export enum HrSource {
  NONE = 0,
  BEAT = 1,
  ALGO = 2,
}

export type Bracelet = {
  tsMs: number;
  fingerPresent: boolean;
  irRaw: number;
  hrBpm: number;
  hrSrc: HrSource;
  rrLastMs: number;
  rrMeanMs: number;
  sdnnMs: number;
  rmssdMs: number;
  pnn50Pct: number;
  spo2Pct: number;      // -1 when invalid
  spo2Valid: boolean;
  activityG: number;
  pitchDeg: number;     // decoded from pitch_x10
  rollDeg: number;      // decoded from roll_x10
  posture: PostureCode;
  motionEventsMin: number;
  secondsSinceMovement: number;
  stillnessAlert: boolean;
};

export type Hub = {
  tsMs: number;
  // NNS
  fsrPctNow: number;
  sucksPerMin: number;
  burstsPerMin: number;
  meanPeakPct: number;
  meanBurstSec: number;
  regularityCv: number;
  // Respiration
  micPkpkNow: number;
  respEventsPerMin: number;
  estBreathsPerMin: number;
  secondsSinceLastBreath: number;
  apneaAlert: boolean;
  // Environment
  tempC: number;
  rhPct: number;
  eco2Ppm: number;
  tvocPpb: number;
  aqi: number;
  ahtOk: boolean;
  ensOk: boolean;
};

export type CombinedPacket = {
  tsMs: number;
  hub: Hub;
  bracelet: Bracelet | null;    // null when the hub isn't linked to the bracelet
  braceletLinked: boolean;
  braceletAgeSec: number;
};

/**
 * Decode a raw BraceletWire byte payload into a typed object.
 * Little-endian, packed — matches ESP32 / nRF52 memory layout.
 */
export function parseBracelet(buf: ArrayBuffer): Bracelet {
  if (buf.byteLength < BRACELET_WIRE_SIZE) {
    throw new Error(
      `BraceletWire payload too short: ${buf.byteLength} < ${BRACELET_WIRE_SIZE}`,
    );
  }
  const v = new DataView(buf);
  const LE = true;
  return {
    tsMs:                   v.getUint32(0, LE),
    fingerPresent:          v.getUint8(4) !== 0,
    irRaw:                  v.getUint32(5, LE),
    hrBpm:                  v.getUint16(9, LE),
    hrSrc:                  v.getUint8(11) as HrSource,
    rrLastMs:               v.getUint16(12, LE),
    rrMeanMs:               v.getUint16(14, LE),
    sdnnMs:                 v.getFloat32(16, LE),
    rmssdMs:                v.getFloat32(20, LE),
    pnn50Pct:               v.getUint8(24),
    spo2Pct:                v.getInt8(25),
    spo2Valid:              v.getUint8(26) !== 0,
    activityG:              v.getFloat32(27, LE),
    pitchDeg:               v.getInt16(31, LE) / 10,
    rollDeg:                v.getInt16(33, LE) / 10,
    posture:                v.getUint8(35) as PostureCode,
    motionEventsMin:        v.getUint16(36, LE),
    secondsSinceMovement:   v.getUint16(38, LE),
    stillnessAlert:         v.getUint8(40) !== 0,
  };
}

/**
 * Decode a JSON-string payload the hub notifies over its own characteristic.
 * The hub is free to publish either the packed struct above (for a bracelet
 * mirror) or a JSON blob for its own combined snapshot — for simplicity while
 * the firmware is in flux, we accept both.
 */
export function parseCombined(text: string): CombinedPacket {
  const j = JSON.parse(text) as {
    ts: number;
    nns: {
      fsr_now: number;
      sucks_per_min: number;
      bursts_per_min: number;
      mean_peak_pct: number;
      mean_burst_sec: number;
      regularity_cv: number;
    };
    resp: {
      mic_pkpk: number;
      events_per_min: number;
      breaths_per_min: number;
      since_last_breath_s: number;
      apnea: boolean;
    };
    env: {
      aht_ok: boolean;
      ens_ok: boolean;
      temp_c: number;
      rh_pct: number;
      eco2_ppm: number;
      tvoc_ppb: number;
      aqi: number;
    };
    bracelet: {
      linked: boolean;
      age_s: number;
      finger: boolean;
      ir_raw: number;
      hr_bpm: number;
      hr_src: string;
      rr_last_ms: number;
      rr_mean_ms: number;
      sdnn_ms: number;
      rmssd_ms: number;
      pnn50_pct: number;
      spo2_pct: number;
      spo2_valid: boolean;
      activity_g: number;
      pitch_deg: number;
      roll_deg: number;
      posture: string;
      posture_code: number;
      motion_events_min: number;
      still_for_s: number;
      stillness_alert: boolean;
    };
  };

  const hub: Hub = {
    tsMs: j.ts,
    fsrPctNow: j.nns.fsr_now,
    sucksPerMin: j.nns.sucks_per_min,
    burstsPerMin: j.nns.bursts_per_min,
    meanPeakPct: j.nns.mean_peak_pct,
    meanBurstSec: j.nns.mean_burst_sec,
    regularityCv: j.nns.regularity_cv,
    micPkpkNow: j.resp.mic_pkpk,
    respEventsPerMin: j.resp.events_per_min,
    estBreathsPerMin: j.resp.breaths_per_min,
    secondsSinceLastBreath: j.resp.since_last_breath_s,
    apneaAlert: j.resp.apnea,
    tempC: j.env.temp_c,
    rhPct: j.env.rh_pct,
    eco2Ppm: j.env.eco2_ppm,
    tvocPpb: j.env.tvoc_ppb,
    aqi: j.env.aqi,
    ahtOk: j.env.aht_ok,
    ensOk: j.env.ens_ok,
  };

  const bracelet: Bracelet | null = j.bracelet.linked
    ? {
        tsMs: j.ts,
        fingerPresent: j.bracelet.finger,
        irRaw: j.bracelet.ir_raw,
        hrBpm: j.bracelet.hr_bpm,
        hrSrc: j.bracelet.hr_src === "beat" ? HrSource.BEAT
             : j.bracelet.hr_src === "algo" ? HrSource.ALGO
             : HrSource.NONE,
        rrLastMs: j.bracelet.rr_last_ms,
        rrMeanMs: j.bracelet.rr_mean_ms,
        sdnnMs: j.bracelet.sdnn_ms,
        rmssdMs: j.bracelet.rmssd_ms,
        pnn50Pct: j.bracelet.pnn50_pct,
        spo2Pct: j.bracelet.spo2_pct,
        spo2Valid: j.bracelet.spo2_valid,
        activityG: j.bracelet.activity_g,
        pitchDeg: j.bracelet.pitch_deg,
        rollDeg: j.bracelet.roll_deg,
        posture: j.bracelet.posture_code as PostureCode,
        motionEventsMin: j.bracelet.motion_events_min,
        secondsSinceMovement: j.bracelet.still_for_s,
        stillnessAlert: j.bracelet.stillness_alert,
      }
    : null;

  return {
    tsMs: j.ts,
    hub,
    bracelet,
    braceletLinked: j.bracelet.linked,
    braceletAgeSec: j.bracelet.age_s,
  };
}

/**
 * BLE GATT identifiers.
 *
 * The bracelet advertises `NG_BRACELET_SERVICE_UUID` and the hub subscribes to
 * `NG_BRACELET_CHR_UUID` on it (both node-to-node, unchanged from the previous
 * firmware).
 *
 * The hub now also advertises its OWN service — `NG_HUB_WEB_SERVICE_UUID` —
 * so a web browser using Web Bluetooth can subscribe to `NG_HUB_WEB_CHR_UUID`
 * and receive the combined hub-plus-bracelet snapshot. Different UUIDs on
 * purpose: keeps the browser device chooser from listing the bracelet by
 * mistake.
 */
export const NG_BRACELET_SERVICE_UUID = "a1b2c3d4-9999-4a2b-9c1e-1a2b3c4d5e6f";
export const NG_BRACELET_CHR_UUID     = "a1b2c3d5-9999-4a2b-9c1e-1a2b3c4d5e6f";
export const NG_HUB_WEB_SERVICE_UUID  = "b2c3d4e5-9999-4a2b-9c1e-1a2b3c4d5e6f";
export const NG_HUB_WEB_CHR_UUID      = "b2c3d4e6-9999-4a2b-9c1e-1a2b3c4d5e6f";

// Kept as aliases for older callers that expected these names.
export const NG_SERVICE_UUID = NG_BRACELET_SERVICE_UUID;
export const NG_WEB_CHR_UUID = NG_HUB_WEB_CHR_UUID;

/**
 * The hub sends a compact binary struct that pairs a small HubWire block with
 * the same BraceletWire bytes we already parse. This lets a single BLE
 * notification (well under the default MTU) carry the entire dashboard state.
 *
 *   struct __attribute__((packed)) HubWire {          // 32 bytes
 *     uint32_t ts_ms;                                 //  0
 *     uint8_t  fsr_pct_now;                           //  4
 *     uint16_t sucks_per_min;                         //  5
 *     uint16_t bursts_per_min;                        //  7
 *     uint8_t  mean_peak_pct;                         //  9
 *     uint16_t mean_burst_ms;                         // 10  (burst duration in ms)
 *     uint16_t regularity_cv_x1000;                   // 12
 *     uint16_t mic_pkpk_now;                          // 14
 *     uint16_t resp_events_per_min;                   // 16
 *     uint16_t est_breaths_per_min;                   // 18
 *     uint16_t seconds_since_last_breath;             // 20
 *     uint8_t  apnea_alert;                           // 22
 *     int16_t  temp_c_x10;                            // 23
 *     uint16_t rh_x10;                                // 25
 *     uint16_t eco2_ppm;                              // 27
 *     uint16_t tvoc_ppb;                              // 29
 *     uint8_t  aqi;                                   // 31
 *   };                                                // → 32 wait, ends at 32
 *
 *   struct __attribute__((packed)) CombinedWire {     // 32 + 4 + 41 = 77 bytes
 *     HubWire      hub;                               //   0
 *     uint8_t      bracelet_present;                  //  32
 *     uint16_t     bracelet_age_s;                    //  33
 *     uint8_t      _reserved;                         //  35 (padding to keep BraceletWire aligned)
 *     BraceletWire bracelet;                          //  36
 *   };                                                // → 77 bytes
 */
export const HUB_WIRE_SIZE = 32;
export const COMBINED_WIRE_SIZE = HUB_WIRE_SIZE + 4 + BRACELET_WIRE_SIZE;   // 77

/**
 * Decode the binary CombinedWire payload the hub sends over Web Bluetooth.
 * Little-endian, packed. Missing sensors ride along as their zero-flag fields
 * (aht_ok / ens_ok / bracelet_present).
 */
export function parseCombinedBinary(buf: ArrayBuffer): CombinedPacket {
  if (buf.byteLength < COMBINED_WIRE_SIZE) {
    throw new Error(
      `CombinedWire payload too short: ${buf.byteLength} < ${COMBINED_WIRE_SIZE}`,
    );
  }
  const v = new DataView(buf);
  const LE = true;

  const hubTs   = v.getUint32(0, LE);
  const hub: Hub = {
    tsMs:                   hubTs,
    fsrPctNow:              v.getUint8(4),
    sucksPerMin:            v.getUint16(5, LE),
    burstsPerMin:           v.getUint16(7, LE),
    meanPeakPct:            v.getUint8(9),
    meanBurstSec:           v.getUint16(10, LE) / 1000,
    regularityCv:           v.getUint16(12, LE) / 1000,
    micPkpkNow:             v.getUint16(14, LE),
    respEventsPerMin:       v.getUint16(16, LE),
    estBreathsPerMin:       v.getUint16(18, LE),
    secondsSinceLastBreath: v.getUint16(20, LE),
    apneaAlert:             v.getUint8(22) !== 0,
    tempC:                  v.getInt16(23, LE) / 10,
    rhPct:                  v.getUint16(25, LE) / 10,
    eco2Ppm:                v.getUint16(27, LE),
    tvocPpb:                v.getUint16(29, LE),
    aqi:                    v.getUint8(31),
    // ahtOk / ensOk aren't in the compact struct — infer from the values.
    ahtOk:                  v.getUint16(25, LE) !== 0,
    ensOk:                  v.getUint16(27, LE) !== 0,
  };

  const braceletPresent  = v.getUint8(32) !== 0;
  const braceletAgeSec   = v.getUint16(33, LE);
  const braceletBytes    = buf.slice(36);
  const bracelet = braceletPresent ? parseBracelet(braceletBytes) : null;

  return {
    tsMs: hubTs,
    hub,
    bracelet,
    braceletLinked: braceletPresent,
    braceletAgeSec,
  };
}

// Backward-compat alias.
export const parseCombinedJson = parseCombined;
