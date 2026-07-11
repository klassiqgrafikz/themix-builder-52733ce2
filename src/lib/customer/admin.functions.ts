import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";
import type { CustomerProfile } from "./types";

export type AdminCustomerRow = CustomerProfile & {
  bank_id: string;
  bank_name: string | null;
  account_count: number;
};

export const adminListCustomers = createServerFn({ method: "GET" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { bank_id?: string | null; search?: string | null }) =>
    z
      .object({
        bank_id: z.string().uuid().nullable().optional(),
        search: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<AdminCustomerRow[]> => {
    // Only allow the caller to see customers belonging to banks they own.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: ownedBanks, error: ownedErr } = await sb
      .from("bb_bank_drafts")
      .select("id, identity, slug")
      .eq("owner_id", context.userId);
    if (ownedErr) throw new Error(ownedErr.message);
    const ownedIds = new Set<string>((ownedBanks ?? []).map((b: { id: string }) => b.id));
    if (ownedIds.size === 0) return [];
    if (data.bank_id && !ownedIds.has(data.bank_id)) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("bank_customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.bank_id) query = query.eq("bank_id", data.bank_id);
    else query = query.in("bank_id", Array.from(ownedIds));
    if (data.search) query = query.ilike("email", `%${data.search}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Count accounts per customer in one round trip.
    const ids = (rows ?? []).map((r) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: accts } = await supabaseAdmin
        .from("bank_customer_accounts")
        .select("customer_id")
        .in("customer_id", ids);
      counts = (accts ?? []).reduce<Record<string, number>>((acc, a) => {
        acc[a.customer_id] = (acc[a.customer_id] ?? 0) + 1;
        return acc;
      }, {});
    }

    const bankNameById = new Map<string, string | null>();
    for (const b of ownedBanks ?? []) {
      const identity = (b as { identity?: { bank_name?: string } }).identity;
      bankNameById.set(b.id, identity?.bank_name ?? null);
    }

    return (rows ?? []).map((r) => ({
      id: r.id,
      bank_id: r.bank_id,
      bank_name: bankNameById.get(r.bank_id) ?? null,
      customer_number: r.customer_number,
      first_name: r.first_name,
      last_name: r.last_name,
      date_of_birth: r.date_of_birth ?? null,
      gender: r.gender ?? null,
      email: r.email,
      phone: r.phone ?? null,
      address: r.address ?? null,
      country: r.country ?? null,
      nationality: r.nationality ?? null,
      email_verified: !!r.email_verified,
      status: r.status,
      profile_picture_url: r.profile_picture_url ?? null,
      notification_prefs: (r.notification_prefs ?? {}) as CustomerProfile["notification_prefs"],
      created_at: r.created_at,
      updated_at: r.updated_at,
      account_count: counts[r.id] ?? 0,
    }));
  });
