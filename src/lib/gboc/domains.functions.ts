// Server functions powering the GBOC Domain Manager (Phase 1).
// Persistence only — no DNS, SSL or routing side effects.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankDomain = {
  id: string;
  bank_id: string;
  domain: string | null;
  is_primary: boolean;
  status: "pending" | "connected" | "error";
  ssl_status: "inactive" | "pending" | "active" | "error";
  last_verified_at: string | null;
  connected_since: string | null;
  created_at: string;
  updated_at: string;
};

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const bankIdSchema = z.object({ bank_id: z.string().uuid() });

export const getBankDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankDomain | null> => {
    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .select("*")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as BankDomain | null) ?? null;
  });

export const saveBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string; domain: string; is_primary?: boolean }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        domain: z.string().trim().toLowerCase(),
        is_primary: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<BankDomain> => {
    if (!DOMAIN_RE.test(data.domain)) {
      throw new Error("Enter a valid domain like bank.example.com");
    }
    const payload = {
      bank_id: data.bank_id,
      domain: data.domain,
      is_primary: data.is_primary ?? true,
      status: "pending" as const,
      ssl_status: "inactive" as const,
    };
    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .upsert(payload, { onConflict: "bank_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDomain;
  });

export const verifyBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankDomain> => {
    const now = new Date().toISOString();
    // Phase 1: persistence-only "verification" — mark the record as verified
    // now so operators can capture the check timestamp. Real DNS/SSL checks
    // land in Phase 2.
    const { data: existing, error: readErr } = await context.supabase
      .from("bank_custom_domains")
      .select("*")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing || !existing.domain) {
      throw new Error("Save a domain before verifying.");
    }
    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .update({
        status: "connected",
        ssl_status: "active",
        last_verified_at: now,
        connected_since: existing.connected_since ?? now,
      })
      .eq("bank_id", data.bank_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDomain;
  });

export const removeBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("bank_custom_domains")
      .delete()
      .eq("bank_id", data.bank_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
