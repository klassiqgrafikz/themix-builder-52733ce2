// Server-only operations engine for the Global Banking Operations Center.
// Every mutation goes through here so tenant isolation, balance updates,
// notifications and audit logs stay in a single place.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

/** Verify the caller owns the bank. Throws if not. */
export async function requireOwnedBank(
  ownerId: string,
  bankId: string,
): Promise<AuthorizedBank> {
  const { data, error } = await supabaseAdmin
    .from("bb_bank_drafts")
    .select("id, slug, identity, owner_id")
    .eq("id", bankId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bank not found");
  if (data.owner_id !== ownerId) throw new Error("Not authorized for this bank");
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

export async function insertNotification(row: {
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
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function writeAudit(row: {
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
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

function money(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Apply a balance operation via the simulation engine:
 * validate → compute deltas → write transaction row → update account balances → notify → audit.
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
  const account = await loadAccountForBank(args.bank_id, args.account_id);
  const currentBalance = money(Number(account.current_balance));
  const currentAvailable = money(Number(account.available_balance));
  let newBalance = currentBalance;
  let newAvailable = currentAvailable;
  let direction: "credit" | "debit" | "neutral" = "neutral";
  let amount = money(args.amount ?? 0);
  let kind = "credit_adjustment";
  let title = "Account update";
  let body = args.reason;

  switch (args.op) {
    case "add": {
      if (amount <= 0) throw new Error("Amount must be greater than zero");
      newBalance = money(currentBalance + amount);
      newAvailable = money(currentAvailable + amount);
      direction = "credit";
      kind = "credit_adjustment";
      title = "Your account has been credited";
      break;
    }
    case "deduct": {
      if (amount <= 0) throw new Error("Amount must be greater than zero");
      newBalance = money(currentBalance - amount);
      newAvailable = money(currentAvailable - amount);
      direction = "debit";
      kind = "debit_adjustment";
      title = "Your account has been debited";
      break;
    }
    case "set": {
      const target = money(args.amount ?? 0);
      const delta = money(target - currentBalance);
      amount = Math.abs(delta);
      newBalance = target;
      newAvailable = target;
      direction = delta >= 0 ? "credit" : "debit";
      kind = "correction";
      title = "Your balance has been updated";
      break;
    }
    case "clear": {
      const delta = money(0 - currentBalance);
      amount = Math.abs(delta);
      newBalance = 0;
      newAvailable = 0;
      direction = delta >= 0 ? "credit" : "debit";
      kind = "correction";
      title = "Your balance has been cleared";
      body = args.reason || "Balance reset by operations.";
      break;
    }
  }

  const { data: tx, error: txErr } = await supabaseAdmin
    .from("bank_transactions")
    .insert({
      bank_id: args.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      kind,
      direction,
      amount,
      currency: account.currency,
      description: args.reason,
      category: "operations",
      reference: args.reference ?? null,
      balance_after: newBalance,
      available_after: newAvailable,
      status: "posted",
      created_by: args.actor.id,
      metadata: { op: args.op },
    })
    .select("*")
    .single();
  if (txErr) throw new Error(txErr.message);

  const { error: accErr } = await supabaseAdmin
    .from("bank_customer_accounts")
    .update({ current_balance: newBalance, available_balance: newAvailable })
    .eq("id", account.id);
  if (accErr) throw new Error(accErr.message);

  await insertNotification({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    kind: direction === "credit" ? "credit" : "debit",
    title,
    body,
    metadata: { transaction_id: tx.id, amount, op: args.op },
  });

  await writeAudit({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    actor_id: args.actor.id,
    actor_email: args.actor.email,
    action: `balance.${args.op}`,
    previous_value: { current_balance: currentBalance, available_balance: currentAvailable },
    new_value: { current_balance: newBalance, available_balance: newAvailable },
    reason: args.reason,
    reference: args.reference ?? null,
    metadata: { transaction_id: tx.id, amount },
  });

  return { transaction_id: tx.id, new_balance: newBalance, available_balance: newAvailable };
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
    .update(patch)
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

const CREDIT_KINDS = new Set<TransactionKind>(["deposit", "credit_adjustment", "refund", "interest"]);
const DEBIT_KINDS = new Set<TransactionKind>(["withdrawal", "debit_adjustment", "fee"]);

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
  const account = await loadAccountForBank(args.bank_id, args.account_id);
  const amount = money(args.amount);
  if (amount <= 0 && args.kind !== "correction") throw new Error("Amount must be greater than zero");

  let direction: "credit" | "debit" | "neutral" = "neutral";
  let delta = 0;
  if (CREDIT_KINDS.has(args.kind)) {
    direction = "credit";
    delta = amount;
  } else if (DEBIT_KINDS.has(args.kind)) {
    direction = "debit";
    delta = -amount;
  } else if (args.kind === "correction") {
    direction = amount >= 0 ? "credit" : "debit";
    delta = amount;
  }

  const currentBalance = money(Number(account.current_balance));
  const currentAvailable = money(Number(account.available_balance));
  const newBalance = money(currentBalance + delta);
  const newAvailable = money(currentAvailable + delta);

  const { data: tx, error } = await supabaseAdmin
    .from("bank_transactions")
    .insert({
      bank_id: args.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      kind: args.kind,
      direction,
      amount: Math.abs(amount),
      currency: account.currency,
      description: args.description,
      category: args.category ?? args.kind,
      reference: args.reference ?? null,
      balance_after: newBalance,
      available_after: newAvailable,
      status: "posted",
      created_by: args.actor.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (delta !== 0) {
    await supabaseAdmin
      .from("bank_customer_accounts")
      .update({ current_balance: newBalance, available_balance: newAvailable })
      .eq("id", account.id);
  }

  await insertNotification({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    kind: direction === "credit" ? "credit" : direction === "debit" ? "debit" : "info",
    title:
      direction === "credit"
        ? "A credit has been posted to your account"
        : direction === "debit"
          ? "A debit has been posted to your account"
          : "A transaction has been posted to your account",
    body: args.description,
    metadata: { transaction_id: tx.id, kind: args.kind },
  });
  await writeAudit({
    bank_id: args.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    actor_id: args.actor.id,
    actor_email: args.actor.email,
    action: `transaction.${args.kind}`,
    new_value: {
      amount,
      direction,
      description: args.description,
      balance_after: newBalance,
    },
    reason: args.description,
    reference: args.reference ?? null,
    metadata: { transaction_id: tx.id },
  });
  return { transaction_id: tx.id, new_balance: newBalance };
}
