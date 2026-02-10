-- scripts/supabase_gear_intake.sql
-- Photo Intake (Gear Inbox) + Storage policies
-- Safe to run multiple times.

-- ============================================================================
-- 1) Intake tables
-- ============================================================================

create table if not exists public.gear_intake_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- broad bucket for now; we’ll refine later
  category text not null,
  status text not null check (status in ('owned','wishlist')),

  brand text null,
  model text null,
  notes text null,

  -- for future OCR
  raw_text text null,

  -- later: link to a real gear_item when we add promotion flow
  promoted_gear_item_id uuid null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gear_intake_items_owner_updated_idx
  on public.gear_intake_items (owner_id, updated_at desc);

create index if not exists gear_intake_items_owner_category_idx
  on public.gear_intake_items (owner_id, category);

-- Photos for an intake item (paths point into Supabase Storage)
create table if not exists public.gear_intake_photos (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.gear_intake_items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists gear_intake_photos_intake_id_idx
  on public.gear_intake_photos (intake_id);

-- updated_at trigger (re-uses your existing public.set_updated_at() if present)
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace
  ) then
    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end$$;

drop trigger if exists trg_gear_intake_items_set_updated_at on public.gear_intake_items;
create trigger trg_gear_intake_items_set_updated_at
before update on public.gear_intake_items
for each row execute function public.set_updated_at();

-- ============================================================================
-- 2) RLS
-- ============================================================================

alter table public.gear_intake_items enable row level security;
alter table public.gear_intake_photos enable row level security;

drop policy if exists "gear_intake_items_select_own" on public.gear_intake_items;
create policy "gear_intake_items_select_own"
on public.gear_intake_items for select
using (owner_id = auth.uid());

drop policy if exists "gear_intake_items_insert_own" on public.gear_intake_items;
create policy "gear_intake_items_insert_own"
on public.gear_intake_items for insert
with check (owner_id = auth.uid());

drop policy if exists "gear_intake_items_update_own" on public.gear_intake_items;
create policy "gear_intake_items_update_own"
on public.gear_intake_items for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "gear_intake_items_delete_own" on public.gear_intake_items;
create policy "gear_intake_items_delete_own"
on public.gear_intake_items for delete
using (owner_id = auth.uid());

drop policy if exists "gear_intake_photos_select_own" on public.gear_intake_photos;
create policy "gear_intake_photos_select_own"
on public.gear_intake_photos for select
using (owner_id = auth.uid());

drop policy if exists "gear_intake_photos_insert_own" on public.gear_intake_photos;
create policy "gear_intake_photos_insert_own"
on public.gear_intake_photos for insert
with check (owner_id = auth.uid());

drop policy if exists "gear_intake_photos_delete_own" on public.gear_intake_photos;
create policy "gear_intake_photos_delete_own"
on public.gear_intake_photos for delete
using (owner_id = auth.uid());

-- ============================================================================
-- 3) Storage bucket + policies
--    Bucket: gear-photos
--    Path convention: private/{uid}/{intakeId}/{filename}
-- ============================================================================

-- Create bucket if missing (Supabase storage lives in storage.buckets)
insert into storage.buckets (id, name, public)
values ('gear-photos', 'gear-photos', false)
on conflict (id) do nothing;

-- Allow owner to read their own objects in their folder
drop policy if exists "gear_photos_read_own" on storage.objects;
create policy "gear_photos_read_own"
on storage.objects for select
using (
  bucket_id = 'gear-photos'
  and (storage.foldername(name))[1] = 'private'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow owner to upload into their own folder
drop policy if exists "gear_photos_insert_own" on storage.objects;
create policy "gear_photos_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'gear-photos'
  and (storage.foldername(name))[1] = 'private'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow owner to delete their own objects
drop policy if exists "gear_photos_delete_own" on storage.objects;
create policy "gear_photos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'gear-photos'
  and (storage.foldername(name))[1] = 'private'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- If PostgREST schema cache errors appear:
-- NOTIFY pgrst, 'reload schema';
