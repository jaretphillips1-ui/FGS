-- FGS: combos table + RLS
-- Creates: public.combos
-- Depends on: public.gear_items(id), auth.uid()

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  rod_id uuid not null references public.gear_items(id) on delete restrict,
  reel_id uuid not null references public.gear_items(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate rod+reel combos per owner
create unique index if not exists combos_owner_rod_reel_uniq
  on public.combos (owner_id, rod_id, reel_id);

create index if not exists combos_owner_id_idx on public.combos (owner_id);
create index if not exists combos_rod_id_idx on public.combos (rod_id);
create index if not exists combos_reel_id_idx on public.combos (reel_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_combos_set_updated_at on public.combos;
create trigger trg_combos_set_updated_at
before update on public.combos
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.combos enable row level security;

-- Policies
drop policy if exists "combos_select_own" on public.combos;
create policy "combos_select_own"
on public.combos for select
using (owner_id = auth.uid());

drop policy if exists "combos_insert_own" on public.combos;
create policy "combos_insert_own"
on public.combos for insert
with check (owner_id = auth.uid());

drop policy if exists "combos_update_own" on public.combos;
create policy "combos_update_own"
on public.combos for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "combos_delete_own" on public.combos;
create policy "combos_delete_own"
on public.combos for delete
using (owner_id = auth.uid());
