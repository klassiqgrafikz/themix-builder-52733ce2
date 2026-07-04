
-- Countries reference
CREATE TABLE public.bb_countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone TEXT NOT NULL,
  default_language TEXT NOT NULL,
  flag_emoji TEXT NOT NULL
);
GRANT SELECT ON public.bb_countries TO authenticated;
GRANT ALL ON public.bb_countries TO service_role;
ALTER TABLE public.bb_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries readable by authenticated" ON public.bb_countries FOR SELECT TO authenticated USING (true);

INSERT INTO public.bb_countries (code, name, currency, timezone, default_language, flag_emoji) VALUES
('US','United States','USD','America/New_York','en','🇺🇸'),
('GB','United Kingdom','GBP','Europe/London','en','🇬🇧'),
('CA','Canada','CAD','America/Toronto','en','🇨🇦'),
('AU','Australia','AUD','Australia/Sydney','en','🇦🇺'),
('DE','Germany','EUR','Europe/Berlin','de','🇩🇪'),
('FR','France','EUR','Europe/Paris','fr','🇫🇷'),
('IT','Italy','EUR','Europe/Rome','it','🇮🇹'),
('ES','Spain','EUR','Europe/Madrid','es','🇪🇸'),
('NL','Netherlands','EUR','Europe/Amsterdam','nl','🇳🇱'),
('CH','Switzerland','CHF','Europe/Zurich','de','🇨🇭'),
('SG','Singapore','SGD','Asia/Singapore','en','🇸🇬'),
('JP','Japan','JPY','Asia/Tokyo','ja','🇯🇵'),
('KR','South Korea','KRW','Asia/Seoul','ko','🇰🇷'),
('CN','China','CNY','Asia/Shanghai','zh','🇨🇳'),
('AE','UAE','AED','Asia/Dubai','ar','🇦🇪'),
('QA','Qatar','QAR','Asia/Qatar','ar','🇶🇦'),
('SA','Saudi Arabia','SAR','Asia/Riyadh','ar','🇸🇦'),
('ZA','South Africa','ZAR','Africa/Johannesburg','en','🇿🇦'),
('NG','Nigeria','NGN','Africa/Lagos','en','🇳🇬'),
('GH','Ghana','GHS','Africa/Accra','en','🇬🇭'),
('KE','Kenya','KES','Africa/Nairobi','en','🇰🇪');

-- Templates
CREATE TABLE public.bb_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES public.bb_countries(code),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bb_templates TO authenticated;
GRANT ALL ON public.bb_templates TO service_role;
ALTER TABLE public.bb_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable by authenticated" ON public.bb_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.bb_templates (name, country_code, category, description, primary_color, secondary_color, accent_color, pages) VALUES
('PrimeTrust Retail','US','Retail Banking','Modern American retail bank experience.','#0a2540','#1e88e5','#00c48c','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Metro Commercial','US','Commercial Banking','Commercial focused with treasury tools.','#102a43','#0967d2','#f0b429','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Sterling Corporate','GB','Corporate Banking','British corporate banking suite.','#0b1f3a','#c9a227','#0b6e4f','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Maple Retail','CA','Retail Banking','Friendly Canadian retail bank.','#b91c1c','#111827','#f59e0b','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Southern Cross Digital','AU','Digital Banking','Digital-first Australian bank.','#0f766e','#111827','#facc15','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Bavaria Private','DE','Private Banking','German private wealth management.','#1f2937','#b45309','#065f46','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Île Investment','FR','Investment Banking','French investment banking template.','#111827','#dc2626','#2563eb','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Milano Retail','IT','Retail Banking','Elegant Italian retail bank.','#0f172a','#16a34a','#dc2626','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Iberia Digital','ES','Digital Banking','Spanish digital banking platform.','#7c2d12','#f59e0b','#0ea5e9','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Amstel Commercial','NL','Commercial Banking','Dutch commercial banking.','#f97316','#0f172a','#22c55e','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Alpen Private','CH','Private Banking','Swiss private banking excellence.','#111827','#b91c1c','#a16207','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Marina Digital','SG','Digital Banking','Singapore digital banking.','#0369a1','#0f172a','#f43f5e','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Sakura Retail','JP','Retail Banking','Refined Japanese retail bank.','#be185d','#0f172a','#f59e0b','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Hanguk Digital','KR','Digital Banking','Korean digital bank.','#1d4ed8','#0f172a','#22d3ee','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Great Wall Corporate','CN','Corporate Banking','Chinese corporate bank.','#991b1b','#facc15','#111827','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Dune Private','AE','Private Banking','Emirati private banking.','#78350f','#111827','#eab308','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Pearl Investment','QA','Investment Banking','Qatari investment bank.','#0f172a','#7c3aed','#f59e0b','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Riyadh Retail','SA','Retail Banking','Saudi retail bank template.','#065f46','#111827','#f59e0b','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Kalahari Commercial','ZA','Commercial Banking','South African commercial bank.','#1f2937','#16a34a','#f59e0b','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Lagos Retail','NG','Retail Banking','Nigerian retail banking.','#166534','#111827','#f97316','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Accra Digital','GH','Digital Banking','Ghanaian digital bank.','#b45309','#111827','#0ea5e9','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'),
('Savanna Retail','KE','Retail Banking','Kenyan retail bank.','#7c2d12','#111827','#22c55e','["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]');

-- Drafts
CREATE TABLE public.bb_bank_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  mode TEXT NOT NULL DEFAULT 'template',
  country_code TEXT,
  template_id UUID REFERENCES public.bb_templates(id) ON DELETE SET NULL,
  identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  simulation JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_controls JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bb_bank_drafts TO authenticated;
GRANT ALL ON public.bb_bank_drafts TO service_role;
ALTER TABLE public.bb_bank_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own drafts" ON public.bb_bank_drafts FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.bb_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER bb_bank_drafts_touch BEFORE UPDATE ON public.bb_bank_drafts
FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();
