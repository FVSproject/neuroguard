"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type State = {
  /**
   * When true, the app pushes generated packets at 1 Hz instead of talking
   * to Web Bluetooth. Convenient for offline demo + frontend development.
   */
  mockStream: boolean;
  /** Session-scoped: silences all alarm sound until the tab is closed. */
  alarmSilenced: boolean;
};

type Actions = {
  setMockStream: (v: boolean) => void;
  toggleMockStream: () => void;
  setAlarmSilenced: (v: boolean) => void;
};

export const useUiStore = create<State & Actions>()(
  persist(
    (set) => ({
      mockStream: false,
      alarmSilenced: false,
      setMockStream: (v) => set({ mockStream: v }),
      toggleMockStream: () => set((s) => ({ mockStream: !s.mockStream })),
      setAlarmSilenced: (v) => set({ alarmSilenced: v }),
    }),
    {
      name: "ng.ui",
      storage: createJSONStorage(() => localStorage),
      // don't persist the session silence flag
      partialize: (s) => ({ mockStream: s.mockStream }),
    },
  ),
);
