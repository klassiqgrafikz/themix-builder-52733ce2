// Server-only operations engine for the Global Banking Operations Center.
//
// Balance operations and manual transactions are delegated to the Core
// Banking Engine (`src/lib/cbe`) — this file no longer mutates account
// balances directly. Account lifecycle (freeze/suspend/close) and
// restrictions remain here because they are non-financial state changes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processFinancialEvent } from "@/lib/cbe";
import type { FinancialEventType } from "@/lib/cbe";
import type {
  AccountAction,
  BalanceOp,
  RestrictionType,
  TransactionKind,
} from "./types";

export type AuthorizedBank = {
  id: string;
  slug: string | null;
  bank_name: string;
  currency: string;
};

/**
 * Verify the bank exists AND is published. GBOC operates exclusively against
 * published tenants — the Website Manifest / Bank Instance is the source of
 * truth. Single-owner platform: no owner authorization check.
 */
export async function requireOwnedBank(
  _ownerId: string,
  bankId: string,
): Promise<AuthorizedBank> {
  const { data, error } = await supabaseAdmin
    .from("bb_bank_drafts")
    .select("id, slug, identity, render_status")
    .eq("id", bankId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bank not found");
  if (data.render_status !== "published") {
    throw new Error(
      "This bank is not published yet. Publish it from the Bank Builder before running operations.",
    );
  }
  const identity = (data.identity ?? {}) as { bank_name?: string; currency?: string };
  return {
    id: data.id,
    slug: data.slug ?? null,
    bank_name: identity.bank_name ?? "Untitled bank",
    currency: identity.currency ?? "USD",
  };
}

export async function loadAccountForBank(bankId: string, accountId: string) {
  const { data, error } = await supabaseAdmin
    .from("bank_customer_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("bank_id", bankId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Account not found in this bank");
  return data;
}

async function insertNotification(row: {
  bank_id: string;
  customer_id: string;
  kind: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("bank_notifications").insert({
    bank_id: row.bank_id,
    customer_id: row.customer_id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    metadata: (row.metadata ?? {}) as never,
  });
  if (error) throw new Error(error.message);
}

async function writeAudit(row: {
  bank_id: string;
  customer_id?: string | null;
  account_id?: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  previous_value?: unknown;
  new_value?: unknown;
  reason?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("bank_audit_logs").insert({
    bank_id: row.bank_id,
    customer_id: row.customer_id ?? null,
    account_id: row.account_id ?? null,
    actor_id: row.actor_id,
    actor_email: row.actor_email,
    action: row.action,
    previous_value: (row.previous_value ?? null) as unknown as never,
    new_value: (row.new_value ?? null) as unknown as never,
    reason: row.reason ?? null,
    reference: row.reference ?? null,
    metadata: (row.metadata ?? {}) as never,
  });
  if (error) throw new Error(error.message);
}

// Map GBOC balance ops onto Core Banking Engine event names.
const BALANCE_OP_TO_EVENT: Record<BalanceOp, FinancialEventType> = {
  add: "balance.add",
  deduct: "balance.deduct",
  set: "balance.set",
  clear: "balance.clear",
};

/**
 * Delegate to the Core Banking Engine. GBOC never touches balances directly.
 */
export async function applyBalanceOperation(args: {
  actor: { id: string | null; email: string | null };
  bank_id: string;
  account_id: string;
  op: BalanceOp;
  amount?: number;
  reason: string;
  reference?: string | null;
}) {
  const result = await processFinancialEvent({
    event: BALANCE_OP_TO_EVENT[args.op],
    bank_id: args.bank_id,
    account_id: args.account_id,
    amount: args.amount,
    description: args.reason,
    reference: args.reference ?? null,
    actor: { id: args.actor.id, email: args.actor.email, source: "gboc" },
    metadata: { gboc_op: args.op },
  });
  return {
    transaction_id: result.transaction_id,
    new_balance: result.new_balance,
    available_balance: result.new_available,
  };
}

export async function applyAccountAction(args: {
  actor: { id: string | null; email: string | null };
  bank_id: string;
  account_id: string;
  action: AccountAction;
  reason: string;
}) {
  const account = await loadAccountForBank(args.bank_id, args.account_id);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  let status = account.status;
  let title = "Account status updated";

  switch (args.action) {
    case "freeze":
      status = "frozen";
      patch.frozen_at = now;
      title = "Your account has been frozen";
      break;
    case "unfreeze":
      status = "active";
      patch.frozen_at = null;
      title = "Your account has been unfrozen";
      break;
    case "suspend":
      status = "suspended";
      patch.suspended_at = now;
      title = "Your account has been suspended";
      break;
    case "reactivate":
      status = "active";
      patch.suspended_at = null;
      patch.frozen_at = null;
      title = "Your account has been reactivated";
      break;
    case "close":
      status = "closed";
      patch.closed_at = now;
      title = "Your account has been closed";
      break;
    case "reopen":
      status = "active";
      patch.closed_at = null;
      title = "Your account has been reopened";
      break;
  }
  patch.status = status;

  const { error } = await supabaseAdmin
    .from("bank_customer_accounts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", account.id);
  if (error) throw new Error(error.message);

  await insertNotification({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    kind: "status",
    title,
    body: args.reason || "",
    metadata: { action: args.action, account_id: account.id },
  });
  await writeAudit({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    actor_id: args.actor.id,
    actor_email: args.actor.email,
    action: `account.${args.action}`,
    previous_value: { status: account.status },
    new_value: { status },
    reason: args.reason,
  });
  return { status };
}

export async function setRestriction(args: {
  actor: { id: string | null; email: string | null };
  bank_id: string;
  account_id: string;
  action: "enable" | "disable";
  types: RestrictionType[];
  start_at?: string | null;
  end_at?: string | null;
  reason: string;
  reference?: string | null;
}) {
  const account = await loadAccountForBank(args.bank_id, args.account_id);
  if (args.action === "disable") {
    const { error } = await supabaseAdmin
      .from("bank_account_restrictions")
      .update({ active: false })
      .eq("account_id", account.id)
      .eq("active", true);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("bank_customer_accounts")
      .update({ restriction_summary: {} })
      .eq("id", account.id);
    await insertNotification({
      bank_id: args.bank_id,
      customer_id: account.customer_id,
      kind: "restriction",
      title: "Restrictions removed from your account",
      body: args.reason || "",
    });
    await writeAudit({
      bank_id: args.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      actor_id: args.actor.id,
      actor_email: args.actor.email,
      action: "restriction.disable",
      reason: args.reason,
    });
    return { ok: true };
  }

  if (args.types.length === 0) throw new Error("At least one restriction type is required");
  const { data: inserted, error } = await supabaseAdmin
    .from("bank_account_restrictions")
    .insert({
      bank_id: args.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      types: args.types,
      start_at: args.start_at ?? null,
      end_at: args.end_at ?? null,
      reason: args.reason,
      reference: args.reference ?? null,
      active: true,
      created_by: args.actor.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("bank_customer_accounts")
    .update({
      restriction_summary: {
        types: args.types,
        start_at: args.start_at ?? null,
        end_at: args.end_at ?? null,
        reason: args.reason,
      },
    })
    .eq("id", account.id);

  await insertNotification({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    kind: "restriction",
    title: "Your account has been temporarily restricted",
    body: args.reason || "",
    metadata: { types: args.types, restriction_id: inserted.id },
  });
  await writeAudit({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    actor_id: args.actor.id,
    actor_email: args.actor.email,
    action: "restriction.enable",
    new_value: { types: args.types, start_at: args.start_at, end_at: args.end_at },
    reason: args.reason,
    reference: args.reference ?? null,
  });
  return { ok: true, restriction_id: inserted.id };
}

// Map manual GBOC transaction kinds to Core Banking Engine event names.
const KIND_TO_EVENT: Record<TransactionKind, FinancialEventType> = {
  deposit: "deposit",
  withdrawal: "withdrawal",
  credit_adjustment: "credit_adjustment",
  debit_adjustment: "debit_adjustment",
  fee: "fee",
  refund: "refund",
  interest: "interest",
  correction: "correction",
};

export async function createManualTransaction(args: {
  actor: { id: string | null; email: string | null };
  bank_id: string;
  account_id: string;
  kind: TransactionKind;
  amount: number;
  description: string;
  category?: string | null;
  reference?: string | null;
}) {
  const result = await processFinancialEvent({
    event: KIND_TO_EVENT[args.kind],
    bank_id: args.bank_id,
    account_id: args.account_id,
    amount: args.amount,
    description: args.description,
    category: args.category ?? null,
    reference: args.reference ?? null,
    actor: { id: args.actor.id, email: args.actor.email, source: "gboc" },
    metadata: { gboc_kind: args.kind },
  });
  return { transaction_id: result.transaction_id, new_balance: result.new_balance };
}
