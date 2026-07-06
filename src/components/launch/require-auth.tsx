import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setOk(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  if (!ok) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}
