// Server functions exposed to the Global Banking Operations Center UI.
// Every call is authenticated (requireSupabaseAuth) and tenant-verified.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACCOUNT_ACTIONS,
  BALANCE_OPS,
  RESTRICTION_TYPES,
  TRANSACTION_KINDS,
  type GbocBankSummary,
  type GbocCustomerDetail,
  type GbocCustomerRow,
} from "./types";

// -------- list banks --------

export const gbocListBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GbocBankSummary[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    // GBOC operates only on PUBLISHED tenants — the Website Manifest / Bank
    // Instance is the source of truth. Unpublished drafts are excluded.
    const { data: banks, error } = await sb
      .from("bb_bank_drafts")
      .select("id, slug, identity, branding, template_id, country_code, status, render_status, published_at")
      .eq("owner_id", context.userId)
      .eq("render_status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!banks || banks.length === 0) return [];

    const bankIds = banks.map((b: { id: string }) => b.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: customers }, { data: accounts }] = await Promise.all([
      supabaseAdmin.from("bank_customers").select("id, bank_id").in("bank_id", bankIds),
      supabaseAdmin.from("bank_customer_accounts").select("id, bank_id").in("bank_id", bankIds),
    ]);
    const custCount = new Map<string, number>();
    for (const c of customers ?? []) custCount.set(c.bank_id, (custCount.get(c.bank_id) ?? 0) + 1);
    const acctCount = new Map<string, number>();
    for (const a of accounts ?? []) acctCount.set(a.bank_id, (acctCount.get(a.bank_id) ?? 0) + 1);

    return banks.map((b: {
      id: string;
      slug: string | null;
      identity: { bank_name?: string; country_code?: string; currency?: string } | null;
      branding: { logo_url?: string } | null;
      template_id: string | null;
      country_code: string | null;
      status: string;
      render_status: string;
    }) => ({
      id: b.id,
      slug: b.slug,
      bank_name: b.identity?.bank_name ?? "Untitled bank",
      logo_url: b.branding?.logo_url ?? null,
      blueprint: b.template_id ?? null,
      country: b.identity?.country_code ?? b.country_code ?? null,
      currency: b.identity?.currency ?? null,
      status: b.status,
      render_status: b.render_status,
      customer_count: custCount.get(b.id) ?? 0,
      account_count: acctCount.get(b.id) ?? 0,
    }));
  });

// -------- list customers --------

export const gbocListCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string; search?: string | null }) =>
    z.object({ bank_id: z.string().uuid(), search: z.string().max(120).nullable().optional() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<GbocCustomerRow[]> => {
    const { requireOwnedBank } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("bank_customers")
      .select("*")
      .eq("bank_id", data.bank_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) {
      const term = data.search.trim();
      q = q.or(
        `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%,customer_number.ilike.%${term}%`,
      );
    }
    const { data: customers, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return [];

    const [{ data: accounts }, { data: logins }] = await Promise.all([
      supabaseAdmin
        .from("bank_customer_accounts")
        .select("*")
        .in("customer_id", ids)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("bank_customer_login_history")
        .select("customer_id, at, event")
        .in("customer_id", ids)
        .eq("event", "login_success")
        .order("at", { ascending: false }),
    ]);

    const primary = new Map<string, {
      account_number: string;
      status: string;
      current_balance: number;
      available_balance: number;
    }>();
    const counts = new Map<string, number>();
    for (const a of accounts ?? []) {
      counts.set(a.customer_id, (counts.get(a.customer_id) ?? 0) + 1);
      if (!primary.has(a.customer_id)) {
        primary.set(a.customer_id, {
          account_number: a.account_number,
          status: a.status,
          current_balance: Number(a.current_balance),
          available_balance: Number(a.available_balance),
        });
      }
    }
    const lastLogin = new Map<string, string>();
    for (const l of logins ?? []) {
      if (!lastLogin.has(l.customer_id)) lastLogin.set(l.customer_id, l.at);
    }

    return (customers ?? []).map((c) => {
      const p = primary.get(c.id);
      return {
        id: c.id,
        bank_id: c.bank_id,
        customer_number: c.customer_number,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone ?? null,
        status: c.status,
        profile_picture_url: c.profile_picture_url ?? null,
        last_login_at: lastLogin.get(c.id) ?? null,
        primary_account_number: p?.account_number ?? null,
        primary_account_status: p?.status ?? null,
        current_balance: p?.current_balance ?? 0,
        available_balance: p?.available_balance ?? 0,
        account_count: counts.get(c.id) ?? 0,
      };
    });
  });

// -------- customer detail --------

export const gbocGetCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string; customer_id: string }) =>
    z.object({ bank_id: z.string().uuid(), customer_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<GbocCustomerDetail> => {
    const { requireOwnedBank } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer, error } = await supabaseAdmin
      .from("bank_customers")
      .select("*")
      .eq("id", data.customer_id)
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Customer not found");

    const [accountsQ, txQ, notifQ, restrQ, auditQ, loginQ] = await Promise.all([
      supabaseAdmin
        .from("bank_customer_accounts")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("bank_transactions")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("bank_notifications")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("bank_account_restrictions")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("bank_audit_logs")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("bank_customer_login_history")
        .select("at")
        .eq("customer_id", customer.id)
        .eq("event", "login_success")
        .order("at", { ascending: false })
        .limit(1),
    ]);

    return {
      customer: {
        id: customer.id,
        bank_id: customer.bank_id,
        customer_number: customer.customer_number,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone ?? null,
        status: customer.status,
        profile_picture_url: customer.profile_picture_url ?? null,
        country: customer.country ?? null,
        last_login_at: loginQ.data?.[0]?.at ?? null,
        created_at: customer.created_at,
      },
      accounts: (accountsQ.data ?? []).map((a) => ({
        id: a.id,
        account_number: a.account_number,
        account_name: a.account_name,
        currency: a.currency,
        account_type: a.account_type,
        status: a.status,
        current_balance: Number(a.current_balance),
        available_balance: Number(a.available_balance),
        frozen_at: a.frozen_at ?? null,
        suspended_at: a.suspended_at ?? null,
        closed_at: a.closed_at ?? null,
        restriction_summary: a.restriction_summary ? JSON.stringify(a.restriction_summary) : null,
        created_at: a.created_at,
      })),
      transactions: (txQ.data ?? []).map((t) => ({
        id: t.id,
        account_id: t.account_id,
        kind: t.kind,
        direction: t.direction as "credit" | "debit" | "neutral",
        amount: Number(t.amount),
        currency: t.currency,
        description: t.description,
        category: t.category ?? null,
        reference: t.reference ?? null,
        balance_after: Number(t.balance_after),
        available_after: Number(t.available_after),
        status: t.status,
        created_at: t.created_at,
      })),
      notifications: (notifQ.data ?? []).map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        read_at: n.read_at ?? null,
        created_at: n.created_at,
      })),
      restrictions: (restrQ.data ?? []).map((r) => ({
        id: r.id,
        account_id: r.account_id,
        types: (r.types ?? []) as string[],
        start_at: r.start_at ?? null,
        end_at: r.end_at ?? null,
        reason: r.reason,
        reference: r.reference ?? null,
        active: r.active,
        created_at: r.created_at,
      })),
      audit: (auditQ.data ?? []).map((a) => ({
        id: a.id,
        actor_id: a.actor_id ?? null,
        actor_email: a.actor_email ?? null,
        action: a.action,
        previous_value: a.previous_value == null ? null : JSON.stringify(a.previous_value),
        new_value: a.new_value == null ? null : JSON.stringify(a.new_value),
        reason: a.reason ?? null,
        reference: a.reference ?? null,
        created_at: a.created_at,
      })),
    };
  });

// -------- balance operation --------

export const gbocBalanceOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    bank_id: string;
    account_id: string;
    op: (typeof BALANCE_OPS)[number];
    amount?: number;
    reason: string;
    reference?: string | null;
  }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        account_id: z.string().uuid(),
        op: z.enum(BALANCE_OPS),
        amount: z.number().finite().optional(),
        reason: z.string().trim().min(1).max(400),
        reference: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireOwnedBank, applyBalanceOperation } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    return applyBalanceOperation({
      actor: { id: context.userId, email: (context.claims as { email?: string } | undefined)?.email ?? null },
      bank_id: data.bank_id,
      account_id: data.account_id,
      op: data.op,
      amount: data.amount,
      reason: data.reason,
      reference: data.reference ?? null,
    });
  });

// -------- account status --------

export const gbocAccountAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    bank_id: string;
    account_id: string;
    action: (typeof ACCOUNT_ACTIONS)[number];
    reason: string;
  }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        account_id: z.string().uuid(),
        action: z.enum(ACCOUNT_ACTIONS),
        reason: z.string().trim().max(400).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireOwnedBank, applyAccountAction } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    return applyAccountAction({
      actor: { id: context.userId, email: (context.claims as { email?: string } | undefined)?.email ?? null },
      bank_id: data.bank_id,
      account_id: data.account_id,
      action: data.action,
      reason: data.reason,
    });
  });

// -------- restrictions --------

export const gbocSetRestriction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    bank_id: string;
    account_id: string;
    action: "enable" | "disable";
    types?: string[];
    start_at?: string | null;
    end_at?: string | null;
    reason: string;
    reference?: string | null;
  }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        account_id: z.string().uuid(),
        action: z.enum(["enable", "disable"]),
        types: z.array(z.enum(RESTRICTION_TYPES)).default([]),
        start_at: z.string().nullable().optional(),
        end_at: z.string().nullable().optional(),
        reason: z.string().trim().max(400).default(""),
        reference: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireOwnedBank, setRestriction } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    return setRestriction({
      actor: { id: context.userId, email: (context.claims as { email?: string } | undefined)?.email ?? null },
      bank_id: data.bank_id,
      account_id: data.account_id,
      action: data.action,
      types: data.types as never,
      start_at: data.start_at ?? null,
      end_at: data.end_at ?? null,
      reason: data.reason,
      reference: data.reference ?? null,
    });
  });

// -------- manual transaction --------

export const gbocCreateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    bank_id: string;
    account_id: string;
    kind: (typeof TRANSACTION_KINDS)[number];
    amount: number;
    description: string;
    category?: string | null;
    reference?: string | null;
  }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        account_id: z.string().uuid(),
        kind: z.enum(TRANSACTION_KINDS),
        amount: z.number().finite(),
        description: z.string().trim().min(1).max(400),
        category: z.string().trim().max(80).nullable().optional(),
        reference: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireOwnedBank, createManualTransaction } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    return createManualTransaction({
      actor: { id: context.userId, email: (context.claims as { email?: string } | undefined)?.email ?? null },
      bank_id: data.bank_id,
      account_id: data.account_id,
      kind: data.kind,
      amount: data.amount,
      description: data.description,
      category: data.category ?? null,
      reference: data.reference ?? null,
    });
  });

// -------- bank-wide audit --------

export const gbocListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) =>
    z.object({ bank_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireOwnedBank } = await import("./operations.server");
    await requireOwnedBank(context.userId, data.bank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bank_audit_logs")
      .select("*")
      .eq("bank_id", data.bank_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((a) => ({
      id: a.id,
      customer_id: a.customer_id ?? null,
      account_id: a.account_id ?? null,
      actor_email: a.actor_email ?? null,
      action: a.action,
      reason: a.reason ?? null,
      reference: a.reference ?? null,
      created_at: a.created_at,
    }));
  });
