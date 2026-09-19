"use server";

import { revalidatePath } from "next/cache";

import { defaultThresholdsList } from "@/lib/thresholds";
import { createClient } from "@/lib/supabase/server";
import type { Baby, Gender } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return { supabase, userId: user.id };
}

type BabyRow = {
  id: string;
  name: string;
  dob: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  gender: Gender | null;
  notes: string | null;
  photo_data_url: string | null;
  created_at: string;
  updated_at: string;
};

function serialize(row: BabyRow): Baby {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    heightCm: row.height_cm ?? undefined,
    gender: row.gender ?? undefined,
    notes: row.notes ?? undefined,
    photoDataUrl: row.photo_data_url ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function listBabies(): Promise<Baby[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("babies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(serialize);
}

export async function createBaby(input: {
  baby: Omit<Baby, "id" | "createdAt" | "updatedAt">;
  parent?: { name: string; phone?: string; email?: string; relation?: string };
  contacts?: { name: string; phone: string; relation?: string }[];
}): Promise<Baby> {
  const { supabase, userId } = await requireUser();

  const { data: baby, error: bErr } = await supabase
    .from("babies")
    .insert({
      user_id: userId,
      name: input.baby.name,
      dob: input.baby.dob ?? null,
      weight_kg: input.baby.weightKg ?? null,
      height_cm: input.baby.heightCm ?? null,
      gender: input.baby.gender ?? null,
      notes: input.baby.notes ?? null,
      photo_data_url: input.baby.photoDataUrl ?? null,
    })
    .select("*")
    .single();
  if (bErr || !baby) throw new Error(bErr?.message ?? "Failed to create baby");

  // Parent (optional)
  if (input.parent?.name) {
    await supabase.from("parents").insert({
      baby_id: baby.id,
      name: input.parent.name,
      phone: input.parent.phone ?? null,
      email: input.parent.email ?? null,
      relation: input.parent.relation ?? null,
    });
  }

  // Emergency contacts (optional)
  if (input.contacts?.length) {
    await supabase.from("emergency_contacts").insert(
      input.contacts.map((c, i) => ({
        baby_id: baby.id,
        name: c.name,
        phone: c.phone,
        relation: c.relation ?? null,
        order: i,
      })),
    );
  }

  // Seed defaults (thresholds + alarm prefs). Ignore errors — a caregiver can
  // fill these in later from the Settings page.
  await supabase.from("baby_thresholds").insert({
    baby_id: baby.id,
    entries: defaultThresholdsList(),
  });
  await supabase.from("alarm_prefs").insert({ baby_id: baby.id });

  revalidatePath("/profile");
  revalidatePath("/live");
  return serialize(baby);
}

export async function updateBaby(id: string, patch: Partial<Baby>): Promise<Baby> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("babies")
    .update({
      ...(patch.name         !== undefined && { name: patch.name }),
      ...(patch.dob          !== undefined && { dob: patch.dob ?? null }),
      ...(patch.weightKg     !== undefined && { weight_kg: patch.weightKg ?? null }),
      ...(patch.heightCm     !== undefined && { height_cm: patch.heightCm ?? null }),
      ...(patch.gender       !== undefined && { gender: patch.gender ?? null }),
      ...(patch.notes        !== undefined && { notes: patch.notes ?? null }),
      ...(patch.photoDataUrl !== undefined && { photo_data_url: patch.photoDataUrl ?? null }),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Not found");
  revalidatePath("/profile");
  return serialize(data);
}

export async function deleteBaby(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("babies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
  revalidatePath("/live");
}
