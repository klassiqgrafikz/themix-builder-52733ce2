// Customer transfer server functions.
// -------------------------------------------------------------
// Every transfer is delegated to the Core Banking Engine's transfer
// pipeline. No UI or server-fn code updates balances directly.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

// Domestic account lookup — returns the recipient's account details when the
// account number resolves within the current tenant. Read-only.
export const lookupDomesticAccount = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; account_number: string }) =>
    z.object({ slug, account_number: z.string().trim().min(3).max(64) }).parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | { found: true; account_name: string; account_type: string; customer_name: string; currency: string }
      | { found: false }
    > => {
      const { requireCustomerSession } = await import("./session.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const s = await requireCustomerSession(data.slug);
      const { data: acct } = await supabaseAdmin
        .from("bank_customer_accounts")
        .select("id, account_name, account_type, currency, customer_id")
        .eq("bank_id", s.bank.id)
        .eq("account_number", data.account_number.trim())
        .maybeSingle();
      if (!acct) return { found: false };
      const { data: cust } = await supabaseAdmin
        .from("bank_customers")
        .select("first_name, last_name")
        .eq("id", acct.customer_id)
        .maybeSingle();
      return {
        found: true,
        account_name: acct.account_name,
        account_type: acct.account_type,
        currency: acct.currency,
        customer_name: cust ? `${cust.first_name} ${cust.last_name}` : "",
      };
    },
  );


const transferSchema = z.object({
  slug,
  kind: z.enum(["own", "internal", "external"]),
  source_account_id: z.string().uuid(),
  destination_account_id: z.string().uuid().optional().nullable(),
  beneficiary_id: z.string().uuid().optional().nullable(),
  beneficiary_name: z.string().trim().max(120).optional().nullable(),
  beneficiary_account_number: z.string().trim().max(64).optional().nullable(),
  beneficiary_bank_name: z.string().trim().max(120).optional().nullable(),
  beneficiary_bank_code: z.string().trim().max(40).optional().nullable(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().min(3).max(6).optional(),
  narration: z.string().trim().max(400).optional().nullable(),
  transfer_date: z.string().optional().nullable(),
  reference: z.string().trim().max(60).optional().nullable(),
  save_beneficiary: z.boolean().optional().default(false),
});

export type SubmitTransferResult = {
  transfer_id: string;
  transaction_id: string;
  new_balance: number;
  new_available: number;
  currency: string;
  receipt_reference: string;
};

export const submitTransfer = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof transferSchema>) => transferSchema.parse(d))
  .handler(async ({ data }): Promise<SubmitTransferResult> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      processOwnTransfer,
      processInternalTransfer,
      processExternalTransfer,
    } = await import("@/lib/cbe");

    const s = await requireCustomerSession(data.slug);
    const actor = {
      id: s.customer.id,
      email: s.customer.email,
      source: "customer" as const,
    };

    // Resolve beneficiary details (either from stored beneficiary or inline).
    let beneficiary:
      | { name: string; account_number: string; bank_name?: string | null; bank_code?: string | null }
      | undefined;
    let destinationAccountId: string | undefined =
      data.destination_account_id ?? undefined;

    if (data.beneficiary_id) {
      const { data: b } = await supabaseAdmin
        .from("bank_beneficiaries")
        .select("*")
        .eq("id", data.beneficiary_id)
        .eq("customer_id", s.customer.id)
        .maybeSingle();
      if (!b) throw new Error("Beneficiary not found");
      beneficiary = {
        name: b.beneficiary_name,
        account_number: b.account_number,
        bank_name: b.bank_name,
        bank_code: b.bank_code,
      };
    } else if (data.beneficiary_name && data.beneficiary_account_number) {
      beneficiary = {
        name: data.beneficiary_name,
        account_number: data.beneficiary_account_number,
        bank_name: data.beneficiary_bank_name ?? null,
        bank_code: data.beneficiary_bank_code ?? null,
      };
    }

    // For internal transfers, resolve destination by account number within the same tenant.
    if (data.kind === "internal" && !destinationAccountId && beneficiary) {
      const { data: dest } = await supabaseAdmin
        .from("bank_customer_accounts")
        .select("id")
        .eq("bank_id", s.bank.id)
        .eq("account_number", beneficiary.account_number)
        .maybeSingle();
      if (!dest) throw new Error("No matching account at this bank for the beneficiary account number");
      destinationAccountId = dest.id;
    }

    const req = {
      kind: data.kind,
      bank_id: s.bank.id,
      source_account_id: data.source_account_id,
      destination_account_id: destinationAccountId,
      beneficiary_id: data.beneficiary_id ?? null,
      beneficiary,
      amount: data.amount,
      currency: data.currency,
      description:
        data.narration ??
        (data.kind === "own"
          ? "Transfer between my accounts"
          : data.kind === "internal"
            ? `Transfer to ${beneficiary?.name ?? "beneficiary"}`
            : `External transfer to ${beneficiary?.name ?? "beneficiary"}`),
      narration: data.narration ?? null,
      reference: data.reference ?? null,
      transfer_date: data.transfer_date ?? null,
      actor,
      fee: data.kind === "external" ? 1 : 0, // simulation: flat 1.00 fee
    };

    const result =
      data.kind === "own"
        ? await processOwnTransfer(req)
        : data.kind === "internal"
          ? await processInternalTransfer(req)
          : await processExternalTransfer(req);

    // Persist beneficiary if requested and not already stored.
    if (data.save_beneficiary && beneficiary && !data.beneficiary_id) {
      await supabaseAdmin.from("bank_beneficiaries").insert({
        bank_id: s.bank.id,
        customer_id: s.customer.id,
        kind: data.kind === "own" ? "own" : data.kind,
        beneficiary_name: beneficiary.name,
        account_number: beneficiary.account_number,
        bank_name: beneficiary.bank_name ?? null,
        bank_code: beneficiary.bank_code ?? null,
        currency: result.source.currency,
      });
    }

    return {
      transfer_id: result.transfer_id,
      transaction_id: result.source.transaction_id,
      new_balance: result.source.new_balance,
      new_available: result.source.new_available,
      currency: result.source.currency,
      receipt_reference: data.reference ?? result.transfer_id,
    };
  });
