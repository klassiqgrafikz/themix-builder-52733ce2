
CREATE TABLE public.bank_custom_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL UNIQUE REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  domain TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  ssl_status TEXT NOT NULL DEFAULT 'inactive',
  last_verified_at TIMESTAMPTZ,
  connected_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_custom_domains TO authenticated;
GRANT ALL ON public.bank_custom_domains TO service_role;

ALTER TABLE public.bank_custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bank owners and platform admins can manage custom domains"
ON public.bank_custom_domains
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bb_bank_drafts d
    WHERE d.id = bank_custom_domains.bank_id
      AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bb_bank_drafts d
    WHERE d.id = bank_custom_domains.bank_id
      AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'))
  )
);

CREATE TRIGGER bank_custom_domains_touch_updated_at
BEFORE UPDATE ON public.bank_custom_domains
FOR EACH ROW EXECUTE FUNCTION public.bb_touch_updated_at();
