-- Allow server functions (which run with anon/authenticated/service_role keys)
-- to manage objects in the private customer-avatars bucket. Tenant isolation
-- is enforced inside src/lib/customer/avatar.functions.ts, which validates the
-- customer session cookie and scopes the object path to `${customerId}/...`.
CREATE POLICY "server manages customer-avatars"
  ON storage.objects
  FOR ALL
  TO anon, authenticated, service_role
  USING (bucket_id = 'customer-avatars')
  WITH CHECK (bucket_id = 'customer-avatars');