CREATE POLICY "server manages bank-branding"
  ON storage.objects
  FOR ALL
  TO anon, authenticated, service_role
  USING (bucket_id = 'bank-branding')
  WITH CHECK (bucket_id = 'bank-branding');