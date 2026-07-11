import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";
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
  .middleware([withPlatformServiceRole])
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
  .middleware([withPlatformServiceRole])
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

/** Owner-scoped: clear the rendering timeline for one bank (or all owned by
 * this user). Only removes render_logs — banks, customers, audit logs, ledger
 * and website manifests are preserved. */
export const clearRenderingHistory = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id?: string }) => z.object({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }): Promise<{ cleared: number }> => {
    const sb = anyClient(context.supabase);
    const q = sb.from("bb_bank_drafts").update({ render_logs: [] });
    const { data: rows, error } = data.id
      ? await q.eq("id", data.id).select("id")
      : await q.eq("owner_id", context.userId).select("id");
    if (error) throw new Error(error.message);
    return { cleared: (rows ?? []).length };
  });

/** Owner-scoped: delete a generated bank. Removes:
 *   - the draft row (manifest, navigation, branding, render logs)
 *   - branding assets from the `bank-branding` storage bucket
 *   - bank-scoped products, notifications, support threads, cards, accounts,
 *     transactions, customers, sessions
 * Preserves audit logs unless purge_audit=true. */
export const deleteBank = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { id: string; purge_audit?: boolean }) =>
    z.object({ id: z.string().uuid(), purge_audit: z.boolean().optional().default(false) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sb = anyClient(context.supabase);
    // Authorization: draft owner OR gboc admin (has_role).
    const { data: draft } = await sb
      .from("bb_bank_drafts")
      .select("id, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!draft) throw new Error("Bank not found");
    if (draft.owner_id !== context.userId) {
      const { data: isAdmin } = await sb.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized to delete this bank");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove branding assets for this draft.
    const { data: brandingFiles } = await supabaseAdmin.storage
      .from("bank-branding")
      .list(data.id, { limit: 50 });
    if (brandingFiles && brandingFiles.length) {
      await supabaseAdmin.storage
        .from("bank-branding")
        .remove(brandingFiles.map((f) => `${data.id}/${f.name}`));
    }

    // Cascade delete tenant-scoped rows. Errors on any table abort with a
    // useful message so the UI can surface the exact reason.
    const tenantTables = [
      "bank_account_restrictions",
      "bank_customer_login_history",
      "bank_customer_sessions",
      "bank_customer_trusted_devices",
      "bank_beneficiaries",
      "bank_cards",
      "bank_notifications",
      "bank_support_messages",
      "bank_support_tickets",
      "bank_ledger_entries",
      "bank_financial_events",
      "bank_transactions",
      "bank_customer_accounts",
      "bank_customers",
    ] as const;
    for (const table of tenantTables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tErr } = await (supabaseAdmin as any).from(table).delete().eq("bank_id", data.id);
      if (tErr) throw new Error(`Failed clearing ${table}: ${tErr.message}`);
    }
    // bp_bank_products uses draft_id (not bank_id).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: pErr } = await (supabaseAdmin as any)
      .from("bp_bank_products")
      .delete()
      .eq("draft_id", data.id);
    if (pErr) throw new Error(`Failed clearing bp_bank_products: ${pErr.message}`);
    if (data.purge_audit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: aErr } = await (supabaseAdmin as any).from("bank_audit_logs").delete().eq("bank_id", data.id);
      if (aErr) throw new Error(`Failed clearing bank_audit_logs: ${aErr.message}`);
    }
    // Finally remove the draft. Use the user's RLS-scoped client — the
    // `owners manage own drafts` policy authorises the owner, and every child
    // table has ON DELETE CASCADE against bb_bank_drafts(id), so children
    // (including bank_customers, accounts, transactions, cards, notifications,
    // support, ledger, restrictions, sessions, audit logs, bp_bank_products)
    // are removed atomically at the DB layer. Avoids depending on
    // service-role privileges, which can be absent in some Cloud environments.
    // Fall back to supabaseAdmin only if the RLS delete somehow removes 0 rows
    // (e.g. admin acting on behalf of a non-owner).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primary = await (sb as any)
      .from("bb_bank_drafts")
      .delete()
      .eq("id", data.id)
      .select("id");
    let deletedCount = Array.isArray(primary.data) ? primary.data.length : 0;
    let delErr = primary.error;

    if (!delErr && deletedCount === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (supabaseAdmin as any)
        .from("bb_bank_drafts")
        .delete()
        .eq("id", data.id)
        .select("id");
      deletedCount = Array.isArray(fallback.data) ? fallback.data.length : 0;
      delErr = fallback.error;
    }
    if (delErr) throw new Error(`Failed deleting bank: ${delErr.message}`);
    if (deletedCount !== 1) {
      throw new Error(
        `Delete removed ${deletedCount} rows (expected 1). The row may have already been deleted or you may lack permission.`,
      );
    }
    // Post-delete verification via the admin client (bypasses public-read policy
    // filters and confirms the row is truly gone regardless of render_status).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stillThere, error: verifyErr } = await (supabaseAdmin as any)
      .from("bb_bank_drafts")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (verifyErr) throw new Error(`Delete verification failed: ${verifyErr.message}`);
    if (stillThere) {
      throw new Error(
        "Delete reported success but the bank row is still present after verification.",
      );
    }
    return { ok: true };
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
