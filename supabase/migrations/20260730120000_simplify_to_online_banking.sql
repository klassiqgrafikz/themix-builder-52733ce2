-- Simplify Blueprint Library to a single Online Banking category

-- 1. Delete templates NOT in Retail/Online Banking
-- bb_bank_drafts.template_id has ON DELETE SET NULL, bp_blueprint_products has ON DELETE CASCADE
DELETE FROM public.bb_templates
WHERE blueprint_category IS NOT NULL AND blueprint_category != 'retail-banking';

DELETE FROM public.bb_templates
WHERE blueprint_category IS NULL AND category != 'Retail Banking';

-- 2. Temporarily nullify FK references so we can rename the slug
UPDATE public.bb_templates
SET blueprint_category = NULL
WHERE blueprint_category = 'retail-banking';

-- 3. Remove non-retail blueprint categories
DELETE FROM public.bb_blueprint_categories
WHERE slug != 'retail-banking';

-- 4. Rename retail-banking to online-banking
UPDATE public.bb_blueprint_categories
SET slug = 'online-banking',
    name = 'Online Banking',
    description = 'Everyday online banking with accounts, cards, transfers and digital services.',
    icon = 'Globe'
WHERE slug = 'retail-banking';

-- 5. Restore FK references with the new slug
UPDATE public.bb_templates
SET blueprint_category = 'online-banking',
    category = 'Online Banking',
    name = REPLACE(name, 'Retail Banking', 'Online Banking')
WHERE blueprint_category IS NULL
   OR category = 'Retail Banking';
