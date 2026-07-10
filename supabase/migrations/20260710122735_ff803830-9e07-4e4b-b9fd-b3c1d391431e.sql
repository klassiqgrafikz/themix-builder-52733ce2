CREATE TABLE IF NOT EXISTS public.bank_domain_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.bb_bank_drafts(id) ON DELETE CASCADE,
  domain text,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'info',
  message text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bank_domain_activity TO authenticated;
GRANT ALL ON public.bank_domain_activity TO service_role;

ALTER TABLE public.bank_domain_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_activity_select"
  ON public.bank_domain_activity FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.bb_bank_drafts d
      WHERE d.id = bank_domain_activity.bank_id
        AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "domain_activity_insert"
  ON public.bank_domain_activity FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.bb_bank_drafts d
      WHERE d.id = bank_domain_activity.bank_id
        AND d.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS bank_domain_activity_bank_created_idx
  ON public.bank_domain_activity (bank_id, created_at DESC);