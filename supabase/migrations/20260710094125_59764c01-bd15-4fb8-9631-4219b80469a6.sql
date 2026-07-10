
DROP POLICY IF EXISTS "service manages user_roles" ON public.user_roles;
CREATE POLICY "service manages user_roles" ON public.user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
