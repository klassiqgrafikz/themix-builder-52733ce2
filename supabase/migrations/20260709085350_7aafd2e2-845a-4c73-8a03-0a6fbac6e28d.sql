
ALTER TABLE public.bank_customers
  ADD COLUMN IF NOT EXISTS id_document_type text,
  ADD COLUMN IF NOT EXISTS id_document_number text,
  ADD COLUMN IF NOT EXISTS id_document_country text,
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS employer_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS annual_income numeric,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS next_of_kin_email text,
  ADD COLUMN IF NOT EXISTS account_type_preference text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text;
