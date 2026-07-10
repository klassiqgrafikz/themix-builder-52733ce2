
-- Platform admin role infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('platform_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service manages user_roles" ON public.user_roles;
CREATE POLICY "service manages user_roles" ON public.user_roles
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'platform_admin'::public.app_role);
$$;

-- Grant platform_admin full access to bb_bank_drafts (in addition to owner rules)
DROP POLICY IF EXISTS "platform admin manages all drafts" ON public.bb_bank_drafts;
CREATE POLICY "platform admin manages all drafts" ON public.bb_bank_drafts
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Same for bp_bank_products (owner-scoped through parent draft)
DROP POLICY IF EXISTS "platform admin manages all bank products" ON public.bp_bank_products;
CREATE POLICY "platform admin manages all bank products" ON public.bp_bank_products
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
