"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Volume2, PlayCircle, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { defaultThresholdsList } from "@/lib/thresholds";
import { previewPattern } from "@/lib/alarm";
import { useBabyStore } from "@/stores/baby-store";
import type { AlarmPrefs, BabyThresholds, ThresholdConfig } from "@/lib/types";

const METRIC_LABEL: Record<string, [labelKey: string, unitKey: string]> = {
  hr:           ["sensor.hr",         "sensor.hrUnit"],
  spo2:         ["sensor.spo2",       "sensor.spo2Unit"],
  rmssd:        ["sensor.hrv",        "sensor.hrvUnit"],
  suckRate:     ["sensor.suck",       "sensor.suckUnit"],
  breathRate:   ["sensor.breath",     "sensor.breathUnit"],
  apneaSec:     ["sensor.breath",     "sensor.stillnessUnit"],
  stillnessSec: ["sensor.motion",     "sensor.stillnessUnit"],
  tempC:        ["sensor.temp",       "sensor.tempUnit"],
  rhPct:        ["sensor.humidity",   "sensor.humidityUnit"],
  eco2:         ["sensor.eco2",       "sensor.eco2Unit"],
  tvoc:         ["sensor.tvoc",       "sensor.tvocUnit"],
  aqi:          ["sensor.eco2",       ""],
};

function ThresholdRow({
  cfg,
  onChange,
}: {
  cfg: ThresholdConfig;
  onChange: (patch: Partial<ThresholdConfig>) => void;
}) {
  const t = useTranslations();
  const [labelKey, unitKey] = METRIC_LABEL[cfg.metric] ?? ["sensor.hr", ""];

  return (
    <div className="grid grid-cols-1 items-center gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <div>
        <div className="text-sm font-semibold">
          {t(labelKey)}
          <span className="ms-2 text-xs font-normal text-muted">
            {unitKey ? t(unitKey) : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="w-8 text-xs text-muted">min</Label>
        <Input
          type="number"
          value={cfg.min ?? ""}
          onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
          className="w-20"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="w-8 text-xs text-muted">max</Label>
        <Input
          type="number"
          value={cfg.max ?? ""}
          onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
          className="w-20"
        />
      </div>
      <Switch
        checked={cfg.enabled}
        onCheckedChange={(v) => onChange({ enabled: v })}
        aria-label="Enabled"
      />
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations();
  const babyId = useBabyStore((s) => s.currentBabyId);
  const deleteBaby = useBabyStore((s) => s.deleteBaby);

  const [thresholds, setThresholds] = useState<ThresholdConfig[]>(defaultThresholdsList());
  const [prefs, setPrefs] = useState<AlarmPrefs | null>(null);

  useEffect(() => {
    if (!babyId) return;
    let cancelled = false;
    (async () => {
      const [th, ap] = await Promise.all([
        db().thresholds.get(babyId),
        db().alarmPrefs.get(babyId),
      ]);
      if (!cancelled) {
        setThresholds(th?.entries ?? defaultThresholdsList());
        setPrefs(ap ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [babyId]);

  async function saveThresholds(next: ThresholdConfig[]) {
    setThresholds(next);
    if (!babyId) return;
    const rec: BabyThresholds = { babyId, entries: next, updatedAt: Date.now() };
    await db().thresholds.put(rec);
  }

  async function savePrefs(patch: Partial<AlarmPrefs>) {
    if (!babyId || !prefs) return;
    const next: AlarmPrefs = { ...prefs, ...patch, updatedAt: Date.now() };
    setPrefs(next);
    await db().alarmPrefs.put(next);
  }

  if (!babyId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted">
          {t("landing.noBaby")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      </header>

      <Tabs defaultValue="thresholds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="thresholds">{t("settings.thresholds")}</TabsTrigger>
          <TabsTrigger value="alarms">{t("settings.alarms")}</TabsTrigger>
          <TabsTrigger value="data">{t("settings.data")}</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="space-y-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("settings.thresholds")}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveThresholds(defaultThresholdsList())}
                className="gap-2"
              >
                <RotateCcw className="size-4" aria-hidden />
                {t("settings.resetThresholds")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {thresholds.map((cfg, i) => (
                <ThresholdRow
                  key={cfg.metric}
                  cfg={cfg}
                  onChange={(patch) => {
                    const next = [...thresholds];
                    next[i] = { ...cfg, ...patch };
                    void saveThresholds(next);
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alarms">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.alarms")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="soundEnabled">{t("alarm.sound")}</Label>
                <Switch
                  id="soundEnabled"
                  checked={prefs?.soundEnabled ?? true}
                  onCheckedChange={(v) => savePrefs({ soundEnabled: v })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Label>{t("alarm.sound")}</Label>
                <Select
                  value={prefs?.soundName ?? "pulse"}
                  onValueChange={(v) => savePrefs({ soundName: v as AlarmPrefs["soundName"] })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chime">chime</SelectItem>
                    <SelectItem value="pulse">pulse</SelectItem>
                    <SelectItem value="siren">siren</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewPattern(prefs?.soundName ?? "pulse", prefs?.volume ?? 0.8)}
                  className="gap-2"
                >
                  <PlayCircle className="size-4" aria-hidden />
                  {t("alarm.preview")}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Volume2 className="size-4 text-muted" aria-hidden />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs?.volume ?? 0.8}
                  onChange={(e) => savePrefs({ volume: Number(e.target.value) })}
                  className="w-64"
                />
                <span className="text-sm tabular text-muted">
                  {Math.round((prefs?.volume ?? 0.8) * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="vibrate">{t("settings.vibrateOnAlarm")}</Label>
                <Switch
                  id="vibrate"
                  checked={prefs?.vibrate ?? true}
                  onCheckedChange={(v) => savePrefs({ vibrate: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.data")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted">{t("settings.dataDescription")}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-danger"
                  onClick={async () => {
                    if (!confirm(t("form.confirmDelete"))) return;
                    await deleteBaby(babyId);
                    toast.success(t("toast.babyDeleted"));
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t("baby.delete")}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-danger"
                  onClick={async () => {
                    if (!confirm(t("settings.clearAllHint") + "\n\n" + t("form.confirmDelete"))) return;
                    // Wipe every table then clear per-locale caches.
                    await Promise.all([
                      db().babies.clear(),
                      db().parents.clear(),
                      db().emergencyContacts.clear(),
                      db().thresholds.clear(),
                      db().alarmPrefs.clear(),
                      db().logs.clear(),
                      db().packets.clear(),
                    ]);
                    localStorage.removeItem("ng.baby");
                    localStorage.removeItem("ng.ui");
                    toast.success(t("toast.allDataCleared"));
                    setTimeout(() => window.location.assign("/"), 400);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t("settings.clearAllData")}
                </Button>
              </div>
              <p className="text-xs text-muted">{t("settings.clearAllHint")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
