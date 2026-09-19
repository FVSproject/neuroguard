-- ============================================================================
--  NeuroGuard — schema for Supabase
--
--  Paste this file into the SQL editor at
--    https://supabase.com/dashboard/project/<your-project>/sql/new
--  and hit "Run". Idempotent — safe to run again on top of itself.
--
--  Tenancy: every row is filtered by auth.uid(). We put user_id only on
--  `babies`; dependent tables inherit access through babyId → babies.user_id
--  in their RLS policies. That way a parent can only see / mutate their own
--  babies' data, without any app-layer where-clauses.
-- ============================================================================

-- ---------- tables ----------

create table if not exists public.babies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  dob            date,
  weight_kg      numeric(4,2),
  height_cm      numeric(5,2),
  gender         text check (gender in ('male','female','other')),
  notes          text,
  photo_data_url text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists babies_user_id_idx on public.babies(user_id);

create table if not exists public.parents (
  id       uuid primary key default gen_random_uuid(),
  baby_id  uuid not null references public.babies(id) on delete cascade,
  name     text not null,
  phone    text,
  email    text,
  relation text
);
create index if not exists parents_baby_id_idx on public.parents(baby_id);

create table if not exists public.emergency_contacts (
  id       uuid primary key default gen_random_uuid(),
  baby_id  uuid not null references public.babies(id) on delete cascade,
  name     text not null,
  phone    text not null,
  relation text,
  "order"  int  not null default 0
);
create index if not exists emergency_contacts_baby_order_idx
  on public.emergency_contacts(baby_id, "order");

create table if not exists public.baby_thresholds (
  baby_id    uuid primary key references public.babies(id) on delete cascade,
  entries    jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.alarm_prefs (
  baby_id       uuid primary key references public.babies(id) on delete cascade,
  sound_enabled boolean not null default true,
  sound_name    text not null default 'pulse',
  volume        real not null default 0.8,
  vibrate       boolean not null default true,
  updated_at    timestamptz not null default now()
);

create table if not exists public.log_entries (
  id       bigserial primary key,
  baby_id  uuid not null references public.babies(id) on delete cascade,
  ts_ms    bigint not null,
  kind     text not null,
  metric   text,
  severity text not null,
  message  text not null,
  value    double precision
);
create index if not exists log_entries_baby_ts_idx
  on public.log_entries(baby_id, ts_ms desc);

-- ---------- updated_at triggers ----------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists babies_touch on public.babies;
create trigger babies_touch
  before update on public.babies
  for each row execute function public.touch_updated_at();

drop trigger if exists thresholds_touch on public.baby_thresholds;
create trigger thresholds_touch
  before update on public.baby_thresholds
  for each row execute function public.touch_updated_at();

drop trigger if exists alarm_touch on public.alarm_prefs;
create trigger alarm_touch
  before update on public.alarm_prefs
  for each row execute function public.touch_updated_at();

-- ---------- row-level security ----------

alter table public.babies              enable row level security;
alter table public.parents             enable row level security;
alter table public.emergency_contacts  enable row level security;
alter table public.baby_thresholds     enable row level security;
alter table public.alarm_prefs         enable row level security;
alter table public.log_entries         enable row level security;

-- babies: direct owner check
drop policy if exists babies_owner_all on public.babies;
create policy babies_owner_all
  on public.babies
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- helper: the set of baby ids the current user owns
--    (inlined into each policy — Postgres inlines the subquery efficiently)

drop policy if exists parents_owner_all on public.parents;
create policy parents_owner_all
  on public.parents
  for all
  using      (baby_id in (select id from public.babies where user_id = auth.uid()))
  with check (baby_id in (select id from public.babies where user_id = auth.uid()));

drop policy if exists emergency_contacts_owner_all on public.emergency_contacts;
create policy emergency_contacts_owner_all
  on public.emergency_contacts
  for all
  using      (baby_id in (select id from public.babies where user_id = auth.uid()))
  with check (baby_id in (select id from public.babies where user_id = auth.uid()));

drop policy if exists baby_thresholds_owner_all on public.baby_thresholds;
create policy baby_thresholds_owner_all
  on public.baby_thresholds
  for all
  using      (baby_id in (select id from public.babies where user_id = auth.uid()))
  with check (baby_id in (select id from public.babies where user_id = auth.uid()));

drop policy if exists alarm_prefs_owner_all on public.alarm_prefs;
create policy alarm_prefs_owner_all
  on public.alarm_prefs
  for all
  using      (baby_id in (select id from public.babies where user_id = auth.uid()))
  with check (baby_id in (select id from public.babies where user_id = auth.uid()));

drop policy if exists log_entries_owner_all on public.log_entries;
create policy log_entries_owner_all
  on public.log_entries
  for all
  using      (baby_id in (select id from public.babies where user_id = auth.uid()))
  with check (baby_id in (select id from public.babies where user_id = auth.uid()));
