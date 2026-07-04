import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BankCountry,
  BankTemplate,
  BankDraft,
} from "./bank-builder.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = (c: any) => c as any;

export const listCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BankCountry[]> => {
    const { data, error } = await anyClient(context.supabase)
      .from("bb_countries")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as BankCountry[];
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { country_code?: string | null }) => d)
  .handler(async ({ context, data }): Promise<BankTemplate[]> => {
    let query = anyClient(context.supabase).from("bb_templates").select("*").order("name");
    if (data.country_code) query = query.eq("country_code", data.country_code);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankTemplate[];
  });

export const createDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: "template" | "custom" }) =>
    z.object({ mode: z.enum(["template", "custom"]) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const { data: row, error } = await anyClient(context.supabase)
      .from("bb_bank_drafts")
      .insert({ owner_id: context.userId, mode: data.mode, current_step: 2 })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const { data: row, error } = await anyClient(context.supabase)
      .from("bb_bank_drafts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BankDraft[]> => {
    const { data, error } = await anyClient(context.supabase)
      .from("bb_bank_drafts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BankDraft[];
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  patch: z.record(z.string(), z.unknown()),
});

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => updateSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const { data: row, error } = await anyClient(context.supabase)
      .from("bb_bank_drafts")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });

export const finalizeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const { data: row, error } = await anyClient(context.supabase)
      .from("bb_bank_drafts")
      .update({ status: "saved", current_step: 10 })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });
