-- =========================================================
-- FGS: Species Groups + assignments + RLS
-- Paste into Supabase SQL Editor when maintenance is over
-- =========================================================

-- 1) Groups table
create table if not exists public.species_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2) Add group_id to species (nullable for flexibility)
alter table public.species
add column if not exists group_id uuid references public.species_groups(id);

-- 3) RLS: read-only for authenticated
alter table public.species_groups enable row level security;

drop policy if exists "species_groups_read_authenticated" on public.species_groups;
create policy "species_groups_read_authenticated"
on public.species_groups
for select
to authenticated
using (true);

-- (Optional) If you want species readable only to authenticated too
alter table public.species enable row level security;

drop policy if exists "species_read_authenticated" on public.species;
create policy "species_read_authenticated"
on public.species
for select
to authenticated
using (true);

-- 4) Seed your 5 rod-driven groups
insert into public.species_groups (name, sort_order) values
  ('Light / Panfish & Utility', 10),
  ('Bass / General Casting', 20),
  ('Striped Bass Gear', 30),
  ('Muskie / Big Predator Gear', 40),
  ('Sturgeon / Big Game', 50)
on conflict (name) do update
set sort_order = excluded.sort_order;

-- 5) Assign species to groups (matches what you described)
with g as (
  select
    (select id from public.species_groups where name = 'Light / Panfish & Utility') as light_id,
    (select id from public.species_groups where name = 'Bass / General Casting') as bass_id,
    (select id from public.species_groups where name = 'Striped Bass Gear') as striper_id,
    (select id from public.species_groups where name = 'Muskie / Big Predator Gear') as muskie_id,
    (select id from public.species_groups where name = 'Sturgeon / Big Game') as sturgeon_id
)
update public.species s
set group_id =
  case
    when s.name in ('Largemouth Bass','Smallmouth Bass','Chain Pickerel') then (select bass_id from g)
    when s.name in ('Striped Bass') then (select striper_id from g)
    when s.name in ('Muskie') then (select muskie_id from g)
    when s.name in ('Sturgeon') then (select sturgeon_id from g)
    else (select light_id from g)
  end
where s.group_id is null;

-- 6) Quick check
select sg.name as "group", s.name as "species"
from public.species s
join public.species_groups sg on sg.id = s.group_id
order by sg.sort_order, s.name;
