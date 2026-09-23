import type { CombinedPacket } from "./packet";
import { HrSource, PostureCode } from "./packet";

/**
 * Deterministic-ish mock packet generator so the dashboard shows plausible
 * live data before the hub firmware is flashed. Toggled via the "Mock stream"
 * switch in the settings page — off by default in production builds.
 */
export function generateMockPacket(step: number): CombinedPacket {
  const now = Date.now();
  // Cheap smooth-ish oscillations so the sparklines don't look flat.
  const s = (freq: number, phase = 0) => Math.sin(step * freq + phase);
  const r = () => Math.random() - 0.5;

  const hr = 130 + 15 * s(0.08) + 4 * r();
  const spo2 = Math.max(90, Math.min(100, 97 + s(0.04) + r()));
  const rmssd = Math.max(0, 45 + 20 * s(0.12) + 6 * r());
  const suck = Math.max(0, 45 + 30 * s(0.10, 1.5));
  const breath = 40 + 12 * s(0.06);
  const temp = 22 + 1.4 * s(0.03);
  const rh = 45 + 8 * s(0.02);
  const eco2 = 500 + 200 * s(0.05, 2);
  const activity = Math.max(0, 0.05 + 0.15 * Math.abs(s(0.20, 0.7)) + 0.02 * r());

  return {
    tsMs: now,
    hub: {
      tsMs: now,
      fsrPctNow: Math.max(0, 10 + 40 * s(0.10)),
      sucksPerMin: Math.round(suck),
      burstsPerMin: Math.round(suck / 12),
      meanPeakPct: 45 + 5 * s(0.15),
      meanBurstSec: 4 + 0.4 * s(0.20),
      regularityCv: 0.2 + 0.05 * s(0.30),
      micPkpkNow: 500 + Math.round(300 * s(0.5)),
      respEventsPerMin: Math.round(breath * 2),
      estBreathsPerMin: Math.round(breath),
      secondsSinceLastBreath: Math.round(Math.max(0, 2 + 2 * s(0.4))),
      apneaAlert: false,
      tempC: temp,
      rhPct: rh,
      eco2Ppm: Math.round(eco2),
      tvocPpb: 80 + Math.round(30 * s(0.07)),
      aqi: 2,
      ahtOk: true,
      ensOk: true,
    },
    braceletLinked: true,
    braceletAgeSec: 1,
    braceletDrops: 0,
    bracelet: {
      tsMs: now,
      fingerPresent: true,
      irRaw: 90_000 + Math.round(5_000 * s(0.1)),
      hrBpm: Math.round(hr),
      hrSrc: HrSource.BEAT,
      rrLastMs: Math.round(60_000 / hr),
      rrMeanMs: Math.round(60_000 / hr),
      sdnnMs: Math.max(0, 50 + 10 * s(0.1)),
      rmssdMs: rmssd,
      pnn50Pct: Math.max(0, Math.min(60, 20 + 15 * s(0.15))),
      spo2Pct: Math.round(spo2),
      spo2Valid: true,
      activityG: activity,
      pitchDeg: 20 * s(0.1),
      rollDeg: 15 * s(0.09, 0.5),
      posture: PostureCode.FLAT,
      motionEventsMin: Math.round(3 + 3 * Math.abs(s(0.06))),
      secondsSinceMovement: Math.round(Math.max(0, 5 + 30 * Math.abs(s(0.02)))),
      stillnessAlert: false,
    },
  };
}
