// Customer-facing restrictions: what features the tenant has restricted for the current user.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CustomerRestriction = {
  id: string;
  account_id: string | null;
  types: string[];
  start_at: string | null;
  end_at: string | null;
  reason: string;
  active: boolean;
};

export const listMyRestrictions = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<CustomerRestriction[]> => {
    const { optionalCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await optionalCustomerSession(data.slug);
    if (!s) return [];
    const now = new Date().toISOString();
    const { data: rows } = await supabaseAdmin
      .from("bank_account_restrictions")
      .select("id, account_id, types, start_at, end_at, reason, active")
      .eq("customer_id", s.customer.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    return (rows ?? [])
      .filter((r) => {
        if (r.start_at && r.start_at > now) return false;
        if (r.end_at && r.end_at < now) return false;
        return true;
      })
      .map((r) => ({
        id: r.id,
        account_id: r.account_id ?? null,
        types: (r.types ?? []) as string[],
        start_at: r.start_at ?? null,
        end_at: r.end_at ?? null,
        reason: r.reason,
        active: r.active,
      }));
  });
