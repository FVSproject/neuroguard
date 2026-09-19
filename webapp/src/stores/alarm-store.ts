"use client";

import { create } from "zustand";

import type { MetricState } from "@/lib/thresholds";
import type { MetricId } from "@/lib/types";

/**
 * Per-metric alarm bookkeeping — which metric is currently in what state,
 * whether the parent has snoozed it, and the timestamp of the last transition
 * (used both for dwell-time decisions and to render "since HH:MM" on the banner).
 */

export type AlarmRow = {
  metric: MetricId;
  state: MetricState;
  since: number;         // epoch ms this state was entered
  value: number | null;  // value at transition
  snoozedUntil: number;  // 0 when not snoozed
};

type State = {
  rows: Record<MetricId, AlarmRow>;
  /** Bumped whenever the user hits Save on the Settings page. Hooks that
   *  cache thresholds / alarm prefs subscribe to this and re-fetch, so the
   *  running live dashboard picks up the new values without a page reload. */
  settingsRevision: number;
};

type Actions = {
  observe: (metric: MetricId, state: MetricState, value: number | null) => "changed" | "same";
  snooze: (metric: MetricId, minutes: number) => void;
  acknowledge: (metric: MetricId) => void;
  clearAll: () => void;
  activeAlarms: () => AlarmRow[];
  bumpSettingsRevision: () => void;
};

export const useAlarmStore = create<State & Actions>()((set, get) => ({
  rows: {} as Record<MetricId, AlarmRow>,
  settingsRevision: 0,
  bumpSettingsRevision: () => set((s) => ({ settingsRevision: s.settingsRevision + 1 })),

  observe: (metric, state, value) => {
    const now = Date.now();
    const prev = get().rows[metric];
    if (prev && prev.state === state) return "same";
    set((s) => ({
      rows: {
        ...s.rows,
        [metric]: {
          metric,
          state,
          value,
          since: now,
          snoozedUntil: prev?.snoozedUntil ?? 0,
        },
      },
    }));
    return "changed";
  },

  snooze: (metric, minutes) =>
    set((s) => {
      const row = s.rows[metric];
      if (!row) return s;
      return {
        rows: {
          ...s.rows,
          [metric]: { ...row, snoozedUntil: Date.now() + minutes * 60_000 },
        },
      };
    }),

  acknowledge: (metric) =>
    set((s) => {
      const row = s.rows[metric];
      if (!row) return s;
      return {
        rows: { ...s.rows, [metric]: { ...row, snoozedUntil: Date.now() + 30 * 60_000 } },
      };
    }),

  clearAll: () => set({ rows: {} as Record<MetricId, AlarmRow> }),

  activeAlarms: () => {
    const now = Date.now();
    return Object.values(get().rows).filter(
      (r) => (r.state === "alert" || r.state === "critical") && r.snoozedUntil < now,
    );
  },
}));
