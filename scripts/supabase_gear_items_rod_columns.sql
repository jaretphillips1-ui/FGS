-- Adds rod-related columns used by /rods/new and /rods/[id] forms
-- Safe to run multiple times.

ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS rod_blank_text text,
  ADD COLUMN IF NOT EXISTS rod_guides_text text,

  ADD COLUMN IF NOT EXISTS rod_handle_text text,
  ADD COLUMN IF NOT EXISTS rod_reel_seat_text text,

  ADD COLUMN IF NOT EXISTS rod_storage_note text,
  ADD COLUMN IF NOT EXISTS storage_note text,

  ADD COLUMN IF NOT EXISTS rod_notes text,
  ADD COLUMN IF NOT EXISTS notes text,

  ADD COLUMN IF NOT EXISTS rod_length_in integer,
  ADD COLUMN IF NOT EXISTS length_in integer,

  ADD COLUMN IF NOT EXISTS rod_pieces integer,
  ADD COLUMN IF NOT EXISTS pieces integer,

  ADD COLUMN IF NOT EXISTS rod_power text,
  ADD COLUMN IF NOT EXISTS power text,

  ADD COLUMN IF NOT EXISTS rod_action text,
  ADD COLUMN IF NOT EXISTS action text;

-- If PostgREST schema cache errors ever appear, run:
-- NOTIFY pgrst, 'reload schema';
