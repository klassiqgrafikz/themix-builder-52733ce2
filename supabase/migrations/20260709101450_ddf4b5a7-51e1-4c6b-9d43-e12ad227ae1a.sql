-- Enable server-side (service role) full access to customer banking tables so
-- customer registration and portal server functions work under RLS.
-- These tables are only ever accessed via server functions using the admin client.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bank_customers',
    'bank_customer_accounts',
    'bank_customer_sessions',
    'bank_customer_login_history',
    'bank_customer_trusted_devices',
    'bank_notifications',
    'bank_beneficiaries',
    'bank_cards',
    'bank_transactions',
    'bank_ledger_entries',
    'bank_financial_events',
    'bank_support_tickets',
    'bank_support_messages',
    'bank_audit_logs',
    'bank_account_restrictions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    -- Drop existing "server manages" policy if present, then recreate
    EXECUTE format('DROP POLICY IF EXISTS "service role manages %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "service role manages %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;
