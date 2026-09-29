-- Fine Print CA — schema
-- Run this in the Supabase SQL editor (or via supabase db push) BEFORE seed.sql.

create extension if not exists pgcrypto;

-- ---------- elections ----------
create table if not exists elections (
  id            text primary key,           -- e.g. 'ca-2026-11'
  name          text not null,
  election_date date not null,
  official_guide_url text,
  funding_as_of date
);

-- ---------- measures ----------
create table if not exists measures (
  id              serial primary key,
  election_id     text not null references elections(id) on delete cascade,
  number          int  not null,
  slug            text not null unique,
  short_title     text not null,
  official_title  text not null,
  type            text,
  origin          text,
  what_it_does    text,
  yes_means       text,
  no_means        text,
  fiscal_impact   text,
  pro_arguments   jsonb not null default '[]',   -- text[]
  con_arguments   jsonb not null default '[]',
  leaves_out_yes  jsonb not null default '[]',   -- what YES ads tend to leave out
  leaves_out_no   jsonb not null default '[]',   -- what NO ads tend to leave out
  campaign_links  jsonb not null default '{}',   -- {yes:[], no:[]}
  sources         jsonb not null default '[]',
  published       boolean not null default true,
  updated_at      timestamptz not null default now(),
  unique (election_id, number)
);

-- ---------- committees ----------
create table if not exists committees (
  id          serial primary key,
  measure_id  int not null references measures(id) on delete cascade,
  side        text not null check (side in ('yes','no')),
  name        text not null,
  fppc_id     text,
  top_funders jsonb not null default '[]',
  raised      text,
  sort_order  int default 0
);

-- ---------- ads ----------
create table if not exists ads (
  id          text primary key,             -- stable slug e.g. 'prop40-yes-first-tv'
  measure_id  int not null references measures(id) on delete cascade,
  side        text not null check (side in ('yes','no')),
  title       text not null,
  sponsor     text,
  format      text,                          -- TV | Video | Digital | Mailer | Radio
  url         text,
  transcript  text,
  first_seen  text,
  status      text not null default 'draft'
              check (status in ('draft','needs_transcript','published','rejected')),
  created_at  timestamptz not null default now()
);

-- ---------- claims (per ad): what it says / what it leaves out ----------
create table if not exists claims (
  id          serial primary key,
  ad_id       text not null references ads(id) on delete cascade,
  claim       text not null,                 -- what the ad says
  context     text not null,                 -- what it leaves out / sourced context
  source_url  text,
  sort_order  int default 0
);

-- ---------- ad_reports: "I just saw an ad" submissions from visitors ----------
create table if not exists ad_reports (
  id            uuid primary key default gen_random_uuid(),
  measure_id    int references measures(id) on delete set null,
  side          text check (side in ('yes','no','unsure')),
  where_seen    text,                          -- channel / show / platform
  what_it_said  text not null,
  link          text,
  contact_email text,
  status        text not null default 'new' check (status in ('new','reviewed','added','rejected')),
  created_at    timestamptz not null default now()
);

-- ---------- RLS ----------
alter table elections  enable row level security;
alter table measures   enable row level security;
alter table committees enable row level security;
alter table ads        enable row level security;
alter table claims     enable row level security;
alter table ad_reports enable row level security;

-- Public read on published content
create policy "public read elections"  on elections  for select using (true);
create policy "public read measures"   on measures   for select using (published);
create policy "public read committees" on committees for select
  using (exists (select 1 from measures m where m.id = committees.measure_id and m.published));
create policy "public read ads"        on ads        for select using (status = 'published' or status = 'needs_transcript');
create policy "public read claims"     on claims     for select
  using (exists (select 1 from ads a where a.id = claims.ad_id and a.status in ('published','needs_transcript')));

-- Anyone can submit an ad report; nobody (anon) can read them back
create policy "anon insert ad_reports" on ad_reports for insert with check (true);

-- Convenience view: measure with counts
create or replace view measure_summary as
select m.*,
  (select count(*) from ads a where a.measure_id = m.id and a.side='yes' and a.status in ('published','needs_transcript')) as yes_ad_count,
  (select count(*) from ads a where a.measure_id = m.id and a.side='no'  and a.status in ('published','needs_transcript')) as no_ad_count
from measures m;
