-- DesAIgn Radar — jobs table
-- Run this once in the Supabase SQL editor before running
-- `npx tsx scripts/jobs/index.ts --insert`.

create table if not exists jobs (
  id text primary key,                              -- sha1(company|title|url) — 16 hex chars
  company text not null,
  title text not null,
  location text,
  url text not null,
  posted_date timestamptz,
  department text,
  platform text not null,                           -- greenhouse | lever | ashby | custom
  category text not null,                           -- Design | Brand | Motion | Design Eng | AI/Creative | Other
  active boolean not null default true,
  source text not null default 'scraper',           -- 'scraper' | 'manual'
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists jobs_active_posted_idx on jobs (active, posted_date desc nulls last);
create index if not exists jobs_category_active_idx on jobs (category, active);

alter table jobs enable row level security;

-- Public read: active jobs only. Frontend uses anon key.
drop policy if exists "anon read active jobs" on jobs;
create policy "anon read active jobs" on jobs
  for select to anon
  using (active = true);

-- Service role bypasses RLS automatically; no explicit policy needed.
