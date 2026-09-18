# NeuroGuard Web App

The parent-facing dashboard for the NeuroGuard smart pacifier + foot bracelet.

- **Talks to the hub over Web Bluetooth** (Chrome / Edge / Chromium on desktop or Android — no iOS Safari).
- **Runs entirely in the browser.** Baby profiles, thresholds, alarm prefs, logs and packet history live in IndexedDB. No account, no cloud.
- **Bilingual (English + Arabic)** with RTL flip; language stored in a cookie.
- **Deploys as a static Next.js site** to Vercel or any Node host.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Framer Motion (animations)
- Sonner (side-view toasts)
- Zustand (state), Dexie (IndexedDB), react-hook-form + zod (forms)
- next-intl (i18n)
- Web Audio API for the alarm engine (no MP3 assets)

See [`DESIGN.md`](./DESIGN.md) for the visual + interaction system.

## Local dev

```bash
cd webapp
npm install
npm run dev             # http://localhost:3000
```

The **"Mock stream"** toggle on the Live page pushes generated packets at 1 Hz so
you can exercise the whole dashboard, alarm engine, logs and reports without any
hardware. Real BLE requires the ESP32-S3 hub firmware update in the parent repo.

## Production build

```bash
npm run build
npm run start
```

## Deploy to Vercel

The `webapp/` folder is a self-contained Next.js project. Point Vercel at it:

1. Push this repo to GitHub.
2. In Vercel: **Import Project** → pick the repo → set **Root Directory** to
   `webapp`. Framework auto-detects as **Next.js**.
3. Deploy. Add a custom domain if you want.

There are no environment variables to configure; everything runs client-side.

## Project structure

```
src/
├── app/
│   ├── layout.tsx           Root layout — fonts, i18n provider, Sonner toaster
│   ├── page.tsx             Landing hero + connect CTA
│   └── (app)/               Route group with the header+sidebar shell
│       ├── layout.tsx       App shell (alarm banner mounted here)
│       ├── live/            Live sensor dashboard
│       ├── profile/         Baby profile view / create / edit
│       ├── logs/            Event log with CSV export
│       ├── reports/         Daily / weekly aggregates
│       └── settings/        Thresholds, alarm prefs, danger zone
├── components/
│   ├── ui/                  shadcn primitives (button, card, dialog, …)
│   ├── layout/              Header, sidebar, bottom nav, logo, connection chip
│   ├── icons/               Custom SVG icons (pacifier, wristband)
│   ├── baby/                Profile forms + baby switcher pill
│   ├── sensor/              SensorCard, ThresholdBadge, StateChip, Sparkline
│   └── alarm/               Sticky AlarmBanner
├── hooks/
│   ├── use-ble.ts           Web Bluetooth wrapper + mock-stream integration
│   ├── use-thresholds.ts    Per-baby threshold lookup
│   ├── use-history.ts       Rolling metric buffers for sparklines
│   ├── use-alarm-watcher.ts Threshold + audio + toast + logging loop
│   └── use-packet-recorder.ts  Persists packets to IndexedDB for Reports
├── lib/
│   ├── db.ts                Dexie schema + retention
│   ├── types.ts             Baby / Threshold / Log / Packet types
│   ├── thresholds.ts        Default thresholds + evaluate()
│   ├── packet.ts            Wire types + BraceletWire parser (byte-exact)
│   ├── ble.ts               connectHub / disconnectHub
│   ├── mock-packet.ts       generateMockPacket()
│   └── alarm.ts             Web Audio alarm engine (chime / pulse / siren)
├── stores/
│   ├── ble-store.ts         BLE status + last packet
│   ├── baby-store.ts        Babies + currentBabyId (persisted)
│   ├── alarm-store.ts       Per-metric alarm state (snooze / ack)
│   └── ui-store.ts          Mock stream toggle, session-silence flag
├── i18n/
│   ├── config.ts            Locale constants (client-safe)
│   └── request.ts           next-intl RSC config (reads cookie)
└── messages/
    ├── en.json              English catalog
    └── ar.json              Arabic catalog
```

## Notes

- **iOS Safari is unsupported** by Web Bluetooth. That's a platform choice
  Apple made — the app itself renders fine on Safari but the connect button
  will show "Web Bluetooth isn't available."
- **All data is local.** Clearing browser storage wipes profiles and history.
  Settings → Data & privacy will offer an export later.
