ALTER TABLE public.bank_custom_domains
  ADD COLUMN IF NOT EXISTS dns_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- Backfill verification tokens for existing rows so DNS TXT records can be issued.
UPDATE public.bank_custom_domains
SET verification_token = replace(id::text, '-', '')
WHERE verification_token IS NULL;