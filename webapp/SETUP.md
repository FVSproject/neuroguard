# NeuroGuard — Setup

Two accounts, both free tier.

- **Supabase** — auth + Postgres + storage. https://supabase.com/dashboard
- **Vercel** — hosting. https://vercel.com

## 1. Supabase (5 min)

1. https://supabase.com/dashboard → **New project**. Name it `neuroguard`,
   pick the region closest to your users (`eu-central-1` for MENA).
   Save the DB password somewhere safe (Supabase shows it once).
2. Once the project is live, open **Settings → API** and copy two values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Open **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql`, and hit **Run**. This creates all six tables plus
   row-level-security policies that scope every row to `auth.uid()`.
4. **Auth → Providers**: leave Email enabled. Enable **Google** if you want
   one-click sign-in (paste a Google OAuth client ID/secret — Supabase's
   docs walk through the 5-minute Google Cloud setup).
5. **Auth → URL Configuration**: add these to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-url>.vercel.app/auth/callback`

## 2. Local dev

```bash
cd webapp
cp .env.example .env.local
# paste the URL + anon key into .env.local

npm install
npm run dev             # http://localhost:3000
```

Open http://localhost:3000 → **Create account** → sign up with email or
Google → dashboard.

## 3. Deploy to Vercel

1. Vercel project → **Settings → Environment Variables** → add
   `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for
   Production / Preview / Development.
2. **Settings → General → Root Directory** = `webapp` (if not already).
3. **Deployments** → find the failed / latest build → **Redeploy**, or push
   a commit.

## 4. Firmware / hardware

Unchanged. Flash `code/NeuroGuard_Hub_BLE/`, open the Vercel URL in Chrome
on Android, sign in, click **Connect to hub**, pick **NG-Pacifier**.

## Free-tier ceilings

- **Supabase free** — 500 MB DB, 50 000 monthly active users, 1 GB storage.
  Alarm logs are the only writes at runtime (sensor packets stay in the
  browser IndexedDB), so we sit comfortably under quota.
- **Vercel Hobby** — 100 GB bandwidth, plenty for parents opening the app.

## Security notes

- The **anon key** is safe in `NEXT_PUBLIC_*` — clients can only see rows
  where `auth.uid()` matches the row's owner, enforced by RLS on the DB
  side. Do NOT paste the **service_role** key anywhere; the app doesn't
  need it.
- Rotate any DB password / key you paste into chat or a shared doc:
  Supabase → Settings → Database → Reset password.
