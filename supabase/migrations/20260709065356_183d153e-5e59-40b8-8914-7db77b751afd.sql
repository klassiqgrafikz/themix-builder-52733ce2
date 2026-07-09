
-- Transactions ledger
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.bank_customer_accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit','neutral')),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  reference TEXT,
  balance_after NUMERIC(18,2) NOT NULL,
  available_after NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  created_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_transactions_account_idx ON public.bank_transactions(account_id, created_at DESC);
CREATE INDEX bank_transactions_customer_idx ON public.bank_transactions(customer_id, created_at DESC);
CREATE INDEX bank_transactions_bank_idx ON public.bank_transactions(bank_id, created_at DESC);
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bank_transactions_touch_updated_at BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- Notifications (customer inbox)
CREATE TABLE public.bank_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_notifications_customer_idx ON public.bank_notifications(customer_id, created_at DESC);
GRANT ALL ON public.bank_notifications TO service_role;
ALTER TABLE public.bank_notifications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bank_notifications_touch_updated_at BEFORE UPDATE ON public.bank_notifications
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- Restrictions
CREATE TABLE public.bank_account_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.bank_customer_accounts(id) ON DELETE CASCADE,
  types TEXT[] NOT NULL DEFAULT '{}',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  reason TEXT NOT NULL DEFAULT '',
  reference TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_account_restrictions_account_idx ON public.bank_account_restrictions(account_id, active);
GRANT ALL ON public.bank_account_restrictions TO service_role;
ALTER TABLE public.bank_account_restrictions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bank_account_restrictions_touch_updated_at BEFORE UPDATE ON public.bank_account_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- Audit logs (immutable)
CREATE TABLE public.bank_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.bank_customers(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.bank_customer_accounts(id) ON DELETE SET NULL,
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_audit_logs_bank_idx ON public.bank_audit_logs(bank_id, created_at DESC);
CREATE INDEX bank_audit_logs_customer_idx ON public.bank_audit_logs(customer_id, created_at DESC);
GRANT ALL ON public.bank_audit_logs TO service_role;
ALTER TABLE public.bank_audit_logs ENABLE ROW LEVEL SECURITY;

-- Extend accounts with lifecycle timestamps + cached restriction summary
ALTER TABLE public.bank_customer_accounts
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restriction_summary JSONB NOT NULL DEFAULT '{}'::jsonb;
