-- scripts/supabase_catalog_and_reels.sql
-- Adds Catalog Products + Reel columns for gear_items
-- Safe to run multiple times.

-- -----------------------------
-- Catalog Products (manufacturer-first truth)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional: allow personal catalog rows; NULL = global/shared rows
  owner_id uuid NULL,

  product_type text NOT NULL CHECK (product_type IN ('rod','reel','line')),

  brand text NULL,
  model text NULL,
  variant text NULL,

  -- 1=manufacturer, 2=dealer sheet, 3=tackle warehouse, 4=other
  source_rank integer NOT NULL DEFAULT 3 CHECK (source_rank >= 1 AND source_rank <= 9),
  source_name text NULL,
  source_url text NULL,

  -- Reel truth specs (nullable; only meaningful when product_type='reel')
  reel_type text NULL,          -- baitcaster | spinning | bfs | round | other
  reel_hand text NULL,          -- left | right
  reel_gear_ratio text NULL,    -- e.g. "7.4:1"
  reel_ipt_in numeric NULL,     -- inches per turn
  reel_weight_oz numeric NULL,
  reel_max_drag_lb numeric NULL,
  reel_bearings text NULL,      -- e.g. "6+1"
  reel_line_capacity text NULL, -- flexible string for now: "12/120, 14/110, 30B/150"
  reel_brake_system text NULL,

  notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for dropdown/search
CREATE INDEX IF NOT EXISTS catalog_products_type_brand_model_idx
  ON public.catalog_products (product_type, brand, model);

-- -----------------------------
-- gear_items: link to catalog + reel columns
-- -----------------------------
ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid,

  -- Reel fields (your item overrides; truth may also live in catalog_products)
  ADD COLUMN IF NOT EXISTS reel_type text,
  ADD COLUMN IF NOT EXISTS reel_hand text,
  ADD COLUMN IF NOT EXISTS reel_gear_ratio text,
  ADD COLUMN IF NOT EXISTS reel_ipt_in numeric,
  ADD COLUMN IF NOT EXISTS reel_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS reel_max_drag_lb numeric,
  ADD COLUMN IF NOT EXISTS reel_bearings text,
  ADD COLUMN IF NOT EXISTS reel_line_capacity text,
  ADD COLUMN IF NOT EXISTS reel_brake_system text,

  -- Cross-gear shared fields (already exist for rods, but safe):
  ADD COLUMN IF NOT EXISTS storage_note text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Add FK if missing (Postgres doesn't support IF NOT EXISTS on constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gear_items_catalog_product_id_fkey'
  ) THEN
    ALTER TABLE public.gear_items
      ADD CONSTRAINT gear_items_catalog_product_id_fkey
      FOREIGN KEY (catalog_product_id)
      REFERENCES public.catalog_products(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS gear_items_catalog_product_id_idx
  ON public.gear_items(catalog_product_id);

-- If PostgREST schema cache errors ever appear, run:
-- NOTIFY pgrst, 'reload schema';