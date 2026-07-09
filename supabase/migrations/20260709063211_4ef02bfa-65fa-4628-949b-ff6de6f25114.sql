
-- =========================
-- Customer Banking Platform
-- =========================

CREATE TABLE public.bank_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  customer_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text,
  email text NOT NULL,
  phone text,
  address text,
  country text,
  nationality text,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  email_verification_token text,
  password_reset_token text,
  password_reset_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  profile_picture_url text,
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_id, email),
  UNIQUE (bank_id, customer_number)
);

GRANT ALL ON public.bank_customers TO service_role;
ALTER TABLE public.bank_customers ENABLE ROW LEVEL SECURITY;
-- No policies: all access is via server functions using the service-role client.

CREATE TRIGGER bank_customers_touch_updated_at
  BEFORE UPDATE ON public.bank_customers
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

CREATE INDEX bank_customers_bank_idx ON public.bank_customers(bank_id);
CREATE INDEX bank_customers_email_idx ON public.bank_customers(bank_id, lower(email));

-- ------------------------

CREATE TABLE public.bank_customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  account_number text NOT NULL,
  account_name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  account_type text NOT NULL DEFAULT 'checking',
  status text NOT NULL DEFAULT 'active',
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  available_balance numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_id, account_number)
);

GRANT ALL ON public.bank_customer_accounts TO service_role;
ALTER TABLE public.bank_customer_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER bank_customer_accounts_touch_updated_at
  BEFORE UPDATE ON public.bank_customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

CREATE INDEX bank_customer_accounts_customer_idx
  ON public.bank_customer_accounts(customer_id);
CREATE INDEX bank_customer_accounts_bank_idx
  ON public.bank_customer_accounts(bank_id);

-- ------------------------

CREATE TABLE public.bank_customer_sessions (
  token text PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text
);

GRANT ALL ON public.bank_customer_sessions TO service_role;
ALTER TABLE public.bank_customer_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX bank_customer_sessions_customer_idx
  ON public.bank_customer_sessions(customer_id);
CREATE INDEX bank_customer_sessions_bank_idx
  ON public.bank_customer_sessions(bank_id);

-- ------------------------

CREATE TABLE public.bank_customer_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.bank_customers(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  event text NOT NULL,
  ip text,
  user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bank_customer_login_history TO service_role;
ALTER TABLE public.bank_customer_login_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX bank_customer_login_history_customer_idx
  ON public.bank_customer_login_history(customer_id, at DESC);
