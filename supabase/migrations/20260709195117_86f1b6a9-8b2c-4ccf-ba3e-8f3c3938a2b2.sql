CREATE POLICY "authenticated manages platform settings"
  ON public.gboc_platform_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);