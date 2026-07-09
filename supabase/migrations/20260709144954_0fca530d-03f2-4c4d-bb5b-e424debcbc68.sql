
-- Platform PIN (default 0499) stored hashed on gboc_platform_settings.
ALTER TABLE public.gboc_platform_settings
  ADD COLUMN IF NOT EXISTS platform_pin_hash text,
  ADD COLUMN IF NOT EXISTS platform_pin_plain text; -- kept so admin can reveal current PIN

-- Seed default PIN 0499 on any existing rows lacking one.
UPDATE public.gboc_platform_settings
   SET platform_pin_plain = COALESCE(platform_pin_plain, '0499'),
       platform_pin_hash  = COALESCE(platform_pin_hash, encode(digest('0499', 'sha256'), 'hex'))
 WHERE platform_pin_hash IS NULL OR platform_pin_plain IS NULL;

-- Country-specific banking identifiers on customer accounts.
ALTER TABLE public.bank_customer_accounts
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS swift_bic text,
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS sort_code text,
  ADD COLUMN IF NOT EXISTS bsb text,
  ADD COLUMN IF NOT EXISTS transit_number text,
  ADD COLUMN IF NOT EXISTS institution_number text;

-- pgcrypto for digest() (safe if already present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
