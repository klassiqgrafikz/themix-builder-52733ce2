-- Core Banking Engine foundation

ALTER TABLE public.bank_customer_accounts
  ADD COLUMN IF NOT EXISTS pending_balance numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bank_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  account_id uuid NOT NULL,
  transaction_id uuid,
  entry_type text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit','neutral')),
  amount numeric NOT NULL,
  currency text NOT NULL,
  balance_after numeric NOT NULL,
  available_after numeric NOT NULL,
  status text NOT NULL DEFAULT 'posted',
  event_type text,
  reference text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bank_ledger_entries TO service_role;

ALTER TABLE public.bank_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages ledger" ON public.bank_ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS bank_ledger_entries_account_idx
  ON public.bank_ledger_entries (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bank_ledger_entries_bank_idx
  ON public.bank_ledger_entries (bank_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bank_ledger_entries_tx_idx
  ON public.bank_ledger_entries (transaction_id);