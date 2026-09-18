# NeuroGuard — Web App Design System

This is the visual and interaction contract for the NeuroGuard parent app.
Every component we build has to fit inside it; if we want to break a rule,
we change the rule here first, then build.

## 1. Design intent

The app is used by a parent watching their infant, often at night, often
tired, often anxious. It has to be:

- **Calming, not alarming, at rest.** No red-everywhere dashboards. Colors
  earn themselves — a red pulse means something.
- **Legible from across a dim room.** Big numbers. Generous line-height.
  High contrast. No thin fonts on live values.
- **Instantly readable in a glance.** Every card answers one question in
  ≤ 200 ms: is this OK, borderline, or urgent.
- **Bilingual and RTL-first-class.** Arabic isn't an afterthought — the
  entire layout mirrors correctly, numerals stay Latin (per Saudi UX norms),
  Cairo font renders every glyph clean.
- **Animated with purpose, not for show.** Motion communicates state change
  (a new packet arrived, a threshold crossed, an alarm triggered). Ambient
  animations (breathing chest indicators, subtle pulses) reinforce the
  "everything is monitored" feeling without becoming noise.

## 2. Palette

Warm, low-saturation neutrals for the app frame. Saturated status colors
that only appear when a value has a state.

### Neutral / surface

| Token          | Light         | Dark          | Use                          |
| -------------- | ------------- | ------------- | ---------------------------- |
| `--bg`         | `#fbf8f4`     | `#0f1115`     | Page background              |
| `--surface`    | `#ffffff`     | `#181b21`     | Cards, sheets                |
| `--surface-2`  | `#f4efe8`     | `#22262e`     | Nested cards, subtle rows    |
| `--border`     | `#ece4d7`     | `#2b2f38`     | Hairlines, dividers          |
| `--ink`        | `#1f2430`     | `#e7e9ee`     | Primary text                 |
| `--muted`      | `#6b7180`     | `#9098a8`     | Secondary text, captions     |

### Brand

| Token            | Hex          | Meaning                                  |
| ---------------- | ------------ | ---------------------------------------- |
| `--brand`        | `#4a7c8c`    | Primary — deep teal, calm and clinical    |
| `--brand-soft`   | `#dcece9`    | Brand tint for backgrounds, chips        |
| `--accent`       | `#e8956b`    | Warm accent — buttons, links, highlights |
| `--accent-soft`  | `#fbe8d9`    | Accent tint                              |

### Status (the only saturated colors)

| Token       | Hex        | State                          |
| ----------- | ---------- | ------------------------------ |
| `--ok`      | `#3fa072`  | In range, all clear            |
| `--warn`    | `#d99c2a`  | Borderline, watch this         |
| `--danger`  | `#c94b4b`  | Threshold breach, needs action |
| `--offline` | `#8892a3`  | Sensor missing / stale         |

Status colors always come with an **icon + label**, never color-only, so
color-blind parents still parse state.

## 3. Typography

- **Latin**: Inter (400 / 500 / 600 / 700). Base 16 px, scale below.
- **Arabic**: Cairo (400 / 500 / 600 / 700). 1.9 line-height.
- **Monospace**: JetBrains Mono for raw sensor codes and IDs only.
- **Live numeric readouts**: `font-variant-numeric: tabular-nums` so digits
  don't jitter when a value updates each second.

### Scale (rem, mobile-first — nudged up on `md+`)

| Token         | Size        | Weight | Use                       |
| ------------- | ----------- | ------ | ------------------------- |
| `display-xl`  | 4.5rem      | 700    | Hero live values (HR bpm) |
| `display`     | 3rem        | 700    | Big values on cards       |
| `h1`          | 2rem        | 700    | Page titles               |
| `h2`          | 1.5rem      | 600    | Section headers           |
| `h3`          | 1.125rem    | 600    | Card headers              |
| `body`        | 1rem        | 400    | Body text                 |
| `small`       | 0.875rem    | 400    | Captions, thresholds      |
| `tiny`        | 0.75rem     | 500    | Chip labels, timestamps   |

## 4. Space and radius

- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px (Tailwind's default).
- Container max-width: **1200 px** desktop, full-width mobile with 16 px pad.
- Card radius: **16 px**. Chip radius: **9999 px** (pill). Button radius: **12 px**.
- Card shadow (light): `0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)`.
- Card shadow (dark): none — a `1px` border instead, shadows read grey on dark.

## 5. Motion

We use **Framer Motion** everywhere. Three tiers of motion:

1. **Ambient** — always running, always subtle. Breathing chest icon,
   soft pulse under "connected" chip, sparkline scroll. Duration 2–6 s, ease
   in/out. Never blocks input.
2. **State-change** — plays once when a value updates or state flips.
   Number roll-up (200 ms, spring), chip color fade (250 ms), card border
   flash on threshold breach (600 ms, then fade). Respect `prefers-reduced-motion`.
3. **Alarm** — the only urgent motion. Full-card red border pulse @ 2 Hz,
   value scale bounce, side-toast slide in with slight overshoot spring.

### Motion tokens

```ts
export const motion = {
  spring:   { type: "spring", stiffness: 260, damping: 22 },
  easeOut:  { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.28 },
  slow:     { type: "tween", ease: "easeInOut", duration: 0.6 },
  ambient:  { repeat: Infinity, ease: "easeInOut", duration: 4 },
} as const;
```

`prefers-reduced-motion: reduce` disables tier 1 entirely, keeps tier 2
without spring overshoot, keeps tier 3 as a static red border (still visible,
just not animated).

## 6. Iconography

- **Lucide** for the whole UI. 24 px default, 20 px in dense rows, 32 px in
  cards. Stroke width `1.75`.
- **Custom SVGs** for the four sensor categories — a stylised pacifier,
  wristband, lung, and heart, drawn on a `48 × 48` grid, single color that
  inherits `currentColor`. These live in `src/components/icons/`.
- No emoji anywhere in the UI (unreliable rendering across OSes).

## 7. Component patterns

### `<SensorCard>`

The atomic unit of the dashboard.

```
┌────────────────────────────────────────────┐
│  [icon]  Heart rate            [state chip]│
│                                            │
│    128         bpm                         │
│  (display)  (small, muted)                 │
│                                            │
│  ▁▂▃▅▆▇▇▆▅▃▂▁▂▃▅  (10 s sparkline)         │
│                                            │
│  ── Threshold: 90–160 bpm ─────  [source]  │
└────────────────────────────────────────────┘
```

- Card radius 16, shadow at rest, **border color = current state** (never
  fill — fills would be too loud).
- Threshold shown *underneath* the value with a hairline separator, so a
  parent can see at a glance where the safe band is.
- State chip in the top-right: `OK / WATCH / ALERT / STALE`.

### `<SideToast>`

Sonner, positioned top-right on desktop, top-center on mobile. Max width
360 px. Never covers the sensor grid. Auto-dismiss 5 s for info, 10 s for
warn, sticky for alarm (dismiss requires acknowledge).

### `<BabyPill>`

Current-baby indicator in the header — avatar + name + tiny "connected"
dot. Tap → sheet with baby switcher + link to profile.

### `<ThresholdBadge>`

Shown under every live value. Format: `Normal: <lo>–<hi> <unit>`, or
`Alert if > <hi>` for one-sided thresholds. Color matches state.

### `<AlarmBanner>`

Only appears when an alarm is armed. Fixed at the top of the viewport,
below the header. Shows the metric, current value, threshold, elapsed
time. Buttons: **Snooze 5 min**, **Acknowledge**, **Silence session**.

## 8. Layout skeleton

```
┌─────────────────────────────────────────────────┐
│ Header: logo · baby pill · lang · theme · menu │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Sidebar     │   Main content (routes)          │
│  · Live      │   ────────────────────────────   │
│  · Profile   │                                  │
│  · Logs      │                                  │
│  · Reports   │                                  │
│  · Settings  │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
                                            [toasts →]
```

Mobile collapses sidebar into a bottom nav (5 icons). Alarm banner sits
between header and content on both.

## 9. Bilingual behavior

- Language toggle in header switches `<html lang>` and `dir` in one paint.
- Every string routed through `next-intl` — no hard-coded copy in JSX.
- Layout uses `logical properties` (`ps-*`, `pe-*`, `ms-auto`) not `pl-*`
  / `pr-*` so RTL mirrors automatically.
- Icons that carry direction (chevrons, arrows) get `rtl:rotate-180`.
- Numbers stay Latin (`1, 2, 3…`) even in Arabic UI — matches conventions
  for medical and telecom UX in Saudi.
- Time formatting: `date-fns` with matching locale.

## 10. Accessibility

- Every color-coded state also carries an icon and text label.
- All interactive elements reachable by keyboard, with visible focus rings
  (2 px, `--brand`, offset 2 px).
- `aria-live="polite"` for the sensor cards so screen readers announce
  changes without spamming.
- `aria-live="assertive"` for alarms.
- Alarm sound has a corresponding on-screen state — never sound-only.
- Minimum contrast 4.5:1 for all text, 3:1 for UI components.

## 11. Alarm sound design

- Three severity tiers: `chime` (warn), `pulse` (alert), `siren` (critical).
- Files served from `public/audio/*.mp3` at 96 kbps mono. All ≤ 8 s.
- Howler pre-loads on baby-select so the first alarm has zero latency.
- User can preview + pick per-metric alarm sound in settings.
- Global "silence session" kills all sound for the current tab only —
  never persisted, so it can't be forgotten.

## 12. States we render

For every metric we render one of:

| State     | Icon        | Border      | Chip label     | Behavior                    |
| --------- | ----------- | ----------- | -------------- | --------------------------- |
| `ok`      | check       | `--border`  | "OK"           | Silent                      |
| `warn`    | alert-tri   | `--warn`    | "Watch"        | Sonner info toast           |
| `alert`   | alert-oct   | `--danger`  | "Alert"        | Sonner sticky toast + chime |
| `critical`| siren       | `--danger`  | "Critical"     | Sticky + pulse + siren      |
| `stale`   | wifi-off    | `--offline` | "No data 12 s" | Sonner info                 |
| `off`     | circle-off  | `--offline` | "Sensor off"   | Silent                      |

## 13. Non-goals for this release

- No auth. Data lives in IndexedDB per browser.
- No cloud sync. Explicit trade-off — see main project brief.
- No native app. PWA-installable only.
- No parent-to-parent sharing.
- No medical diagnostic language anywhere.
