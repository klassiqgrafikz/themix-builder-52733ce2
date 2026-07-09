
-- ============================================================
-- Beneficiaries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('own','internal','external')),
  beneficiary_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  bank_code TEXT,
  nickname TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_beneficiaries_customer ON public.bank_beneficiaries(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_beneficiaries_bank ON public.bank_beneficiaries(bank_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_beneficiaries TO authenticated;
GRANT ALL ON public.bank_beneficiaries TO service_role;
ALTER TABLE public.bank_beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages beneficiaries" ON public.bank_beneficiaries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER bb_touch_bank_beneficiaries BEFORE UPDATE ON public.bank_beneficiaries FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- ============================================================
-- Cards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  account_id UUID NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'virtual' CHECK (card_type IN ('virtual','physical')),
  brand TEXT NOT NULL DEFAULT 'visa',
  card_holder TEXT NOT NULL,
  masked_number TEXT NOT NULL,
  last4 TEXT NOT NULL,
  expiry_month INT NOT NULL,
  expiry_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','blocked','replaced','expired')),
  daily_limit NUMERIC(18,2) NOT NULL DEFAULT 1000,
  monthly_limit NUMERIC(18,2) NOT NULL DEFAULT 20000,
  currency TEXT NOT NULL DEFAULT 'USD',
  frozen_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_cards_customer ON public.bank_cards(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_cards_account ON public.bank_cards(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_cards TO authenticated;
GRANT ALL ON public.bank_cards TO service_role;
ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages cards" ON public.bank_cards FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER bb_touch_bank_cards BEFORE UPDATE ON public.bank_cards FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- ============================================================
-- Support Tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  channel TEXT NOT NULL DEFAULT 'ticket' CHECK (channel IN ('ticket','chat','contact_form')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON public.bank_support_tickets(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_bank ON public.bank_support_tickets(bank_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_support_tickets TO authenticated;
GRANT ALL ON public.bank_support_tickets TO service_role;
ALTER TABLE public.bank_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages tickets" ON public.bank_support_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER bb_touch_bank_support_tickets BEFORE UPDATE ON public.bank_support_tickets FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.bank_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.bank_support_tickets(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('customer','agent','system')),
  author_id UUID,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.bank_support_messages(ticket_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_support_messages TO authenticated;
GRANT ALL ON public.bank_support_messages TO service_role;
ALTER TABLE public.bank_support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages support messages" ON public.bank_support_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Financial Event Bus
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  customer_id UUID,
  account_id UUID,
  transaction_id UUID,
  ledger_entry_id UUID,
  event_type TEXT NOT NULL,
  direction TEXT,
  amount NUMERIC(18,2),
  currency TEXT,
  correlation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_financial_events_bank ON public.bank_financial_events(bank_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_events_correlation ON public.bank_financial_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_customer ON public.bank_financial_events(customer_id, created_at DESC);
GRANT SELECT ON public.bank_financial_events TO authenticated;
GRANT ALL ON public.bank_financial_events TO service_role;
ALTER TABLE public.bank_financial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages financial events" ON public.bank_financial_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Trusted Devices (customer security center)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_customer_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  label TEXT NOT NULL,
  device_fingerprint TEXT,
  user_agent TEXT,
  ip TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_customer ON public.bank_customer_trusted_devices(customer_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_customer_trusted_devices TO authenticated;
GRANT ALL ON public.bank_customer_trusted_devices TO service_role;
ALTER TABLE public.bank_customer_trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages trusted devices" ON public.bank_customer_trusted_devices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Platform Settings (global toggles controlled from GBOC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gboc_platform_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  live_chat_enabled BOOLEAN NOT NULL DEFAULT false,
  support_email TEXT,
  support_phone TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.gboc_platform_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.gboc_platform_settings TO anon, authenticated;
GRANT ALL ON public.gboc_platform_settings TO service_role;
ALTER TABLE public.gboc_platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads platform settings" ON public.gboc_platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service manages platform settings" ON public.gboc_platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Add transfer/2FA fields to existing customer table
-- ============================================================
ALTER TABLE public.bank_customers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_salt TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
