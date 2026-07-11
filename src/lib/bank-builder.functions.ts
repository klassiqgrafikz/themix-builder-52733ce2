import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";
import { createPublicServerClient } from "@/integrations/supabase/public-server";
import type {
  BankCountry,
  BankTemplate,
  BankDraft,
  BlueprintCategory,
  BankModule,
} from "./bank-builder.types";
import { renderBankInstance } from "./rendering";
import type {
  BankConfigurationInput,
  BlueprintInput,
  ModuleCatalogEntry,
} from "./rendering/types";
import type {
  BankProductOverride,
  BlueprintProductLink,
  CatalogProduct,
} from "./products/types";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = (c: any) => c as any;

export const listCountries = createServerFn({ method: "GET" }).handler(
  async (): Promise<BankCountry[]> => {
    const { data, error } = await anyClient(createPublicServerClient())
      .from("bb_countries")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as BankCountry[];
  },
);

export const listTemplates = createServerFn({ method: "GET" })
  .inputValidator((d: { country_code?: string | null }) => d)
  .handler(async ({ data }): Promise<BankTemplate[]> => {
    let query = anyClient(createPublicServerClient())
      .from("bb_templates")
      .select("*")
      .order("name");
    if (data.country_code) query = query.eq("country_code", data.country_code);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankTemplate[];
  });

export const listBlueprintCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlueprintCategory[]> => {
    const { data, error } = await anyClient(createPublicServerClient())
      .from("bb_blueprint_categories")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as BlueprintCategory[];
  },
);

export const listModules = createServerFn({ method: "GET" }).handler(
  async (): Promise<BankModule[]> => {
    const { data, error } = await anyClient(createPublicServerClient())
      .from("bb_modules")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as BankModule[];
  },
);

export const listBlueprints = createServerFn({ method: "GET" })
  .inputValidator((d: { category?: string | null; country?: string | null }) => d)
  .handler(async ({ data }): Promise<BankTemplate[]> => {
    let q = anyClient(createPublicServerClient())
      .from("bb_templates")
      .select("*")
      .order("popularity", { ascending: false });
    if (data.category) q = q.eq("blueprint_category", data.category);
    if (data.country) q = q.eq("country_code", data.country);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankTemplate[];
  });

export const createDraft = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
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

export const useBlueprint = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { blueprintId: string }) =>
    z.object({ blueprintId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ draftId: string }> => {
    const sb = anyClient(context.supabase);
    const { data: t, error: tErr } = await sb
      .from("bb_templates")
      .select("*")
      .eq("id", data.blueprintId)
      .single();
    if (tErr || !t) throw new Error(tErr?.message ?? "Blueprint not found");

    const features: Record<string, boolean> = {};
    for (const m of (t.supported_modules ?? []) as string[]) features[m] = true;

    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .insert({
        owner_id: context.userId,
        mode: "template",
        template_id: t.id,
        country_code: t.country_code,
        current_step: 5,
        identity: {
          country_code: t.country_code,
          currency: t.currency,
          language: t.language,
        },
        branding: {
          primary_color: t.primary_color,
          secondary_color: t.secondary_color,
          accent_color: t.accent_color,
          dark_mode: t.theme === "dark",
        },
        features,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { draftId: row.id as string };
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([withPlatformServiceRole])
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
  .middleware([withPlatformServiceRole])
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
  .middleware([withPlatformServiceRole])
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
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const sb = anyClient(context.supabase);

    // 1. Load the persisted draft (owned config).
    const { data: draftRow, error: draftErr } = await sb
      .from("bb_bank_drafts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (draftErr || !draftRow) throw new Error(draftErr?.message ?? "Draft not found");

    // 2. Load blueprint (read-only) and module catalog.
    let blueprint: BlueprintInput = null;
    if (draftRow.template_id) {
      const { data: bp } = await sb
        .from("bb_templates")
        .select("*")
        .eq("id", draftRow.template_id)
        .single();
      blueprint = (bp as BlueprintInput) ?? null;
    }
    const { data: modulesRows, error: modErr } = await sb
      .from("bb_modules")
      .select("*")
      .order("sort_order");
    if (modErr) throw new Error(modErr.message);
    const catalog = (modulesRows ?? []) as ModuleCatalogEntry[];

    // 2b. Load product catalog + blueprint defaults + per-bank overrides.
    const [
      { data: productRows, error: pErr },
      { data: bpProductRows, error: bpErr },
      { data: bankProductRows, error: bkErr },
    ] = await Promise.all([
      sb.from("bp_products").select("*"),
      draftRow.template_id
        ? sb.from("bp_blueprint_products").select("*").eq("blueprint_id", draftRow.template_id)
        : Promise.resolve({ data: [], error: null }),
      sb.from("bp_bank_products").select("*").eq("draft_id", data.id),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (bpErr) throw new Error(bpErr.message);
    if (bkErr) throw new Error(bkErr.message);

    // 3. Mark as rendering so the UI can reflect the transition.
    await sb
      .from("bb_bank_drafts")
      .update({ render_status: "rendering" })
      .eq("id", data.id);

    // 4. Run the rendering engine.
    const config: BankConfigurationInput = {
      id: draftRow.id,
      owner_id: draftRow.owner_id,
      mode: draftRow.mode,
      template_id: draftRow.template_id,
      country_code: draftRow.country_code,
      identity: draftRow.identity ?? {},
      branding: draftRow.branding ?? {},
      features: draftRow.features ?? {},
      created_at: draftRow.created_at,
      updated_at: draftRow.updated_at,
    };

    const instance = renderBankInstance({
      config,
      blueprint,
      moduleCatalog: catalog,
      productCatalog: (productRows ?? []) as CatalogProduct[],
      blueprintProducts: (bpProductRows ?? []) as BlueprintProductLink[],
      bankProducts: (bankProductRows ?? []) as BankProductOverride[],
      previousStatus: (draftRow.render_status as BankDraft["render_status"]) ?? "draft",
      previousLogs: Array.isArray(draftRow.render_logs) ? draftRow.render_logs : [],
    });

    // 5. Persist the generated Bank Instance artifacts.
    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .update({
        status: "saved",
        current_step: 10,
        slug: instance.slug,
        manifest: instance.manifest,
        navigation: instance.navigation,
        render_logs: instance.logs,
        render_status: instance.status,
        rendered_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });

