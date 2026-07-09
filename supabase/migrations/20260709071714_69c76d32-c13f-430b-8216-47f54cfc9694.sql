
-- =====================================================================
-- Product Catalog: categories + products
-- =====================================================================
CREATE TABLE public.bp_product_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bp_product_categories TO anon, authenticated;
GRANT ALL ON public.bp_product_categories TO service_role;
ALTER TABLE public.bp_product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product categories are public" ON public.bp_product_categories FOR SELECT USING (true);

CREATE TABLE public.bp_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES public.bp_product_categories(slug) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Circle',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  supported_countries TEXT[] NOT NULL DEFAULT '{}',
  supported_currencies TEXT[] NOT NULL DEFAULT '{}',
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','internal')),
  default_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bp_products TO anon, authenticated;
GRANT ALL ON public.bp_products TO service_role;
ALTER TABLE public.bp_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.bp_products FOR SELECT USING (true);
CREATE INDEX bp_products_category_idx ON public.bp_products(category_slug);
CREATE TRIGGER bp_products_touch BEFORE UPDATE ON public.bp_products
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- =====================================================================
-- Blueprint → default products
-- =====================================================================
CREATE TABLE public.bp_blueprint_products (
  blueprint_id UUID NOT NULL REFERENCES public.bb_templates(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES public.bp_products(code) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, product_code)
);
GRANT SELECT ON public.bp_blueprint_products TO anon, authenticated;
GRANT ALL ON public.bp_blueprint_products TO service_role;
ALTER TABLE public.bp_blueprint_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blueprint products are public" ON public.bp_blueprint_products FOR SELECT USING (true);

-- =====================================================================
-- Per-bank product overrides
-- =====================================================================
CREATE TABLE public.bp_bank_products (
  draft_id UUID NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES public.bp_products(code) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_label TEXT,
  visibility TEXT NOT NULL DEFAULT 'inherit' CHECK (visibility IN ('inherit','public','private','internal')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, product_code)
);
GRANT SELECT ON public.bp_bank_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bp_bank_products TO authenticated;
GRANT ALL ON public.bp_bank_products TO service_role;
ALTER TABLE public.bp_bank_products ENABLE ROW LEVEL SECURITY;
-- Read-through: anyone can read (so public site / customer portal can render), owner controls writes.
CREATE POLICY "Bank products readable" ON public.bp_bank_products FOR SELECT USING (true);
CREATE POLICY "Owner manages bank products" ON public.bp_bank_products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bb_bank_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bb_bank_drafts d WHERE d.id = draft_id AND d.owner_id = auth.uid()));
CREATE TRIGGER bp_bank_products_touch BEFORE UPDATE ON public.bp_bank_products
  FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- =====================================================================
-- Seed categories
-- =====================================================================
INSERT INTO public.bp_product_categories (slug, name, description, icon, sort_order) VALUES
  ('accounts',    'Accounts',         'Deposit and savings account products',              'Wallet',      10),
  ('cards',       'Cards',            'Debit, credit, virtual and prepaid cards',          'CreditCard',  20),
  ('payments',    'Payments',         'Transfers, bill payments and standing orders',      'Send',        30),
  ('investments', 'Investments',      'Fixed deposits, portfolios and treasury products',  'TrendingUp',  40),
  ('loans',       'Loans',            'Consumer and business lending products',            'Banknote',    50),
  ('digital',     'Digital Services', 'Mobile, internet banking, alerts and QR payments',  'Smartphone',  60);

-- =====================================================================
-- Seed products
-- =====================================================================
INSERT INTO public.bp_products (code, name, category_slug, description, icon, sort_order) VALUES
  -- accounts
  ('checking',           'Checking Account',           'accounts', 'Everyday transactional account.',                      'Wallet',       10),
  ('savings',            'Savings Account',            'accounts', 'Interest-bearing savings account.',                    'PiggyBank',    20),
  ('current',            'Current Account',            'accounts', 'Full-service current account for daily banking.',      'Wallet',       30),
  ('student',            'Student Account',            'accounts', 'Fee-friendly account for students.',                   'GraduationCap',40),
  ('business',           'Business Account',           'accounts', 'Small business banking account.',                      'Briefcase',    50),
  ('corporate',          'Corporate Account',          'accounts', 'Corporate banking account with treasury access.',      'Building2',    60),
  ('joint',              'Joint Account',              'accounts', 'Shared account for multiple owners.',                  'Users',        70),
  ('fixed_deposit_acct', 'Fixed Deposit Account',      'accounts', 'Locked-term deposit account.',                         'Lock',         80),
  ('foreign_currency',   'Foreign Currency Account',   'accounts', 'Multi-currency FX account.',                           'Coins',        90),
  -- cards
  ('debit_card',         'Debit Card',                 'cards',    'Card linked to a customer deposit account.',           'CreditCard',   10),
  ('credit_card',        'Credit Card',                'cards',    'Simulated revolving credit card.',                     'CreditCard',   20),
  ('virtual_card',       'Virtual Card',               'cards',    'On-demand virtual card for online payments.',          'Smartphone',   30),
  ('prepaid_card',       'Prepaid Card',               'cards',    'Reloadable prepaid card.',                             'CreditCard',   40),
  -- payments
  ('internal_transfers',      'Internal Transfers',      'payments', 'Move funds between own accounts.',              'ArrowLeftRight', 10),
  ('external_transfers',      'External Transfers',      'payments', 'Simulated transfers to third parties.',         'Send',           20),
  ('local_transfers',         'Local Bank Transfers',    'payments', 'Domestic bank-to-bank transfers.',              'Send',           30),
  ('international_transfers', 'International Transfers', 'payments', 'Simulated cross-border transfers.',             'Globe',          40),
  ('bill_payments',           'Bill Payments',           'payments', 'Pay utilities and merchants.',                  'Receipt',        50),
  ('standing_orders',         'Standing Orders',         'payments', 'Recurring scheduled payments.',                 'CalendarClock',  60),
  -- investments
  ('fixed_deposits',        'Fixed Deposits',        'investments', 'Term deposit investment product.',              'Lock',           10),
  ('investment_portfolio',  'Investment Portfolio',  'investments', 'Simulated investment portfolio.',               'TrendingUp',     20),
  ('treasury_products',     'Treasury Products',     'investments', 'Simulated treasury products.',                  'Landmark',       30),
  -- loans
  ('personal_loan',   'Personal Loan',   'loans', 'Unsecured personal lending.',                     'Banknote', 10),
  ('mortgage',        'Mortgage',        'loans', 'Home loan product.',                              'Home',     20),
  ('auto_loan',       'Auto Loan',       'loans', 'Vehicle financing product.',                      'Car',      30),
  ('business_loan',   'Business Loan',   'loans', 'Business lending product.',                       'Briefcase',40),
  ('salary_advance',  'Salary Advance',  'loans', 'Short-term salary advance.',                      'Coins',    50),
  -- digital
  ('mobile_banking',     'Mobile Banking',     'digital', 'Mobile banking application.',                'Smartphone', 10),
  ('internet_banking',   'Internet Banking',   'digital', 'Web-based online banking.',                  'Globe',      20),
  ('sms_alerts',         'SMS Alerts',         'digital', 'Account SMS notifications.',                 'MessageSquare', 30),
  ('email_alerts',       'Email Alerts',       'digital', 'Account email notifications.',               'Mail',       40),
  ('push_notifications', 'Push Notifications', 'digital', 'Mobile push notifications.',                 'Bell',       50),
  ('qr_payments',        'QR Payments',        'digital', 'Simulated QR-based payments.',               'QrCode',     60);
