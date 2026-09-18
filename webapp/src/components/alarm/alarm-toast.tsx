"use client";

import { motion } from "framer-motion";
import { Siren, OctagonAlert, TriangleAlert, Info, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export type AlarmToastLevel = "info" | "watch" | "alert" | "critical";

type Style = {
  bg: string;
  ring: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrap: string;
  chip: string;
  pulse?: boolean;
};

/**
 * Per-severity look. Colours drift from a calm blue at "info" to a hot
 * red-gradient at "critical" — parents don't need to read the text to know
 * how urgent the toast is, they see it in the peripheral vision.
 */
const STYLE: Record<AlarmToastLevel, Style> = {
  info: {
    bg:       "bg-gradient-to-br from-brand-soft via-white to-brand-soft/40",
    ring:     "ring-1 ring-brand/30",
    icon:     Info,
    iconWrap: "bg-brand text-white",
    chip:     "bg-brand/10 text-brand",
  },
  watch: {
    bg:       "bg-gradient-to-br from-warn-soft via-white to-warn-soft/40",
    ring:     "ring-1 ring-warn/40",
    icon:     TriangleAlert,
    iconWrap: "bg-warn text-white",
    chip:     "bg-warn/15 text-warn",
  },
  alert: {
    bg:       "bg-gradient-to-br from-[#fff2ed] via-white to-danger-soft/70",
    ring:     "ring-2 ring-danger/50",
    icon:     OctagonAlert,
    iconWrap: "bg-danger text-white",
    chip:     "bg-danger/15 text-danger",
  },
  critical: {
    bg:       "bg-gradient-to-br from-danger to-[#8b1e1e] text-white",
    ring:     "ring-2 ring-white/40 shadow-[0_0_0_4px_rgba(201,75,75,0.25)]",
    icon:     Siren,
    iconWrap: "bg-white/20 text-white",
    chip:     "bg-white/20 text-white",
    pulse:    true,
  },
};

export function AlarmToast({
  id,
  level,
  title,
  detail,
  metricLabel,
}: {
  id: string | number;
  level: AlarmToastLevel;
  title: string;
  detail?: string;
  metricLabel?: string;
}) {
  const s = STYLE[level];
  const Icon = s.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{    opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "relative w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/50 p-3 shadow-lg",
        s.bg,
        s.ring,
        s.pulse && "alarm-pulse",
      )}
      role={level === "critical" || level === "alert" ? "alert" : "status"}
      aria-live={level === "critical" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          s.iconWrap,
          s.pulse && "pulse-soft",
        )}>
          <Icon className="size-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className={cn(
              "truncate text-sm font-semibold",
              level === "critical" ? "text-white" : "text-ink",
            )}>
              {title}
            </div>
            {metricLabel ? (
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                s.chip,
              )}>
                {metricLabel}
              </span>
            ) : null}
          </div>
          {detail ? (
            <div className={cn(
              "mt-0.5 truncate text-xs",
              level === "critical" ? "text-white/80" : "text-muted",
            )}>
              {detail}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          aria-label="Dismiss"
          className={cn(
            "shrink-0 rounded-md p-1 transition-opacity",
            level === "critical" ? "text-white/80 hover:text-white" : "text-muted hover:text-ink",
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}
