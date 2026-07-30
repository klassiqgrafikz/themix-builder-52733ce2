-- Add columns to bank_custom_domains for Namecheap domain registration support

ALTER TABLE public.bank_custom_domains
  ADD COLUMN IF NOT EXISTS registrant_info JSONB,
  ADD COLUMN IF NOT EXISTS registered_via TEXT,
  ADD COLUMN IF NOT EXISTS registration_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_dns BOOLEAN NOT NULL DEFAULT false;
