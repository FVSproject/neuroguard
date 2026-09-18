"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db";
import { useBabyStore } from "@/stores/baby-store";
import type { LogEntry, LogSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<LogSeverity, string> = {
  info:     "bg-brand-soft text-brand",
  warn:     "bg-warn-soft text-warn",
  alert:    "bg-danger-soft text-danger",
  critical: "bg-danger text-white",
};

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export default function LogsPage() {
  const t = useTranslations();
  const babyId = useBabyStore((s) => s.currentBabyId);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [severity, setSeverity] = useState<"all" | LogSeverity>("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!babyId) return;
    let cancelled = false;
    (async () => {
      const rows = await db().logs
        .where("babyId").equals(babyId)
        .reverse()
        .sortBy("tsMs");
      if (!cancelled) setEntries(rows);
    })();
    // Refresh every 5 s so alarms show up while parents watch this tab.
    const iv = setInterval(() => setTick((v) => v + 1), 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [babyId, tick]);

  const visible = useMemo(
    () => (severity === "all" ? entries : entries.filter((e) => e.severity === severity)),
    [entries, severity],
  );

  async function exportCsv() {
    if (!visible.length) return;
    const rows = [
      ["timestamp", "kind", "severity", "metric", "value", "message"].join(","),
      ...visible.map((e) =>
        [
          new Date(e.tsMs).toISOString(),
          e.kind,
          e.severity,
          e.metric ?? "",
          e.value ?? "",
          JSON.stringify(e.message),
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neuroguard-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearAll() {
    if (!babyId) return;
    if (!confirm(t("form.confirmDelete"))) return;
    await db().logs.where("babyId").equals(babyId).delete();
    setEntries([]);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("logs.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {entries.length} entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="alert">Alert</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
            <Download className="size-4" aria-hidden />
            {t("logs.export")}
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={!entries.length}>
            <Trash2 className="size-4" aria-hidden />
            {t("logs.clear")}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            {visible.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">{t("logs.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn(
                      "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      SEVERITY_TONE[e.severity],
                    )}>
                      {e.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{e.message}</div>
                      <div className="text-xs text-muted">
                        {fmtTime(e.tsMs)} · {e.kind}{e.value !== undefined ? ` · ${e.value.toFixed(1)}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
