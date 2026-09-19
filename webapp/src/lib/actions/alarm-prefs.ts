"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AlarmPrefs } from "@/lib/types";

const DEFAULTS: Omit<AlarmPrefs, "babyId" | "updatedAt"> = {
  soundEnabled: true,
  soundName: "pulse",
  volume: 0.8,
  vibrate: true,
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return supabase;
}

export async function getAlarmPrefs(babyId: string): Promise<AlarmPrefs> {
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("alarm_prefs")
    .select("*")
    .eq("baby_id", babyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { babyId, ...DEFAULTS, updatedAt: Date.now() };
  return {
    babyId: data.baby_id,
    soundEnabled: data.sound_enabled,
    soundName: data.sound_name as AlarmPrefs["soundName"],
    volume: data.volume,
    vibrate: data.vibrate,
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

export async function saveAlarmPrefs(
  babyId: string,
  patch: Partial<Omit<AlarmPrefs, "babyId" | "updatedAt">>,
): Promise<void> {
  const supabase = await requireUser();
  const row = {
    baby_id: babyId,
    ...(patch.soundEnabled !== undefined && { sound_enabled: patch.soundEnabled }),
    ...(patch.soundName    !== undefined && { sound_name: patch.soundName }),
    ...(patch.volume       !== undefined && { volume: patch.volume }),
    ...(patch.vibrate      !== undefined && { vibrate: patch.vibrate }),
  };
  const { error } = await supabase
    .from("alarm_prefs")
    .upsert(row, { onConflict: "baby_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
