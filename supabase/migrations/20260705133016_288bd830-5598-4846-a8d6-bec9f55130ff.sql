
-- 1. Regions on countries
ALTER TABLE public.bb_countries ADD COLUMN IF NOT EXISTS region text;

INSERT INTO public.bb_countries (code, name, currency, timezone, default_language, flag_emoji) VALUES
('IN','India','INR','Asia/Kolkata','en','🇮🇳'),
('BR','Brazil','BRL','America/Sao_Paulo','pt','🇧🇷'),
('MX','Mexico','MXN','America/Mexico_City','es','🇲🇽'),
('EG','Egypt','EGP','Africa/Cairo','ar','🇪🇬'),
('TR','Turkey','TRY','Europe/Istanbul','tr','🇹🇷')
ON CONFLICT (code) DO NOTHING;

UPDATE public.bb_countries SET region = CASE code
  WHEN 'US' THEN 'Americas' WHEN 'CA' THEN 'Americas' WHEN 'MX' THEN 'Americas' WHEN 'BR' THEN 'Americas'
  WHEN 'GB' THEN 'Europe' WHEN 'DE' THEN 'Europe' WHEN 'FR' THEN 'Europe' WHEN 'IT' THEN 'Europe'
  WHEN 'ES' THEN 'Europe' WHEN 'NL' THEN 'Europe' WHEN 'CH' THEN 'Europe' WHEN 'TR' THEN 'Europe'
  WHEN 'SG' THEN 'Asia' WHEN 'JP' THEN 'Asia' WHEN 'KR' THEN 'Asia' WHEN 'CN' THEN 'Asia' WHEN 'IN' THEN 'Asia'
  WHEN 'AE' THEN 'Middle East' WHEN 'QA' THEN 'Middle East' WHEN 'SA' THEN 'Middle East'
  WHEN 'ZA' THEN 'Africa' WHEN 'NG' THEN 'Africa' WHEN 'GH' THEN 'Africa' WHEN 'KE' THEN 'Africa' WHEN 'EG' THEN 'Africa'
  WHEN 'AU' THEN 'Oceania'
  ELSE 'Other'
END;
ALTER TABLE public.bb_countries ALTER COLUMN region SET NOT NULL;

-- 2. Extend templates
ALTER TABLE public.bb_templates
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mobile_support boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS bb_templates_touch ON public.bb_templates;
CREATE TRIGGER bb_templates_touch BEFORE UPDATE ON public.bb_templates
FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();

-- Backfill from countries for pre-existing rows
UPDATE public.bb_templates t
SET region = c.region, currency = COALESCE(t.currency, c.currency), language = COALESCE(t.language, c.default_language)
FROM public.bb_countries c WHERE t.country_code = c.code;

ALTER TABLE public.bb_templates
  ALTER COLUMN region SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN language SET NOT NULL;

-- 3. Seed "Inspired" library
WITH v(name, country_code, category, description, primary_color, secondary_color, accent_color, theme, premium) AS (VALUES
  -- United States
  ('Capital One Inspired','US','Retail Banking','Bold retail banking with a vibrant Capital One-style palette.','#004977','#d03027','#ffd200','light',false),
  ('Chase Inspired','US','Retail Banking','Trusted blue everyday banking inspired by Chase.','#117ACA','#003366','#FBB040','light',true),
  ('Bank of America Inspired','US','Retail Banking','Deep-blue Americana banking inspired by Bank of America.','#012169','#E31837','#F1F1F1','light',false),
  ('Wells Fargo Inspired','US','Retail Banking','Warm red-and-gold retail feel inspired by Wells Fargo.','#B31B1B','#FFCD11','#111111','light',false),
  ('Citibank Inspired','US','Corporate Banking','Global corporate palette inspired by Citibank.','#003B70','#056DAE','#F7B500','light',false),
  ('PNC Inspired','US','Retail Banking','Fresh orange-and-navy retail template inspired by PNC.','#F58025','#003057','#FFFFFF','light',false),
  -- United Kingdom
  ('Barclays Inspired','GB','Retail Banking','British high-street banking inspired by Barclays.','#00AEEF','#002E7D','#4CB4E7','light',false),
  ('HSBC UK Inspired','GB','Corporate Banking','Iconic red-and-white corporate feel inspired by HSBC UK.','#DB0011','#111111','#FFFFFF','light',true),
  ('Lloyds Inspired','GB','Retail Banking','Trustworthy green British retail bank inspired by Lloyds.','#006A4D','#024731','#C8E600','light',false),
  ('NatWest Inspired','GB','Digital Banking','Modern purple digital feel inspired by NatWest.','#5A287D','#3B1A5A','#E4B7E5','light',false),
  ('Santander UK Inspired','GB','Retail Banking','Warm crimson retail template inspired by Santander UK.','#EC0000','#B10000','#FEC10E','light',false),
  -- Canada
  ('RBC Inspired','CA','Retail Banking','Confident blue-and-gold banking inspired by RBC.','#005DAA','#FFD200','#013067','light',true),
  ('TD Canada Inspired','CA','Retail Banking','Bright green retail bank inspired by TD Canada.','#008A00','#005B00','#FFFFFF','light',false),
  ('Scotiabank Inspired','CA','Corporate Banking','International red corporate palette inspired by Scotiabank.','#EE1C25','#B30000','#003C71','light',false),
  ('BMO Inspired','CA','Retail Banking','Classic blue-and-orange retail bank inspired by BMO.','#0079C1','#003C71','#E8531A','light',false),
  ('CIBC Inspired','CA','Retail Banking','Refined crimson retail bank inspired by CIBC.','#B00020','#7A0018','#F5A623','light',false),
  -- Australia
  ('Commonwealth Bank Inspired','AU','Retail Banking','Bright yellow-and-black bank inspired by Commonwealth.','#FFCC00','#111111','#E30513','light',false),
  ('ANZ Inspired','AU','Corporate Banking','Deep blue corporate template inspired by ANZ.','#004990','#002856','#FFFFFF','light',true),
  ('NAB Inspired','AU','Retail Banking','Bold red retail template inspired by NAB.','#E10600','#7F0100','#111111','light',false),
  ('Westpac Inspired','AU','Retail Banking','Signature red Aussie retail bank inspired by Westpac.','#DA1710','#A5020C','#111111','light',false),
  -- Nigeria
  ('Access Bank Inspired','NG','Retail Banking','Bold orange retail bank inspired by Access.','#F58220','#E85806','#002856','light',false),
  ('GTBank Inspired','NG','Digital Banking','Sleek orange-and-black digital bank inspired by GTBank.','#F58220','#111111','#FFFFFF','light',true),
  ('Zenith Bank Inspired','NG','Corporate Banking','Confident red corporate bank inspired by Zenith.','#B01C2E','#111111','#C29A3B','light',false),
  ('UBA Inspired','NG','Retail Banking','Pan-African red retail bank inspired by UBA.','#DA291C','#111111','#FFFFFF','light',false),
  ('First Bank Inspired','NG','Retail Banking','Heritage navy-and-gold bank inspired by First Bank.','#003A70','#C60C30','#FFB81C','light',false),
  ('Fidelity Bank Inspired','NG','Retail Banking','Modern blue-and-gold bank inspired by Fidelity.','#0033A0','#001F5C','#FFB81C','light',false),
  ('Sterling Bank Inspired','NG','Digital Banking','Vibrant red-and-yellow digital bank inspired by Sterling.','#E30513','#111111','#FFC72C','light',false),
  ('Stanbic IBTC Inspired','NG','Corporate Banking','Blue-and-orange corporate bank inspired by Stanbic IBTC.','#0033A0','#001F5C','#F58220','light',false),
  ('Wema Bank Inspired','NG','Digital Banking','Purple digital bank inspired by Wema.','#7A1F7D','#4D0F52','#F5A623','light',false),
  ('Union Bank Inspired','NG','Retail Banking','Classic blue retail bank inspired by Union.','#00539F','#002F5F','#ED1C24','light',false),
  -- Germany
  ('Deutsche Bank Inspired','DE','Corporate Banking','Global corporate template inspired by Deutsche Bank.','#0018A8','#111111','#FFFFFF','light',true),
  ('Commerzbank Inspired','DE','Commercial Banking','Yellow-and-black commercial bank inspired by Commerzbank.','#FFCC00','#111111','#002E5D','light',false),
  -- France
  ('BNP Paribas Inspired','FR','Investment Banking','Green investment bank inspired by BNP Paribas.','#008D62','#005A3C','#FFFFFF','light',false),
  ('Societe Generale Inspired','FR','Corporate Banking','Red-and-black corporate bank inspired by Societe Generale.','#E60023','#111111','#FFFFFF','light',false),
  ('Credit Agricole Inspired','FR','Retail Banking','Fresh green retail bank inspired by Credit Agricole.','#009540','#005B24','#E30613','light',false),
  -- Italy
  ('UniCredit Inspired','IT','Corporate Banking','European red corporate bank inspired by UniCredit.','#E20613','#A0040A','#111111','light',false),
  ('Intesa Sanpaolo Inspired','IT','Retail Banking','Green Italian retail bank inspired by Intesa Sanpaolo.','#00693E','#003C24','#7ED957','light',false),
  -- Spain
  ('Santander Inspired','ES','Retail Banking','Iconic red Spanish retail bank inspired by Santander.','#EC0000','#B10000','#FFFFFF','light',false),
  ('BBVA Inspired','ES','Digital Banking','Cool blue digital bank inspired by BBVA.','#004481','#072146','#1973B8','light',false),
  -- Netherlands
  ('ING Inspired','NL','Digital Banking','Signature orange digital bank inspired by ING.','#FF6200','#FF4B00','#111111','light',false),
  ('ABN AMRO Inspired','NL','Retail Banking','Fresh green Dutch retail bank inspired by ABN AMRO.','#00A651','#007A3C','#FFFFFF','light',false),
  -- Switzerland
  ('UBS Inspired','CH','Private Banking','Elegant dark Swiss private bank inspired by UBS.','#E60000','#111111','#FFFFFF','dark',true),
  ('Credit Suisse Inspired','CH','Private Banking','Refined dark private bank inspired by Credit Suisse.','#12395B','#06192B','#FFFFFF','dark',true),
  -- Singapore
  ('DBS Inspired','SG','Digital Banking','Award-winning red digital bank inspired by DBS.','#E60028','#B00020','#111111','light',true),
  ('OCBC Inspired','SG','Retail Banking','Classic red retail bank inspired by OCBC.','#E60028','#B10015','#FFFFFF','light',false),
  ('UOB Inspired','SG','Corporate Banking','Blue corporate bank inspired by UOB.','#005EB8','#003B75','#E30613','light',false),
  -- Japan
  ('MUFG Inspired','JP','Corporate Banking','Deep red corporate bank inspired by MUFG.','#D71F1F','#7A0000','#111111','light',true),
  ('Mizuho Inspired','JP','Corporate Banking','Trusted blue corporate bank inspired by Mizuho.','#004098','#001F5C','#FFFFFF','light',false),
  ('SMBC Inspired','JP','Corporate Banking','Fresh green corporate bank inspired by SMBC.','#00A040','#007830','#FFFFFF','light',false),
  -- Korea
  ('KB Kookmin Inspired','KR','Retail Banking','Warm yellow retail bank inspired by KB Kookmin.','#FFBB00','#7A5A00','#111111','light',false),
  ('Shinhan Inspired','KR','Digital Banking','Bright blue digital bank inspired by Shinhan.','#0046FF','#002E9E','#FFFFFF','light',false),
  -- China
  ('ICBC Inspired','CN','Corporate Banking','Red-and-gold corporate bank inspired by ICBC.','#B71C1C','#111111','#FFD700','light',false),
  ('Bank of China Inspired','CN','Corporate Banking','Iconic red bank inspired by Bank of China.','#AA1F24','#111111','#FFFFFF','dark',false),
  -- India
  ('HDFC Bank Inspired','IN','Retail Banking','Trusted blue-and-red retail bank inspired by HDFC.','#004C8F','#002E5C','#ED232A','light',true),
  ('ICICI Bank Inspired','IN','Retail Banking','Warm orange retail bank inspired by ICICI.','#F58220','#B54A00','#002856','light',false),
  ('SBI Inspired','IN','Retail Banking','Public-sector blue bank inspired by SBI.','#22409A','#14286D','#FFFFFF','light',false),
  ('Axis Bank Inspired','IN','Digital Banking','Elegant burgundy digital bank inspired by Axis.','#97144D','#4D0A2B','#ED1C24','light',false),
  -- Middle East
  ('Emirates NBD Inspired','AE','Retail Banking','Rich red UAE retail bank inspired by Emirates NBD.','#D71920','#7A0F14','#111111','light',true),
  ('First Abu Dhabi Bank Inspired','AE','Corporate Banking','Deep navy corporate bank inspired by FAB.','#00205B','#001231','#7CB1E5','light',false),
  ('Qatar National Bank Inspired','QA','Investment Banking','Regal purple investment bank inspired by QNB.','#5C2E91','#391B60','#FFB81C','light',false),
  ('Al Rajhi Inspired','SA','Retail Banking','Deep blue Islamic-finance bank inspired by Al Rajhi.','#005EB8','#003B75','#C8102E','light',false),
  ('Garanti BBVA Inspired','TR','Digital Banking','Fresh green Turkish digital bank inspired by Garanti.','#7DBA00','#4D7A00','#002856','light',false),
  -- Africa (extra)
  ('Standard Bank Inspired','ZA','Corporate Banking','Blue African corporate bank inspired by Standard Bank.','#0033A0','#001F5C','#009DDC','light',true),
  ('FNB Inspired','ZA','Digital Banking','Bright cyan digital bank inspired by FNB.','#009DDC','#005A87','#FFB81C','light',false),
  ('ABSA Inspired','ZA','Retail Banking','Bold red retail bank inspired by ABSA.','#DA291C','#7A170F','#111111','light',false),
  ('Ecobank Ghana Inspired','GH','Retail Banking','Pan-African retail bank inspired by Ecobank.','#00457C','#002E52','#F58220','light',false),
  ('Equity Bank Kenya Inspired','KE','Retail Banking','Bright red retail bank inspired by Equity.','#E30513','#A0030F','#111111','light',false),
  ('KCB Inspired','KE','Retail Banking','Fresh green Kenyan bank inspired by KCB.','#00A651','#007A3C','#FFB81C','light',false),
  ('CIB Egypt Inspired','EG','Commercial Banking','Purple Egyptian commercial bank inspired by CIB.','#5C2E91','#391B60','#FFB81C','light',false),
  -- Latin America
  ('Itau Inspired','BR','Retail Banking','Signature orange Brazilian bank inspired by Itau.','#EC7000','#B65600','#002E5D','light',true),
  ('Bradesco Inspired','BR','Retail Banking','Classic crimson retail bank inspired by Bradesco.','#CC092F','#7A051C','#FFFFFF','light',false),
  ('Banco do Brasil Inspired','BR','Corporate Banking','Iconic yellow-and-blue bank inspired by Banco do Brasil.','#FFEF38','#FFCF00','#002855','light',false),
  ('BBVA Mexico Inspired','MX','Digital Banking','Cool blue Mexican digital bank inspired by BBVA Mexico.','#004481','#002E5C','#1973B8','light',false),
  ('Banorte Inspired','MX','Retail Banking','Bright red Mexican retail bank inspired by Banorte.','#EB0029','#A0011A','#111111','light',false)
)
INSERT INTO public.bb_templates
  (name, country_code, category, description, primary_color, secondary_color, accent_color, pages, theme, features, is_premium, region, currency, language)
SELECT v.name, v.country_code, v.category, v.description, v.primary_color, v.secondary_color, v.accent_color,
       '["Homepage","Login","Registration","Dashboard","Transfer","Cards","Transactions","Profile","Notifications","Statements"]'::jsonb,
       v.theme,
       '["Customer Login","Customer Registration","Transfer","Cards","Statements","Beneficiaries","Notifications","Support"]'::jsonb,
       v.premium,
       c.region, c.currency, c.default_language
FROM v JOIN public.bb_countries c ON c.code = v.country_code;
