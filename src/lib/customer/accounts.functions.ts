// Multi-account operations: open additional accounts for a customer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

const ACCOUNT_TYPES = ["checking", "savings", "current", "business", "foreign_currency"] as const;

export const openAdditionalAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      account_type: (typeof ACCOUNT_TYPES)[number];
      currency: string;
      nickname?: string;
    }) =>
      z
        .object({
          slug,
          account_type: z.enum(ACCOUNT_TYPES),
          currency: z.string().trim().min(3).max(6),
          nickname: z.string().trim().max(80).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ id: string; account_number: string }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { generateAccountNumber } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: customer } = await supabaseAdmin
      .from("bank_customers")
      .select("first_name, last_name")
      .eq("id", s.customer.id)
      .maybeSingle();
    if (!customer) throw new Error("Customer not found");
    const label =
      data.nickname ??
      `${customer.first_name} ${customer.last_name} — ${data.account_type.replace("_", " ")}`;
    const account_number = generateAccountNumber();
    const { data: row, error } = await supabaseAdmin
      .from("bank_customer_accounts")
      .insert({
        customer_id: s.customer.id,
        bank_id: s.bank.id,
        account_number,
        account_name: label,
        currency: data.currency,
        account_type: data.account_type,
        status: "active",
      })
      .select("id, account_number")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to open account");
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "account",
      title: "New account opened",
      body: `${label} (${account_number}) is now active.`,
    });
    return { id: row.id, account_number: row.account_number };
  });
