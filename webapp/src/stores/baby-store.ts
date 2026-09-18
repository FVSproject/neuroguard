"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { db } from "@/lib/db";
import { defaultThresholdsList } from "@/lib/thresholds";
import type {
  AlarmPrefs,
  Baby,
  BabyThresholds,
  EmergencyContact,
  Parent,
} from "@/lib/types";

// A tiny id helper — good enough for a local-only DB and avoids pulling in
// a whole ULID dependency for one function.
function rid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type State = {
  hydrated: boolean;
  currentBabyId: string | null;
  babies: Baby[];
};

type Actions = {
  hydrate: () => Promise<void>;
  setCurrent: (id: string | null) => void;
  createBaby: (input: {
    baby: Omit<Baby, "id" | "createdAt" | "updatedAt">;
    parent?: Omit<Parent, "id" | "babyId">;
    contacts?: Omit<EmergencyContact, "id" | "babyId" | "order">[];
  }) => Promise<Baby>;
  updateBaby: (id: string, patch: Partial<Baby>) => Promise<void>;
  deleteBaby: (id: string) => Promise<void>;
  getBaby: (id: string) => Baby | undefined;
};

export const useBabyStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      hydrated: false,
      currentBabyId: null,
      babies: [],

      hydrate: async () => {
        if (typeof window === "undefined") return;
        const all = await db().babies.orderBy("createdAt").toArray();
        set((s) => ({
          babies: all,
          hydrated: true,
          // Fall back to the most recently added baby if the persisted current is gone.
          currentBabyId:
            s.currentBabyId && all.some((b) => b.id === s.currentBabyId)
              ? s.currentBabyId
              : (all.at(-1)?.id ?? null),
        }));
      },

      setCurrent: (id) => set({ currentBabyId: id }),

      createBaby: async ({ baby, parent, contacts }) => {
        const now = Date.now();
        const newBaby: Baby = { ...baby, id: rid("baby"), createdAt: now, updatedAt: now };

        await db().transaction(
          "rw",
          [db().babies, db().parents, db().emergencyContacts, db().thresholds, db().alarmPrefs],
          async () => {
            await db().babies.add(newBaby);
            if (parent) {
              await db().parents.add({ ...parent, id: rid("parent"), babyId: newBaby.id });
            }
            if (contacts?.length) {
              await db().emergencyContacts.bulkAdd(
                contacts.map((c, i) => ({
                  ...c,
                  id: rid("contact"),
                  babyId: newBaby.id,
                  order: i,
                })),
              );
            }
            const thresholds: BabyThresholds = {
              babyId: newBaby.id,
              entries: defaultThresholdsList(),
              updatedAt: now,
            };
            await db().thresholds.add(thresholds);

            const alarm: AlarmPrefs = {
              babyId: newBaby.id,
              soundEnabled: true,
              soundName: "pulse",
              volume: 0.8,
              vibrate: true,
              updatedAt: now,
            };
            await db().alarmPrefs.add(alarm);
          },
        );

        set((s) => ({
          babies: [...s.babies, newBaby],
          currentBabyId: newBaby.id,
        }));
        return newBaby;
      },

      updateBaby: async (id, patch) => {
        const now = Date.now();
        await db().babies.update(id, { ...patch, updatedAt: now });
        set((s) => ({
          babies: s.babies.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: now } : b)),
        }));
      },

      deleteBaby: async (id) => {
        await db().transaction(
          "rw",
          [
            db().babies,
            db().parents,
            db().emergencyContacts,
            db().thresholds,
            db().alarmPrefs,
            db().logs,
            db().packets,
          ],
          async () => {
            await db().babies.delete(id);
            await db().parents.where("babyId").equals(id).delete();
            await db().emergencyContacts.where("babyId").equals(id).delete();
            await db().thresholds.delete(id);
            await db().alarmPrefs.delete(id);
            await db().logs.where("babyId").equals(id).delete();
            await db().packets.where("babyId").equals(id).delete();
          },
        );
        set((s) => ({
          babies: s.babies.filter((b) => b.id !== id),
          currentBabyId: s.currentBabyId === id ? null : s.currentBabyId,
        }));
      },

      getBaby: (id) => get().babies.find((b) => b.id === id),
    }),
    {
      name: "ng.baby",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ currentBabyId: s.currentBabyId }),
    },
  ),
);
