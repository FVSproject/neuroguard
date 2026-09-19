"use client";

import { Hand } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Raw FSR pressure strip — twin of MicLevel, but for the pacifier's
 * force-sensing resistor. The firmware already emits `fsr_pct_now` as a
 * 0–100 % scale (relative to a boot-time baseline and the sketch's
 * FSR_FULL_SCALE = 3800 counts).
 *
 * Bar turns brand-teal once we cross the firmware's suck-event trigger
 * (SUCK_ON_PCT = 8 %). A fixed tick marks that trigger so the parent can
 * verify visually that a squeeze crosses the line.
 *
 * Keep SUCK_ON_PCT in sync with the same constant in RFP602_Test.ino /
 * NeuroGuard_Hub_BLE.ino, otherwise the meter's tick and the firmware's
 * event fire at different amplitudes.
 */
const SUCK_ON_PCT = 8;

export function FsrLevel({ pct }: { pct: number | undefined }) {
  const raw = Math.max(0, Math.min(100, Math.round(pct ?? 0)));
  const over = raw >= SUCK_ON_PCT;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <Hand className="size-3 shrink-0" aria-hidden />
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuenow={raw}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="FSR press %"
      >
        <div
          className={cn(
            "h-full transition-[width,background-color] duration-200 ease-out",
            over ? "bg-brand" : "bg-muted/50",
          )}
          style={{ width: `${raw}%` }}
        />
        <span
          className="pointer-events-none absolute top-0 h-full w-px bg-ink/40"
          style={{ left: `${SUCK_ON_PCT}%` }}
          aria-hidden
        />
      </div>
      <span className="tabular font-medium min-w-[2.5rem] text-right">
        {raw}%
      </span>
    </div>
  );
}
