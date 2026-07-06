
-- 1. Blueprint categories
CREATE TABLE IF NOT EXISTS public.bb_blueprint_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.bb_blueprint_categories TO authenticated;
GRANT ALL ON public.bb_blueprint_categories TO service_role;
ALTER TABLE public.bb_blueprint_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blueprint categories readable" ON public.bb_blueprint_categories FOR SELECT TO authenticated USING (true);

INSERT INTO public.bb_blueprint_categories (slug, name, description, icon, sort_order) VALUES
  ('retail-banking','Retail Banking','Everyday consumer accounts, cards, transfers and mobile banking.','Landmark',1),
  ('commercial-banking','Commercial Banking','SME and mid-market lending, treasury and merchant services.','Building2',2),
  ('corporate-banking','Corporate Banking','Large-enterprise cash management, trade finance and lending.','Building',3),
  ('investment-banking','Investment Banking','Capital markets, M&A advisory and institutional trading.','TrendingUp',4),
  ('private-banking','Private Banking','High-net-worth advisory, portfolio and lifestyle services.','Gem',5),
  ('digital-banking','Digital Banking','Digital-first everyday banking with rich mobile UX.','Smartphone',6),
  ('credit-union','Credit Union','Member-owned community banking with cooperative governance.','Users',7),
  ('cooperative-banking','Cooperative Banking','Local cooperative banks serving communities and small business.','Handshake',8),
  ('islamic-banking','Islamic Banking','Shariah-compliant retail, savings and investment products.','Moon',9),
  ('neo-banking','Neo Banking','Branchless mobile-native banking with modern onboarding.','Zap',10),
  ('wealth-management','Wealth Management','Advisory, portfolios, trusts and multi-generational planning.','LineChart',11),
  ('microfinance-banking','Microfinance Banking','Small loans, group savings and inclusion-focused banking.','Sprout',12),
  ('international-banking','International Banking','Cross-border accounts, FX and global cash management.','Globe',13)
ON CONFLICT (slug) DO NOTHING;

-- 2. Bank modules catalog
CREATE TABLE IF NOT EXISTS public.bb_modules (
  key text PRIMARY KEY,
  group_name text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  default_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.bb_modules TO authenticated;
GRANT ALL ON public.bb_modules TO service_role;
ALTER TABLE public.bb_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules readable" ON public.bb_modules FOR SELECT TO authenticated USING (true);

INSERT INTO public.bb_modules (key, group_name, label, description, default_pages, sort_order) VALUES
  ('accounts','Core Banking','Accounts','Current, savings and joint accounts.','["accounts"]',1),
  ('transfers','Core Banking','Transfers','Internal, domestic and international transfers.','["transfers"]',2),
  ('beneficiaries','Core Banking','Beneficiaries','Saved payees and beneficiary management.','["beneficiaries"]',3),
  ('statements','Core Banking','Statements','Downloadable statements and history.','["statements"]',4),
  ('cards','Core Banking','Cards','Debit and credit card management.','["cards"]',5),
  ('loans','Core Banking','Loans','Personal, auto and mortgage loan products.','["loans"]',6),
  ('investments','Core Banking','Investments','Brokerage, funds and portfolios.','["investments"]',7),
  ('fixed_deposits','Core Banking','Fixed Deposits','Term deposits and certificates.','["deposits"]',8),
  ('fx_accounts','Core Banking','Foreign Currency Accounts','Multi-currency wallets and FX.','["fx"]',9),
  ('registration','Customer Services','Customer Registration','Onboarding and KYC.','["register"]',10),
  ('login','Customer Services','Customer Login','Sign-in flow.','["login"]',11),
  ('forgot_password','Customer Services','Forgot Password','Password reset flow.','["reset"]',12),
  ('profile','Customer Services','Profile Management','Personal details and preferences.','["profile"]',13),
  ('email_verification','Customer Services','Email Verification','Email confirmation flow.','[]',14),
  ('sms_verification','Customer Services','SMS Verification','Phone confirmation flow.','[]',15),
  ('two_factor','Customer Services','Two-Factor Authentication','2FA with authenticator or SMS.','[]',16),
  ('notifications','Communication','Notifications','In-app and push alerts.','["notifications"]',17),
  ('secure_messages','Communication','Secure Messages','Bank-to-customer secure inbox.','["messages"]',18),
  ('contact_support','Communication','Contact Support','Ticketing and enquiries.','["support"]',19),
  ('live_chat','Communication','Live Chat','Real-time chat with agents.','[]',20),
  ('help_center','Communication','Help Center','FAQ and knowledge base.','["help"]',21),
  ('mobile_banking','Digital Services','Mobile Banking','Mobile-first experience.','[]',22),
  ('qr_payments','Digital Services','QR Payments','Scan-to-pay and receive.','["qr"]',23),
  ('bill_payments','Digital Services','Bill Payments','Utility and merchant bill pay.','["bills"]',24),
  ('virtual_cards','Digital Services','Virtual Cards','Instant issue virtual cards.','["virtual-cards"]',25),
  ('cheque_requests','Digital Services','Cheque Requests','Order and manage cheques.','["cheques"]',26),
  ('document_upload','Digital Services','Document Upload','Secure document submission.','["documents"]',27)
ON CONFLICT (key) DO NOTHING;

-- 3. Extend bb_templates
ALTER TABLE public.bb_templates
  ADD COLUMN IF NOT EXISTS blueprint_category text REFERENCES public.bb_blueprint_categories(slug),
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS popularity int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supported_modules text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill blueprint_category from existing category label
UPDATE public.bb_templates SET blueprint_category = CASE
  WHEN category ILIKE 'Retail%' THEN 'retail-banking'
  WHEN category ILIKE 'Commercial%' THEN 'commercial-banking'
  WHEN category ILIKE 'Corporate%' THEN 'corporate-banking'
  WHEN category ILIKE 'Investment%' THEN 'investment-banking'
  WHEN category ILIKE 'Private%' THEN 'private-banking'
  WHEN category ILIKE 'Digital%' THEN 'digital-banking'
  ELSE 'retail-banking'
END
WHERE blueprint_category IS NULL;

-- Give existing rows a sane default module list & popularity spread
UPDATE public.bb_templates
SET supported_modules = ARRAY['accounts','transfers','cards','statements','notifications','login','registration','profile'],
    popularity = 40 + (abs(hashtext(id::text)) % 60),
    recommended = (abs(hashtext(id::text)) % 5 = 0)
WHERE array_length(supported_modules, 1) IS NULL OR array_length(supported_modules, 1) = 0;

-- 4. Generate blueprints for every (category × country) combo not yet covered
WITH combos AS (
  SELECT cat.slug AS cat_slug, cat.name AS cat_name,
         c.code AS country_code, c.name AS country_name,
         c.region, c.currency, c.default_language AS language
  FROM public.bb_blueprint_categories cat
  CROSS JOIN public.bb_countries c
), variants AS (
  SELECT * FROM (VALUES
    ('Modern','Modern, clean and mobile-first take on %s in %s.', 70, true, '#0F172A','#3B82F6','#22D3EE','light'),
    ('Premium','Premium, high-trust design for %s in %s.', 60, false, '#111827','#B45309','#F59E0B','light'),
    ('Classic','Classic, established feel for %s in %s.', 50, false, '#1E3A8A','#0369A1','#F97316','light')
  ) AS v(prefix, desc_tpl, popularity, recommended, primary_color, secondary_color, accent_color, theme)
)
INSERT INTO public.bb_templates (
  name, country_code, category, description,
  primary_color, secondary_color, accent_color,
  pages, region, currency, language, theme, features,
  mobile_support, is_premium, blueprint_category, version, popularity, recommended, supported_modules
)
SELECT
  v.prefix || ' ' || cb.country_name || ' ' || cb.cat_name,
  cb.country_code,
  cb.cat_name,
  format(v.desc_tpl, cb.cat_name, cb.country_name),
  v.primary_color, v.secondary_color, v.accent_color,
  '["home","login","register","dashboard","accounts","cards","transfers","settings","support","notifications"]'::jsonb,
  cb.region, cb.currency, cb.language, v.theme, '[]'::jsonb,
  true, (v.prefix = 'Premium'),
  cb.cat_slug, '1.0.0', v.popularity, v.recommended,
  ARRAY['accounts','transfers','cards','statements','notifications','login','registration','profile','beneficiaries','bill_payments']
FROM combos cb CROSS JOIN variants v
WHERE NOT EXISTS (
  SELECT 1 FROM public.bb_templates t
  WHERE t.blueprint_category = cb.cat_slug
    AND t.country_code = cb.country_code
    AND t.name = (v.prefix || ' ' || cb.country_name || ' ' || cb.cat_name)
);
