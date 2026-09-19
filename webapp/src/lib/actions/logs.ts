"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { LogEntry, LogSeverity } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");
  return supabase;
}

type Row = {
  id: number;
  baby_id: string;
  ts_ms: number;
  kind: string;
  metric: string | null;
  severity: string;
  message: string;
  value: number | null;
};

function serialize(r: Row): LogEntry {
  return {
    id: r.id,
    babyId: r.baby_id,
    tsMs: Number(r.ts_ms),
    kind: r.kind as LogEntry["kind"],
    metric: (r.metric ?? undefined) as LogEntry["metric"],
    severity: r.severity as LogSeverity,
    message: r.message,
    value: r.value ?? undefined,
  };
}

export async function listLogs(babyId: string, limit = 500): Promise<LogEntry[]> {
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("log_entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("ts_ms", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(serialize);
}

export async function appendLog(entry: Omit<LogEntry, "id">): Promise<void> {
  const supabase = await requireUser();
  const { error } = await supabase.from("log_entries").insert({
    baby_id: entry.babyId,
    ts_ms: entry.tsMs,
    kind: entry.kind,
    metric: entry.metric ?? null,
    severity: entry.severity,
    message: entry.message,
    value: entry.value ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/logs");
}

export async function clearLogs(babyId: string): Promise<void> {
  const supabase = await requireUser();
  const { error } = await supabase.from("log_entries").delete().eq("baby_id", babyId);
  if (error) throw new Error(error.message);
  revalidatePath("/logs");
}
