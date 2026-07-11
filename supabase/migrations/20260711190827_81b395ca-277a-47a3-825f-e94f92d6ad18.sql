ALTER TABLE public.bb_bank_drafts
  ADD COLUMN IF NOT EXISTS short_slug text;

DO $$
DECLARE
  r record;
  name_source text;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, slug, identity FROM public.bb_bank_drafts WHERE short_slug IS NULL LOOP
    name_source := coalesce(nullif(trim(r.identity->>'bank_name'), ''), r.slug, '');

    IF name_source = '' THEN
      base := 'bank';
    ELSE
      -- Acronym from words with length >= 2
      SELECT lower(string_agg(substr(word, 1, 1), ''))
        INTO base
        FROM (
          SELECT unnest(regexp_split_to_array(name_source, '[^A-Za-z0-9]+')) AS word
        ) w
        WHERE length(word) >= 2;

      IF base IS NULL OR length(base) < 2 OR length(base) > 6 THEN
        base := lower(regexp_replace(name_source, '[^A-Za-z0-9]+', '', 'g'));
        base := substr(base, 1, 12);
      END IF;

      IF base IS NULL OR length(base) < 2 THEN
        base := 'bank';
      END IF;
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.bb_bank_drafts WHERE short_slug = candidate AND id <> r.id) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;

    UPDATE public.bb_bank_drafts SET short_slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bb_bank_drafts_short_slug_key
  ON public.bb_bank_drafts (short_slug)
  WHERE short_slug IS NOT NULL;
