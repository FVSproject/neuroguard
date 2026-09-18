/**
 * Domain types for the NeuroGuard web app.
 *
 * Live sensor packet types live in `packet.ts` — this file is only for the
 * things we persist to IndexedDB (babies, thresholds, alarm prefs, logs).
 */

export type Gender = "male" | "female" | "other";

export type Baby = {
  id: string;                 // ULID / uuid
  name: string;
  dob?: string;               // ISO date (yyyy-mm-dd)
  weightKg?: number;
  heightCm?: number;
  gender?: Gender;
  notes?: string;
  photoDataUrl?: string;      // small avatar, base64 data URL
  createdAt: number;          // epoch ms
  updatedAt: number;
};

export type Parent = {
  id: string;
  babyId: string;
  name: string;
  phone?: string;
  email?: string;
  relation?: string;          // free-form, e.g. "Mother", "Father", "Guardian"
};

export type EmergencyContact = {
  id: string;
  babyId: string;
  name: string;
  phone: string;
  relation?: string;
  order: number;              // display order
};

/**
 * A ThresholdConfig is one range for one metric. Any breach fires the alarm
 * pipeline; the specific severity is derived from how far out of range it is
 * relative to the "critical" band.
 */
export type ThresholdConfig = {
  metric: MetricId;
  min?: number;               // undefined → no lower bound
  max?: number;               // undefined → no upper bound
  criticalMin?: number;       // below this → critical severity
  criticalMax?: number;       // above this → critical severity
  dwellSec?: number;          // how long the value must stay out of range
  enabled: boolean;
};

export type BabyThresholds = {
  babyId: string;
  entries: ThresholdConfig[];
  updatedAt: number;
};

export type AlarmPrefs = {
  babyId: string;
  soundEnabled: boolean;
  soundName: "chime" | "pulse" | "siren";
  volume: number;             // 0..1
  vibrate: boolean;           // navigator.vibrate() on supported devices
  updatedAt: number;
};

export type MetricId =
  | "hr" | "spo2" | "rmssd" | "sdnn"
  | "suckRate" | "breathRate" | "apneaSec" | "stillnessSec"
  | "tempC" | "rhPct" | "eco2" | "tvoc" | "aqi";

export type LogSeverity = "info" | "warn" | "alert" | "critical";

export type LogEntry = {
  id?: number;                // auto-incremented
  babyId: string;
  tsMs: number;
  kind: "connection" | "threshold" | "alarm" | "note" | "event";
  metric?: MetricId;
  severity: LogSeverity;
  message: string;
  value?: number;
};

/**
 * A `PacketRecord` is a raw snapshot we save at ~1 Hz while a session is
 * running, so the Reports tab can compute aggregates over hours or days
 * without needing the hub to be online.  We keep the JSON blob small and
 * apply a retention policy in db.ts.
 */
export type PacketRecord = {
  id?: number;
  babyId: string;
  tsMs: number;
  hr?: number;
  spo2?: number;
  rmssd?: number;
  suckRate?: number;
  breathRate?: number;
  apneaSec?: number;
  stillnessSec?: number;
  tempC?: number;
  rhPct?: number;
  eco2?: number;
  activityG?: number;
  posture?: number;
  fingerPresent?: boolean;
};
