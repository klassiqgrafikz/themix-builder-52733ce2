// Beneficiary management for the Customer Banking Platform.
// Beneficiaries are strictly tenant-scoped and owned by a single customer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

const beneficiarySchema = z.object({
  slug,
  kind: z.enum(["own", "internal", "external"]),
  beneficiary_name: z.string().trim().min(1).max(120),
  account_number: z.string().trim().min(1).max(64),
  bank_name: z.string().trim().max(120).optional().nullable(),
  bank_code: z.string().trim().max(40).optional().nullable(),
  nickname: z.string().trim().max(80).optional().nullable(),
  currency: z.string().trim().min(3).max(6).default("USD"),
  is_favorite: z.boolean().optional().default(false),
});

export type CustomerBeneficiary = {
  id: string;
  kind: "own" | "internal" | "external";
  beneficiary_name: string;
  account_number: string;
  bank_name: string | null;
  bank_code: string | null;
  nickname: string | null;
  currency: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export const listBeneficiaries = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; q?: string }) =>
    z.object({ slug, q: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<CustomerBeneficiary[]> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    let q = supabaseAdmin
      .from("bank_beneficiaries")
      .select("*")
      .eq("customer_id", s.customer.id)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.q) {
      q = q.or(
        `beneficiary_name.ilike.%${data.q}%,account_number.ilike.%${data.q}%,nickname.ilike.%${data.q}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind as CustomerBeneficiary["kind"],
      beneficiary_name: r.beneficiary_name,
      account_number: r.account_number,
      bank_name: r.bank_name,
      bank_code: r.bank_code,
      nickname: r.nickname,
      currency: r.currency,
      is_favorite: r.is_favorite,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  });

export const addBeneficiary = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof beneficiarySchema>) => beneficiarySchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: row, error } = await supabaseAdmin
      .from("bank_beneficiaries")
      .insert({
        bank_id: s.bank.id,
        customer_id: s.customer.id,
        kind: data.kind,
        beneficiary_name: data.beneficiary_name,
        account_number: data.account_number,
        bank_name: data.bank_name ?? null,
        bank_code: data.bank_code ?? null,
        nickname: data.nickname ?? null,
        currency: data.currency,
        is_favorite: data.is_favorite ?? false,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to add beneficiary");
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "beneficiary",
      title: "Beneficiary added",
      body: `${data.beneficiary_name} was added to your beneficiaries.`,
    });
    return { id: row.id };
  });

export const updateBeneficiary = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; id: string; patch: Partial<z.input<typeof beneficiarySchema>> }) =>
      z
        .object({
          slug,
          id: z.string().uuid(),
          patch: beneficiarySchema.partial().omit({ slug: true }),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { error } = await supabaseAdmin
      .from("bank_beneficiaries")
      .update(data.patch)
      .eq("id", data.id)
      .eq("customer_id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBeneficiary = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; id: string }) =>
    z.object({ slug, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { error } = await supabaseAdmin
      .from("bank_beneficiaries")
      .delete()
      .eq("id", data.id)
      .eq("customer_id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleBeneficiaryFavorite = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; id: string; is_favorite: boolean }) =>
    z
      .object({ slug, id: z.string().uuid(), is_favorite: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { error } = await supabaseAdmin
      .from("bank_beneficiaries")
      .update({ is_favorite: data.is_favorite })
      .eq("id", data.id)
      .eq("customer_id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
