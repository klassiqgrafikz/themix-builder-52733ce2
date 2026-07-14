// Customer card management (virtual cards, freeze, limits — simulation).
// -------------------------------------------------------------
// Future card payments MUST route through the Core Banking Engine — this
// module only manages card lifecycle metadata.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

export type CustomerCard = {
  id: string;
  account_id: string;
  card_type: "virtual" | "physical";
  brand: string;
  card_holder: string;
  masked_number: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  status: "active" | "frozen" | "blocked" | "replaced" | "expired";
  daily_limit: number;
  monthly_limit: number;
  currency: string;
  created_at: string;
};

function randomDigits(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += (bytes[i] % 10).toString();
  return out;
}

export const listCards = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<CustomerCard[]> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("bank_cards")
      .select("*")
      .eq("customer_id", s.customer.id)
      .order("created_at", { ascending: false });
    return (rows ?? []).map((r) => ({
      id: r.id,
      account_id: r.account_id,
      card_type: r.card_type as CustomerCard["card_type"],
      brand: r.brand,
      card_holder: r.card_holder,
      masked_number: r.masked_number,
      last4: r.last4,
      expiry_month: r.expiry_month,
      expiry_year: r.expiry_year,
      status: r.status as CustomerCard["status"],
      daily_limit: Number(r.daily_limit),
      monthly_limit: Number(r.monthly_limit),
      currency: r.currency,
      created_at: r.created_at,
    }));
  });

export const issueCard = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      account_id: string;
      card_type?: "virtual" | "physical";
      brand?: string;
    }) =>
      z
        .object({
          slug,
          account_id: z.string().uuid(),
          card_type: z.enum(["virtual", "physical"]).optional(),
          brand: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: acct } = await supabaseAdmin
      .from("bank_customer_accounts")
      .select("id, currency, customer_id, bank_id")
      .eq("id", data.account_id)
      .eq("customer_id", s.customer.id)
      .maybeSingle();
    if (!acct) throw new Error("Account not found");
    const last4 = randomDigits(4);
    const bin = data.brand === "mastercard" ? "5300" : data.brand === "amex" ? "3782" : "4539";
    const masked = `${bin} •••• •••• ${last4}`;
    const now = new Date();
    const { data: inserted, error } = await supabaseAdmin
      .from("bank_cards")
      .insert({
        bank_id: acct.bank_id,
        customer_id: s.customer.id,
        account_id: acct.id,
        card_type: data.card_type ?? "virtual",
        brand: data.brand ?? "visa",
        card_holder: `${s.customer.first_name} ${s.customer.last_name}`.toUpperCase(),
        masked_number: masked,
        last4,
        expiry_month: now.getMonth() + 1,
        expiry_year: now.getFullYear() + 10,
        currency: acct.currency,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Card issue failed");
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "card",
      title: "New card issued",
      body: `A new ${data.card_type ?? "virtual"} card ending in ${last4} has been issued.`,
    });
    return { id: inserted.id };
  });

export const updateCardStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; card_id: string; action: "freeze" | "unfreeze" | "replace" }) =>
      z
        .object({
          slug,
          card_id: z.string().uuid(),
          action: z.enum(["freeze", "unfreeze", "replace"]),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: card } = await supabaseAdmin
      .from("bank_cards")
      .select("*")
      .eq("id", data.card_id)
      .eq("customer_id", s.customer.id)
      .maybeSingle();
    if (!card) throw new Error("Card not found");
    const now = new Date().toISOString();
    if (data.action === "freeze") {
      await supabaseAdmin.from("bank_cards").update({ status: "frozen", frozen_at: now }).eq("id", card.id);
    } else if (data.action === "unfreeze") {
      await supabaseAdmin.from("bank_cards").update({ status: "active", frozen_at: null }).eq("id", card.id);
    } else if (data.action === "replace") {
      await supabaseAdmin.from("bank_cards").update({ status: "replaced", replaced_at: now }).eq("id", card.id);
      // Issue replacement card
      const last4 = randomDigits(4);
      await supabaseAdmin.from("bank_cards").insert({
        bank_id: card.bank_id,
        customer_id: card.customer_id,
        account_id: card.account_id,
        card_type: card.card_type,
        brand: card.brand,
        card_holder: card.card_holder,
        masked_number: `${card.masked_number.split(" ")[0]} •••• •••• ${last4}`,
        last4,
        expiry_month: card.expiry_month,
        expiry_year: card.expiry_year + 4,
        currency: card.currency,
        daily_limit: card.daily_limit,
        monthly_limit: card.monthly_limit,
      });
    }
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "card",
      title:
        data.action === "freeze"
          ? "Card frozen"
          : data.action === "unfreeze"
            ? "Card activated"
            : "Card replaced",
      body: `Card ending in ${card.last4} was ${data.action}d.`,
    });
    return { ok: true };
  });

export const updateCardLimits = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; card_id: string; daily_limit: number; monthly_limit: number }) =>
      z
        .object({
          slug,
          card_id: z.string().uuid(),
          daily_limit: z.coerce.number().nonnegative().max(1_000_000),
          monthly_limit: z.coerce.number().nonnegative().max(10_000_000),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { error } = await supabaseAdmin
      .from("bank_cards")
      .update({ daily_limit: data.daily_limit, monthly_limit: data.monthly_limit })
      .eq("id", data.card_id)
      .eq("customer_id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
