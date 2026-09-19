"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Volume2, PlayCircle, RotateCcw, Trash2, Save, CircleAlert } from "lucide-react";

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
import { getAlarmPrefs, saveAlarmPrefs } from "@/lib/actions/alarm-prefs";
import { getThresholds, saveThresholds as saveThresholdsAction } from "@/lib/actions/thresholds";
import { clearAllPackets } from "@/lib/packet-db";
import { defaultThresholdsList } from "@/lib/thresholds";
import { previewPattern } from "@/lib/alarm";
import { useBabyStore } from "@/stores/baby-store";
import { useAlarmStore } from "@/stores/alarm-store";
import { cn } from "@/lib/utils";
import type { AlarmPrefs, ThresholdConfig } from "@/lib/types";

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

const DEFAULT_PREFS: Omit<AlarmPrefs, "babyId" | "updatedAt"> = {
  soundEnabled: true,
  soundName: "pulse",
  volume: 0.8,
  vibrate: true,
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
  const bumpSettingsRevision = useAlarmStore((s) => s.bumpSettingsRevision);

  // Buffered local state — all edits stay here until the user clicks Save.
  const [thresholds, setThresholds] = useState<ThresholdConfig[]>(defaultThresholdsList());
  const [prefs, setPrefs] = useState<Omit<AlarmPrefs, "babyId" | "updatedAt">>(DEFAULT_PREFS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!babyId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [th, ap] = await Promise.all([
          getThresholds(babyId),
          getAlarmPrefs(babyId),
        ]);
        if (cancelled) return;
        setThresholds(th.length ? th : defaultThresholdsList());
        setPrefs({
          soundEnabled: ap.soundEnabled,
          soundName: ap.soundName,
          volume: ap.volume,
          vibrate: ap.vibrate,
        });
        setDirty(false);
      } catch {
        if (cancelled) return;
        setThresholds(defaultThresholdsList());
        setPrefs(DEFAULT_PREFS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [babyId]);

  function editThreshold(i: number, patch: Partial<ThresholdConfig>) {
    setThresholds((prev) => {
      const next = [...prev];
      next[i] = { ...prev[i], ...patch };
      return next;
    });
    setDirty(true);
  }

  function editPrefs(patch: Partial<typeof prefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function resetThresholds() {
    setThresholds(defaultThresholdsList());
    setDirty(true);
  }

  async function saveAll() {
    if (!babyId || !dirty) return;
    setSaving(true);
    try {
      await Promise.all([
        saveThresholdsAction(babyId, thresholds),
        saveAlarmPrefs(babyId, prefs),
      ]);
      // Bump the revision — useThresholds + useAlarmWatcher subscribe to this
      // and refetch, so the live dashboard picks up new thresholds within a
      // second, no reload needed.
      bumpSettingsRevision();
      setDirty(false);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
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
    <div className="space-y-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
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
                onClick={resetThresholds}
                className="gap-2"
                disabled={loading || saving}
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
                  onChange={(patch) => editThreshold(i, patch)}
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
                <Label htmlFor="soundEnabled">{t("settings.alarmEnabled")}</Label>
                <Switch
                  id="soundEnabled"
                  checked={prefs.soundEnabled}
                  onCheckedChange={(v) => editPrefs({ soundEnabled: v })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Label>{t("alarm.sound")}</Label>
                <Select
                  value={prefs.soundName}
                  onValueChange={(v) => editPrefs({ soundName: v as AlarmPrefs["soundName"] })}
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
                  onClick={() => previewPattern(prefs.soundName, prefs.volume)}
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
                  value={prefs.volume}
                  onChange={(e) => editPrefs({ volume: Number(e.target.value) })}
                  className="w-64"
                />
                <span className="text-sm tabular text-muted">
                  {Math.round(prefs.volume * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="vibrate">{t("settings.vibrateOnAlarm")}</Label>
                <Switch
                  id="vibrate"
                  checked={prefs.vibrate}
                  onCheckedChange={(v) => editPrefs({ vibrate: v })}
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
                    // Server-side data (profiles, thresholds, logs) lives in
                    // Supabase; this button only wipes the local packet buffer
                    // + cached UI state. For a full account reset, use "Sign
                    // out" in the header avatar menu.
                    await clearAllPackets();
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

      {/* Sticky footer with the Save button — always visible, so the user
          never has to hunt for it after scrolling through 12 threshold rows. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t border-border/80 backdrop-blur transition-colors lg:pl-56",
          dirty ? "bg-warn-soft/90" : "bg-surface/90",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            {dirty ? (
              <>
                <CircleAlert className="size-4 text-warn" aria-hidden />
                <span className="font-medium text-warn">{t("settings.unsavedChanges")}</span>
              </>
            ) : (
              <span className="text-xs text-muted">{t("settings.allSaved")}</span>
            )}
          </div>
          <Button
            onClick={saveAll}
            disabled={!dirty || saving}
            className="gap-2"
            size="sm"
          >
            <Save className="size-4" aria-hidden />
            {saving ? t("settings.saving") : t("form.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
