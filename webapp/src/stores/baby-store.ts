"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  createBaby as createBabyAction,
  deleteBaby as deleteBabyAction,
  listBabies,
  updateBaby as updateBabyAction,
} from "@/lib/actions/babies";
import type { Baby, EmergencyContact, Parent } from "@/lib/types";

type State = {
  hydrated: boolean;
  currentBabyId: string | null;
  babies: Baby[];
};

type Actions = {
  hydrate: () => Promise<void>;
  refetch: () => Promise<void>;
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
        try {
          const all = await listBabies();
          set((s) => ({
            babies: all,
            hydrated: true,
            currentBabyId:
              s.currentBabyId && all.some((b) => b.id === s.currentBabyId)
                ? s.currentBabyId
                : (all.at(-1)?.id ?? null),
          }));
        } catch {
          // Unauthenticated or offline — leave hydrated=true so the UI
          // shows the "no baby" empty state instead of a spinner forever.
          set({ hydrated: true, babies: [], currentBabyId: null });
        }
      },

      refetch: async () => {
        const all = await listBabies();
        set({ babies: all });
      },

      setCurrent: (id) => set({ currentBabyId: id }),

      createBaby: async (input) => {
        const created = await createBabyAction(input);
        set((s) => ({
          babies: [...s.babies, created],
          currentBabyId: created.id,
        }));
        return created;
      },

      updateBaby: async (id, patch) => {
        const updated = await updateBabyAction(id, patch);
        set((s) => ({
          babies: s.babies.map((b) => (b.id === id ? updated : b)),
        }));
      },

      deleteBaby: async (id) => {
        await deleteBabyAction(id);
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
