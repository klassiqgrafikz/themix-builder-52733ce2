// Transaction center + receipts + statements.
// Statements are generated from the ledger written by the Core Banking Engine.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

export type TxRow = {
  id: string;
  account_id: string;
  kind: string;
  direction: "credit" | "debit" | "neutral";
  amount: number;
  currency: string;
  description: string;
  category: string | null;
  reference: string | null;
  balance_after: number;
  status: string;
  created_at: string;
};

export type TxDetail = TxRow & {
  metadata: Record<string, unknown>;
  bank_name: string;
  account_number: string;
  customer_name: string;
};

export const listTransactions = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      slug: string;
      account_id?: string | null;
      q?: string;
      from?: string | null;
      to?: string | null;
      direction?: "credit" | "debit" | null;
      min?: number | null;
      max?: number | null;
      category?: string | null;
      page?: number;
      pageSize?: number;
    }) =>
      z
        .object({
          slug,
          account_id: z.string().uuid().optional().nullable(),
          q: z.string().optional(),
          from: z.string().optional().nullable(),
          to: z.string().optional().nullable(),
          direction: z.enum(["credit", "debit"]).optional().nullable(),
          min: z.coerce.number().optional().nullable(),
          max: z.coerce.number().optional().nullable(),
          category: z.string().optional().nullable(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ rows: TxRow[]; total: number }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    let q = supabaseAdmin
      .from("bank_transactions")
      .select(
        "id, account_id, kind, direction, amount, currency, description, category, reference, balance_after, status, created_at",
        { count: "exact" },
      )
      .eq("customer_id", s.customer.id)
      .order("created_at", { ascending: false })
      .range(start, end);
    if (data.account_id) q = q.eq("account_id", data.account_id);
    if (data.direction) q = q.eq("direction", data.direction);
    if (data.category) q = q.eq("category", data.category);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.min != null) q = q.gte("amount", data.min);
    if (data.max != null) q = q.lte("amount", data.max);
    if (data.q) q = q.or(`description.ilike.%${data.q}%,reference.ilike.%${data.q}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []).map((r) => ({
        id: r.id,
        account_id: r.account_id,
        kind: r.kind,
        direction: r.direction as TxRow["direction"],
        amount: Number(r.amount),
        currency: r.currency,
        description: r.description,
        category: r.category,
        reference: r.reference,
        balance_after: Number(r.balance_after),
        status: r.status,
        created_at: r.created_at,
      })),
      total: count ?? 0,
    };
  });

export const getTransactionDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; id: string }) =>
    z.object({ slug, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<TxDetail | null> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPublishedBank } = await import("@/lib/website/registry.functions");
    const s = await requireCustomerSession(data.slug);
    const { data: t } = await supabaseAdmin
      .from("bank_transactions")
      .select("*")
      .eq("id", data.id)
      .eq("customer_id", s.customer.id)
      .maybeSingle();
    if (!t) return null;
    const { data: acct } = await supabaseAdmin
      .from("bank_customer_accounts")
      .select("account_number")
      .eq("id", t.account_id)
      .maybeSingle();
    const bank = await getPublishedBank({ data: { slug: data.slug } }).catch(() => null);
    return {
      id: t.id,
      account_id: t.account_id,
      kind: t.kind,
      direction: t.direction as TxRow["direction"],
      amount: Number(t.amount),
      currency: t.currency,
      description: t.description,
      category: t.category,
      reference: t.reference,
      balance_after: Number(t.balance_after),
      status: t.status,
      created_at: t.created_at,
      metadata: (t.metadata ?? {}) as Record<string, unknown>,
      bank_name: bank?.manifest.bank.name ?? "Bank",
      account_number: acct?.account_number ?? "",
      customer_name: `${s.customer.first_name} ${s.customer.last_name}`,
    };
  });

export const generateStatementCsv = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; account_id: string; from: string; to: string }) =>
      z
        .object({
          slug,
          account_id: z.string().uuid(),
          from: z.string(),
          to: z.string(),
        })
        .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      filename: string;
      csv: string;
      opening_balance: number;
      closing_balance: number;
      currency: string;
    }> => {
      const { requireCustomerSession } = await import("./session.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const s = await requireCustomerSession(data.slug);
      const { data: acct } = await supabaseAdmin
        .from("bank_customer_accounts")
        .select("account_number, currency, current_balance")
        .eq("id", data.account_id)
        .eq("customer_id", s.customer.id)
        .maybeSingle();
      if (!acct) throw new Error("Account not found");
      const { data: entries } = await supabaseAdmin
        .from("bank_ledger_entries")
        .select("created_at, direction, amount, description, reference, balance_after")
        .eq("account_id", data.account_id)
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .order("created_at", { ascending: true });
      const rows = entries ?? [];
      const opening =
        rows.length > 0
          ? Number(rows[0].balance_after) -
            (rows[0].direction === "credit"
              ? Number(rows[0].amount)
              : rows[0].direction === "debit"
                ? -Number(rows[0].amount)
                : 0)
          : Number(acct.current_balance);
      const closing =
        rows.length > 0 ? Number(rows[rows.length - 1].balance_after) : Number(acct.current_balance);
      const header = ["Date", "Description", "Reference", "Debit", "Credit", "Balance"].join(",");
      const body = rows
        .map((r) => {
          const debit = r.direction === "debit" ? Number(r.amount).toFixed(2) : "";
          const credit = r.direction === "credit" ? Number(r.amount).toFixed(2) : "";
          const cells = [
            new Date(r.created_at).toISOString(),
            JSON.stringify(r.description ?? ""),
            JSON.stringify(r.reference ?? ""),
            debit,
            credit,
            Number(r.balance_after).toFixed(2),
          ];
          return cells.join(",");
        })
        .join("\n");
      const csv = `${header}\n${body}\n`;
      return {
        filename: `statement-${acct.account_number}-${data.from.slice(0, 10)}-${data.to.slice(0, 10)}.csv`,
        csv,
        opening_balance: opening,
        closing_balance: closing,
        currency: acct.currency,
      };
    },
  );
