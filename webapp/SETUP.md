# NeuroGuard — Setup

You need three accounts. All are free-tier for this project.

- **Clerk** — auth. https://dashboard.clerk.com
- **Neon** — Postgres. https://console.neon.tech
- **Vercel** — hosting. https://vercel.com

## 1. Clerk

1. Go to https://dashboard.clerk.com → **Create application**.
2. Name it `neuroguard`. Enable Email + at least one social login (Google is easiest for parents).
3. On the **API Keys** page, copy:
   - **Publishable key** (starts with `pk_test_...`) → paste as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** (starts with `sk_test_...`) → paste as `CLERK_SECRET_KEY`

## 2. Neon

1. Go to https://console.neon.tech → **New Project**.
2. Name it `neuroguard`. Region: pick the one closest to your users (`aws-eu-central-1` for MENA, `aws-us-east-1` for US).
3. On the **Connection Details** page, copy the **Pooled connection** string → paste as `DATABASE_URL`.
4. Also copy the **Direct connection** string (toggle "Direct connection") → paste as `DIRECT_URL`.

Both should end with `?sslmode=require`.

## 3. Local dev

```bash
cd webapp
cp .env.example .env.local
# then paste your Clerk + Neon values into .env.local

npm install                 # installs deps + runs `prisma generate` via postinstall
npm run prisma:migrate      # creates all tables in Neon (asks you to name the migration; "init" is fine)
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000` → click **Create account** → sign up with email → you're in.

## 4. Deploy to Vercel

In the Vercel project (`fvs4/neuroguard`):

1. **Settings → Environment Variables**. Add every variable from `.env.local`
   for **Production, Preview, Development** (paste-all in one shot works).
2. **Settings → General → Root Directory** → `webapp` (if not already set).
3. **Deployments → latest → Redeploy** OR push a new commit.

The build command already runs `prisma generate` before `next build`, so
Vercel will pick up the schema automatically. The first successful build
also creates the tables on Neon if you ran `prisma:migrate` locally against
the same DB.

## 5. Firmware / hardware

Unchanged from before — the frontend + backend switch didn't touch the
ESP32 or bracelet sketches. Flash `code/NeuroGuard_Hub_BLE/` when ready,
open the Vercel URL in Chrome on Android, sign in, click **Connect to hub**,
pick **NG-Pacifier**.

## Cost — free-tier ceilings

- **Clerk free** — 10 000 monthly active users. More than enough.
- **Neon free** — 0.5 GB storage, 190 compute hours/month.
- **Vercel Hobby** — 100 GB bandwidth, 100 GB-hours serverless execution.

Alarm log entries are the only server-side writes at runtime; sensor packets
still buffer in the browser's IndexedDB (`packet-db.ts`) so we stay well
within the Neon quota.
