
GRANT SELECT ON public.bb_bank_drafts TO anon;

DROP POLICY IF EXISTS "anyone can read published banks" ON public.bb_bank_drafts;
CREATE POLICY "anyone can read published banks"
ON public.bb_bank_drafts
FOR SELECT
TO anon, authenticated
USING (render_status = 'published' AND slug IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS bb_bank_drafts_published_slug_idx
ON public.bb_bank_drafts (slug)
WHERE render_status = 'published';
