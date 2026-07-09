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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "server manages %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "server manages %I" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.whoami_debug();
