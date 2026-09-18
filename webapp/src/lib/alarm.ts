"use client";

/**
 * Alarm sound engine — a thin Web Audio wrapper that plays a few built-in
 * patterns. We don't ship MP3 files: audible feedback is generated on the fly
 * so the whole app stays a single static bundle that Vercel can serve cold.
 *
 * Three patterns:
 *   - "chime": a short two-tone up-down, one-shot
 *   - "pulse": a repeating single-tone beep, loops until stop()
 *   - "siren": a rising-then-falling wail, loops until stop()
 */

type PatternName = "chime" | "pulse" | "siren";

let ctx: AudioContext | null = null;
let currentStopper: (() => void) | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Some browsers auto-suspend the context until a user gesture — resume
  // is safe to call repeatedly.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function stopCurrent(): void {
  if (currentStopper) {
    try { currentStopper(); } catch { /* noop */ }
    currentStopper = null;
  }
}

function chime(volume: number): void {
  const ac = ensureCtx();
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);
  const now = ac.currentTime;

  const play = (freq: number, at: number, dur: number) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + dur);
    gain.gain.linearRampToValueAtTime(volume, at + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, at + dur);
  };

  play(880, now, 0.18);
  play(1320, now + 0.20, 0.22);
}

function loopingBeep(volume: number, periodMs: number, freq: number): () => void {
  const ac = ensureCtx();
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  osc.start();

  let stopped = false;
  const period = periodMs / 1000;
  const beepAt = (t: number) => {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.03);
    gain.gain.linearRampToValueAtTime(0.0001, t + 0.28);
  };
  // Schedule the first few beeps, then refill in a JS interval.
  for (let i = 0; i < 4; i++) beepAt(ac.currentTime + i * period);
  const iv = setInterval(() => {
    if (stopped) return;
    for (let i = 0; i < 2; i++) beepAt(ac.currentTime + i * period + 0.05);
  }, period * 2 * 1000);

  return () => {
    stopped = true;
    clearInterval(iv);
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.05);
    setTimeout(() => {
      try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch { /* noop */ }
    }, 100);
  };
}

function siren(volume: number): () => void {
  const ac = ensureCtx();
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 600;
  osc.connect(gain);
  osc.start();

  let stopped = false;
  const cycle = 1.2;   // seconds per rise+fall
  const schedule = (t0: number) => {
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * cycle;
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(1100, t + cycle * 0.5);
      osc.frequency.exponentialRampToValueAtTime(500, t + cycle);
    }
  };
  gain.gain.setValueAtTime(volume, ac.currentTime);
  schedule(ac.currentTime);
  const iv = setInterval(() => {
    if (stopped) return;
    schedule(ac.currentTime);
  }, cycle * 3 * 1000);

  return () => {
    stopped = true;
    clearInterval(iv);
    gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.1);
    setTimeout(() => {
      try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch { /* noop */ }
    }, 150);
  };
}

export function playAlarm(pattern: PatternName, volume = 0.8): void {
  stopCurrent();
  if (typeof window === "undefined") return;
  const v = Math.max(0, Math.min(1, volume));

  if (pattern === "chime") {
    chime(v);
    // one-shot — no stopper needed
    return;
  }
  currentStopper = pattern === "siren" ? siren(v) : loopingBeep(v, 500, 900);
}

export function stopAlarm(): void {
  stopCurrent();
}

export function previewPattern(pattern: PatternName, volume = 0.8): void {
  playAlarm(pattern, volume);
  if (pattern !== "chime") {
    setTimeout(stopAlarm, 2000);
  }
}
