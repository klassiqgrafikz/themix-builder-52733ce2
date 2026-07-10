ALTER TABLE public.bb_bank_drafts
  ADD COLUMN IF NOT EXISTS dashboard_layout_draft jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_layout jsonb;