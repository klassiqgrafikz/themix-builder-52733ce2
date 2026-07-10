
-- Public read policies for catalog tables (Blueprint Library, categories, countries, modules)
GRANT SELECT ON public.bb_templates TO anon;
GRANT SELECT ON public.bb_blueprint_categories TO anon;
GRANT SELECT ON public.bb_countries TO anon;
GRANT SELECT ON public.bb_modules TO anon;

CREATE POLICY "templates readable by anon" ON public.bb_templates FOR SELECT TO anon USING (true);
CREATE POLICY "blueprint categories readable by anon" ON public.bb_blueprint_categories FOR SELECT TO anon USING (true);
CREATE POLICY "countries readable by anon" ON public.bb_countries FOR SELECT TO anon USING (true);
CREATE POLICY "modules readable by anon" ON public.bb_modules FOR SELECT TO anon USING (true);
