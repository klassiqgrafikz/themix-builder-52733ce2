import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BankProductOverride,
  BlueprintProductLink,
  CatalogProduct,
  ProductCategory,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = (c: any) => c as any;

export const listProductCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProductCategory[]> => {
    const { data, error } = await anyClient(context.supabase)
      .from("bp_product_categories")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as ProductCategory[];
  });

export const listCatalogProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogProduct[]> => {
    const { data, error } = await anyClient(context.supabase)
      .from("bp_products")
      .select("*")
      .order("category_slug")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as CatalogProduct[];
  });

export const listBlueprintProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { blueprintId: string }) =>
    z.object({ blueprintId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<BlueprintProductLink[]> => {
    const { data: rows, error } = await anyClient(context.supabase)
      .from("bp_blueprint_products")
      .select("*")
      .eq("blueprint_id", data.blueprintId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []) as BlueprintProductLink[];
  });

export const listBankProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draftId: string }) =>
    z.object({ draftId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<BankProductOverride[]> => {
    const { data: rows, error } = await anyClient(context.supabase)
      .from("bp_bank_products")
      .select("*")
      .eq("draft_id", data.draftId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankProductOverride[];
  });

const upsertSchema = z.object({
  draftId: z.string().uuid(),
  product_code: z.string().min(1),
  enabled: z.boolean().optional(),
  display_label: z.string().nullable().optional(),
  visibility: z.enum(["inherit", "public", "private", "internal"]).optional(),
  sort_order: z.number().int().optional(),
});

export const upsertBankProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof upsertSchema>) => upsertSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankProductOverride> => {
    const patch = {
      draft_id: data.draftId,
      product_code: data.product_code,
      enabled: data.enabled ?? true,
      display_label: data.display_label ?? null,
      visibility: data.visibility ?? "inherit",
      sort_order: data.sort_order ?? 0,
    };
    const { data: row, error } = await anyClient(context.supabase)
      .from("bp_bank_products")
      .upsert(patch, { onConflict: "draft_id,product_code" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankProductOverride;
  });

export const deleteBankProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { draftId: string; product_code: string }) =>
    z.object({ draftId: z.string().uuid(), product_code: z.string() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await anyClient(context.supabase)
      .from("bp_bank_products")
      .delete()
      .eq("draft_id", data.draftId)
      .eq("product_code", data.product_code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// GBOC — product adoption across banks.
export type ProductAdoptionRow = {
  product_code: string;
  bank_count: number;
};

export const productAdoption = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProductAdoptionRow[]> => {
    const sb = anyClient(context.supabase);
    const { data: drafts, error: dErr } = await sb
      .from("bb_bank_drafts")
      .select("id, manifest")
      .eq("render_status", "published");
    if (dErr) throw new Error(dErr.message);
    const counts = new Map<string, number>();
    for (const row of (drafts ?? []) as { manifest: unknown }[]) {
      const m = row.manifest as { products?: { code: string }[] } | null;
      for (const p of m?.products ?? []) {
        counts.set(p.code, (counts.get(p.code) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([product_code, bank_count]) => ({ product_code, bank_count }))
      .sort((a, b) => b.bank_count - a.bank_count);
  });
