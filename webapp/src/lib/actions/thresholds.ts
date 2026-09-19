"use server";

import { revalidatePath } from "next/cache";

import { defaultThresholdsList } from "@/lib/thresholds";
import { createClient } from "@/lib/supabase/server";
import type { ThresholdConfig } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return supabase;
}

export async function getThresholds(babyId: string): Promise<ThresholdConfig[]> {
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("baby_thresholds")
    .select("entries")
    .eq("baby_id", babyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.entries as ThresholdConfig[] | undefined) ?? defaultThresholdsList();
}

export async function saveThresholds(
  babyId: string,
  entries: ThresholdConfig[],
): Promise<void> {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("baby_thresholds")
    .upsert({ baby_id: babyId, entries }, { onConflict: "baby_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/live");
}
