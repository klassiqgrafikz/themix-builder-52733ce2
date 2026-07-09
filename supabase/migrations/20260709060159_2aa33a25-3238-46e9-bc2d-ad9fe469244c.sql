
ALTER TABLE public.bb_bank_drafts
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS navigation jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS render_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS rendered_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bb_bank_drafts_render_status_check'
  ) THEN
    ALTER TABLE public.bb_bank_drafts
      ADD CONSTRAINT bb_bank_drafts_render_status_check
      CHECK (render_status IN ('draft','rendering','ready','published','archived'));
  END IF;
END $$;
