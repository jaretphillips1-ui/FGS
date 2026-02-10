-- ============================================================================
-- FGS Inventory Housekeeping (Auto + Manual Shopping, Green/Yellow/Shopping)
-- Safe, standalone schema. Additive only.
-- ============================================================================
-- Concepts:
--  - item_type: 'single' (durable) vs 'bulk' (consumable)
--  - defaults live in inventory_profiles
--  - per-variant overrides are nullable and win over defaults
--  - status is computed (never stored): GREEN / YELLOW / SHOPPING
--  - IMPORTANT: YELLOW triggers when quantity < low_threshold (not <=)
-- ============================================================================

-- 1) Defaults by item type
create table if not exists public.inventory_profiles (
  item_type text primary key check (item_type in ('single','bulk')),
  low_threshold_default int not null check (low_threshold_default >= 0),
  shop_threshold_default int not null check (shop_threshold_default >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed defaults (idempotent)
insert into public.inventory_profiles (item_type, low_threshold_default, shop_threshold_default)
values
  ('single', 1, 0),
  ('bulk',   5, 2)
on conflict (item_type) do nothing;

-- 2) Inventory variants (generic: lures, hooks, plastics, etc.)
create table if not exists public.inventory_variants (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  item_type text not null check (item_type in ('single','bulk')),

  quantity int not null default 0 check (quantity >= 0),

  auto_shop_enabled boolean not null default true,
  force_on_shopping_list boolean not null default false,

  low_threshold_override int null check (low_threshold_override is null or low_threshold_override >= 0),
  shop_threshold_override int null check (shop_threshold_override is null or shop_threshold_override >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) View: effective thresholds + computed status
create or replace view public.inventory_variant_status_v as
select
  v.*,

  coalesce(v.low_threshold_override, p.low_threshold_default) as low_threshold_effective,
  coalesce(v.shop_threshold_override, p.shop_threshold_default) as shop_threshold_effective,

  case
    when v.force_on_shopping_list = true then 'SHOPPING'
    when v.auto_shop_enabled = false then 'GREEN'
    when v.quantity <= coalesce(v.shop_threshold_override, p.shop_threshold_default) then 'SHOPPING'
    when v.quantity <  coalesce(v.low_threshold_override, p.low_threshold_default) then 'YELLOW'
    else 'GREEN'
  end as status

from public.inventory_variants v
join public.inventory_profiles p
  on p.item_type = v.item_type;

-- Notes:
-- - Single items: 1 = GREEN, 0 = SHOPPING
-- - Bulk items: GREEN above low_threshold, YELLOW below it, SHOPPING at/below shop_threshold
