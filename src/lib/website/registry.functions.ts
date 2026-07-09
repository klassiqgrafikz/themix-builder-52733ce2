import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { BankDraft } from "@/lib/bank-builder.types";
import type { WebsiteManifest, RenderLogEntry } from "@/lib/rendering/types";
import {
  manifestLoadedLog,
  modulesInjectedLog,
  publicRouteFor,
  publishingCompletedLog,
  publishingFailedLog,
  publishingStartedLog,
  routesRegisteredLog,
  websiteGeneratedLog,
} from "./publisher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = (c: any) => c as any;

// --- Public read: anon-accessible via the publishable key + narrow RLS. ---
// Kept isolated from the admin/service-role client on purpose.
function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type PublishedBankRecord = {
  id: string;
  name: string;
  slug: string;
  route: string;
  blueprint_id: string | null;
  blueprint_category: string | null;
  status: "published";
  published_at: string | null;
  updated_at: string;
  manifest: WebsiteManifest;
};

export type WebsiteRegistryEntry = Omit<PublishedBankRecord, "manifest">;

/** Owner-scoped: publish a bank whose render_status is "ready". */
export const publishDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const sb = anyClient(context.supabase);

    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Bank not found");

    if (row.render_status !== "ready" && row.render_status !== "published") {
      throw new Error(
        `Bank must be rendered before publishing (current status: ${row.render_status}).`,
      );
    }
    if (!row.slug) throw new Error("Bank has no slug — re-run rendering first.");

    // Enforce slug uniqueness across published tenants.
    const { data: conflict } = await sb
      .from("bb_bank_drafts")
      .select("id")
      .eq("slug", row.slug)
      .eq("render_status", "published")
      .neq("id", row.id)
      .maybeSingle();

    const previousLogs = (Array.isArray(row.render_logs) ? row.render_logs : []) as RenderLogEntry[];
    const startingLogs = [...previousLogs, publishingStartedLog()];

    if (conflict) {
      const failedLogs = [
        ...startingLogs,
        publishingFailedLog(`Slug "${row.slug}" is already published by another bank`),
      ];
      await sb.from("bb_bank_drafts").update({ render_logs: failedLogs }).eq("id", row.id);
      throw new Error(`Slug "${row.slug}" is already in use by another published bank.`);
    }

    const manifest = row.manifest as WebsiteManifest | null;
    const route = publicRouteFor(row.slug);
    const logs = [
      ...startingLogs,
      manifest ? manifestLoadedLog(manifest.version) : publishingFailedLog("Missing manifest"),
      modulesInjectedLog(manifest?.modules.length ?? 0),
      websiteGeneratedLog(manifest?.pages.length ?? 0),
      routesRegisteredLog(route),
      publishingCompletedLog(route),
    ];

    const publishedAt = new Date().toISOString();
    const { data: updated, error: updErr } = await sb
      .from("bb_bank_drafts")
      .update({
        render_status: "published",
        published_at: publishedAt,
        render_logs: logs,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return updated as BankDraft;
  });

/** Owner-scoped: return a bank to Ready (removes it from the public registry). */
export const unpublishDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<BankDraft> => {
    const sb = anyClient(context.supabase);
    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .update({ render_status: "ready", published_at: null })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as BankDraft;
  });

/** Public: load a published bank by slug (uses publishable-key client). */
export const getPublishedBank = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<PublishedBankRecord | null> => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("bb_bank_drafts")
      .select("id, slug, manifest, navigation, template_id, render_status, published_at, updated_at")
      .eq("slug", data.slug)
      .eq("render_status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const manifest = row.manifest as unknown as WebsiteManifest;
    return {
      id: row.id,
      name: manifest.bank.name,
      slug: row.slug!,
      route: publicRouteFor(row.slug!),
      blueprint_id: manifest.bank.blueprint_id,
      blueprint_category: manifest.bank.blueprint_category,
      status: "published",
      published_at: row.published_at,
      updated_at: row.updated_at,
      manifest,
    };
  });

/** Public: list published tenants (Website Registry). */
export const listPublishedBanks = createServerFn({ method: "GET" }).handler(
  async (): Promise<WebsiteRegistryEntry[]> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("bb_bank_drafts")
      .select("id, slug, manifest, template_id, published_at, updated_at")
      .eq("render_status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const manifest = row.manifest as unknown as WebsiteManifest;
      return {
        id: row.id,
        name: manifest.bank.name,
        slug: row.slug!,
        route: publicRouteFor(row.slug!),
        blueprint_id: manifest.bank.blueprint_id,
        blueprint_category: manifest.bank.blueprint_category,
        status: "published" as const,
        published_at: row.published_at,
        updated_at: row.updated_at,
      };
    });
  },
);
