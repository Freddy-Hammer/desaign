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

-- Newsletter integration: lets the /newsletter picker mark jobs as sent
-- so they don't appear in next week's picker. NULL = eligible for the
-- next newsletter; 'sent' = already used.
alter table jobs add column if not exists newsletter_status text default null;
create index if not exists jobs_newsletter_status_idx on jobs (newsletter_status)
  where newsletter_status is null or newsletter_status = 'queued';

-- Telegram integration: marks a job as already broadcast so the daily
-- telegram-post script never re-sends. NULL = unsent; timestamp = sent.
alter table jobs add column if not exists telegram_sent_at timestamptz default null;
create index if not exists jobs_telegram_unsent_idx on jobs (first_seen_at desc)
  where telegram_sent_at is null and active = true;

-- Skills/tools extraction (stage 1 of /skills-and-tools page).
-- description: plain-text job posting body, captured by the scrapers and used
-- as input to the dictionary-based extractor in scripts/jobs/extract-skills-tools.ts.
-- skills/tools: dictionary keys matched in description (deterministic, re-derivable).
-- skills_extracted_at: when extraction last ran for this row; null = needs (re-)extract.
alter table jobs add column if not exists description text default null;
alter table jobs add column if not exists skills text[] default null;
alter table jobs add column if not exists tools text[] default null;
alter table jobs add column if not exists skills_extracted_at timestamptz default null;
create index if not exists jobs_skills_gin_idx on jobs using gin (skills);
create index if not exists jobs_tools_gin_idx on jobs using gin (tools);

alter table jobs enable row level security;

-- Public read: active jobs only. Frontend uses anon key.
drop policy if exists "anon read active jobs" on jobs;
create policy "anon read active jobs" on jobs
  for select to anon
  using (active = true);

-- Service role bypasses RLS automatically; no explicit policy needed.
