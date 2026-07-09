// Customer-facing read functions for transactions, notifications, restrictions.
// These are cookie-authenticated per tenant, so the same session guard used
// elsewhere in the portal protects them.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

async function resolveSession(slug: string) {
  const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bank = await resolveBankBySlug(slug);
  if (!bank) return null;
  const cookies = parseCookies(getRequestHeader("cookie"));
  const token = cookies[cookieName(slug)];
  if (!token) return null;
  const { data: session } = await supabaseAdmin
    .from("bank_customer_sessions")
    .select("customer_id, bank_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session || session.bank_id !== bank.id) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return { bank, customer_id: session.customer_id };
}

export type CustomerTx = {
  id: string;
  kind: string;
  direction: "credit" | "debit" | "neutral";
  amount: number;
  currency: string;
  description: string;
  balance_after: number;
  created_at: string;
};

export type CustomerNotif = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type CustomerRestriction = {
  id: string;
  types: string[];
  start_at: string | null;
  end_at: string | null;
  reason: string;
  active: boolean;
  created_at: string;
};

export const customerListTransactions = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<CustomerTx[]> => {
    const s = await resolveSession(data.slug);
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("bank_transactions")
      .select("id, kind, direction, amount, currency, description, balance_after, created_at")
      .eq("customer_id", s.customer_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      direction: r.direction as "credit" | "debit" | "neutral",
      amount: Number(r.amount),
      currency: r.currency,
      description: r.description,
      balance_after: Number(r.balance_after),
      created_at: r.created_at,
    }));
  });

export const customerListNotifications = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<CustomerNotif[]> => {
    const s = await resolveSession(data.slug);
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("bank_notifications")
      .select("id, kind, title, body, read_at, created_at")
      .eq("customer_id", s.customer_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      read_at: r.read_at ?? null,
      created_at: r.created_at,
    }));
  });

export const customerListRestrictions = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<CustomerRestriction[]> => {
    const s = await resolveSession(data.slug);
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("bank_account_restrictions")
      .select("id, types, start_at, end_at, reason, active, created_at")
      .eq("customer_id", s.customer_id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    return (rows ?? []).map((r) => ({
      id: r.id,
      types: (r.types ?? []) as string[],
      start_at: r.start_at ?? null,
      end_at: r.end_at ?? null,
      reason: r.reason,
      active: r.active,
      created_at: r.created_at,
    }));
  });
