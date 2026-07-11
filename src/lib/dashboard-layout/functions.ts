import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";
import type { DashboardLayout } from "./types";
import { defaultDashboardLayout } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = (c: any) => c as any;

const layoutSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({
    id: z.string(),
    kind: z.string(),
    width: z.enum(["full", "half", "third"]).optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })),
  updated_at: z.string(),
});

async function assertOwner(sb: unknown, id: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("bb_bank_drafts")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bank not found");
  if (data.owner_id !== userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (sb as any).rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Not authorized for this bank");
  }
}

export type LayoutBundle = {
  draft: DashboardLayout;
  published: DashboardLayout | null;
};

export const getDashboardLayout = createServerFn({ method: "GET" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<LayoutBundle> => {
    const sb = anyClient(context.supabase);
    await assertOwner(sb, data.id, context.userId);
    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .select("dashboard_layout_draft, dashboard_layout")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const published = (row.dashboard_layout ?? null) as DashboardLayout | null;
    const draft = (row.dashboard_layout_draft ?? published ?? defaultDashboardLayout()) as DashboardLayout;
    return { draft, published };
  });

export const saveDashboardLayoutDraft = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string; layout: DashboardLayout }) =>
    z.object({ id: z.string().uuid(), layout: layoutSchema }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sb = anyClient(context.supabase);
    await assertOwner(sb, data.id, context.userId);
    const payload = { ...data.layout, updated_at: new Date().toISOString() };
    const { error } = await sb
      .from("bb_bank_drafts")
      .update({ dashboard_layout_draft: payload })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishDashboardLayout = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string; layout: DashboardLayout }) =>
    z.object({ id: z.string().uuid(), layout: layoutSchema }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sb = anyClient(context.supabase);
    await assertOwner(sb, data.id, context.userId);
    const payload = { ...data.layout, updated_at: new Date().toISOString() };

    // Load current manifest and inject layout so the published portal picks it
    // up without re-running the full rendering pipeline.
    const { data: row, error: rErr } = await sb
      .from("bb_bank_drafts")
      .select("manifest")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    const manifest = (row?.manifest ?? {}) as Record<string, unknown>;
    const nextManifest = { ...manifest, dashboard_layout: payload };

    const { error } = await sb
      .from("bb_bank_drafts")
      .update({
        dashboard_layout: payload,
        dashboard_layout_draft: payload,
        manifest: nextManifest,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetDashboardLayout = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ layout: DashboardLayout }> => {
    const sb = anyClient(context.supabase);
    await assertOwner(sb, data.id, context.userId);
    const layout = defaultDashboardLayout();
    // Draft only — Reset does not touch the published copy. The user must
    // "Publish Layout" to apply the reset to the live dashboard.
    const { error } = await sb
      .from("bb_bank_drafts")
      .update({ dashboard_layout_draft: layout })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { layout };
  });

export const duplicateDashboardLayout = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { from_id: string; to_id: string }) =>
    z.object({ from_id: z.string().uuid(), to_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ layout: DashboardLayout }> => {
    const sb = anyClient(context.supabase);
    // Caller must own or admin BOTH banks.
    await assertOwner(sb, data.from_id, context.userId);
    await assertOwner(sb, data.to_id, context.userId);
    const { data: src, error: sErr } = await sb
      .from("bb_bank_drafts")
      .select("dashboard_layout, dashboard_layout_draft")
      .eq("id", data.from_id)
      .single();
    if (sErr) throw new Error(sErr.message);
    // Prefer published layout, fall back to draft, then defaults.
    const source =
      (src?.dashboard_layout as DashboardLayout | null) ??
      (src?.dashboard_layout_draft as DashboardLayout | null) ??
      defaultDashboardLayout();
    const payload: DashboardLayout = { ...source, updated_at: new Date().toISOString() };
    // Copy ONLY presentation into destination's draft — user must Publish to apply.
    const { error } = await sb
      .from("bb_bank_drafts")
      .update({ dashboard_layout_draft: payload })
      .eq("id", data.to_id);
    if (error) throw new Error(error.message);
    return { layout: payload };
  });

export const listOwnedBanksForDuplicate = createServerFn({ method: "GET" })
  .middleware([withPlatformServiceRole])
  .handler(async ({ context }): Promise<{ id: string; name: string }[]> => {
    const sb = anyClient(context.supabase);
    const { data, error } = await sb
      .from("bb_bank_drafts")
      .select("id, identity")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { id: string; identity: { bank_name?: string } | null }) => ({
      id: r.id,
      name: (r.identity?.bank_name as string) || "Untitled bank",
    }));
  });
