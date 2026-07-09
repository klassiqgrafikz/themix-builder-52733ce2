CREATE OR REPLACE FUNCTION public.whoami_debug()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'current_role', current_role,
    'current_user', current_user,
    'session_user', session_user,
    'jwt_role', (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
  )
$$;

GRANT EXECUTE ON FUNCTION public.whoami_debug() TO anon, authenticated, service_role;
