// Core Banking Engine (CBE)
// -------------------------------------------------------------
// Centralized financial processing pipeline used by every generated bank.
// Pipeline:
//   request → validation → account-status check → balance validation
//     → ledger posting → balance update → transaction record
//     → notification → audit
//
// This module is UI-agnostic. Every caller (GBOC operations, customer
// portal, future modules like transfers or card payments) MUST route their
// financial events through `processFinancialEvent`. No other code should
// mutate `bank_customer_accounts.current_balance` or
// `bank_customer_accounts.available_balance` directly.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CbeError } from "./errors";
import { publishFinancialEvent } from "./event-bus";
import type {
  Direction,
  FinancialEventRequest,
  FinancialEventResult,
  LedgerEntryType,
} from "./types";

function money(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

type AccountRow = {
  id: string;
  bank_id: string;
  customer_id: string;
  currency: string;
  status: string;
  current_balance: number | string;
  available_balance: number | string;
  pending_balance: number | string | null;
  restriction_summary: unknown;
};

async function loadAccount(bank_id: string, account_id: string): Promise<AccountRow> {
  const { data, error } = await supabaseAdmin
    .from("bank_customer_accounts")
    .select(
      "id, bank_id, customer_id, currency, status, current_balance, available_balance, pending_balance, restriction_summary",
    )
    .eq("id", account_id)
    .maybeSingle();
  if (error) throw new CbeError("VALIDATION_FAILED", error.message);
  if (!data) throw new CbeError("ACCOUNT_NOT_FOUND", "Account not found");
  if (data.bank_id !== bank_id) {
    throw new CbeError("TENANT_MISMATCH", "Account does not belong to this bank");
  }
  return data as AccountRow;
}

async function isDebitRestricted(account_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bank_account_restrictions")
    .select("types, active")
    .eq("account_id", account_id)
    .eq("active", true);
  for (const row of data ?? []) {
    const types = (row.types ?? []) as string[];
    if (types.includes("debits_blocked") || types.includes("all")) return true;
  }
  return false;
}

async function isCreditRestricted(account_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bank_account_restrictions")
    .select("types, active")
    .eq("account_id", account_id)
    .eq("active", true);
  for (const row of data ?? []) {
    const types = (row.types ?? []) as string[];
    if (types.includes("credits_blocked") || types.includes("all")) return true;
  }
  return false;
}

type Resolved = {
  direction: Direction;
  ledger_entry_type: LedgerEntryType;
  transaction_kind: string;
  delta: number; // signed delta to apply to balance
  amount: number; // absolute display amount
  allow_negative: boolean;
  notification_kind: string;
  notification_title: string;
};

function resolveEvent(req: FinancialEventRequest, current: number): Resolved {
  const raw = money(req.amount ?? 0);
  const allow_negative = req.allow_negative === true;

  switch (req.event) {
    case "balance.add":
    case "deposit":
    case "credit_adjustment":
    case "refund":
    case "interest": {
      if (raw <= 0) throw new CbeError("INVALID_AMOUNT", "Amount must be greater than zero");
      return {
        direction: "credit",
        ledger_entry_type:
          req.event === "refund"
            ? "refund"
            : req.event === "interest"
              ? "interest"
              : req.event === "deposit"
                ? "credit"
                : req.event === "balance.add"
                  ? "adjustment"
                  : "adjustment",
        transaction_kind:
          req.event === "balance.add" ? "credit_adjustment" : req.event,
        delta: raw,
        amount: raw,
        allow_negative,
        notification_kind: "credit",
        notification_title: "Your account has been credited",
      };
    }
    case "balance.deduct":
    case "withdrawal":
    case "debit_adjustment":
    case "fee": {
      if (raw <= 0) throw new CbeError("INVALID_AMOUNT", "Amount must be greater than zero");
      return {
        direction: "debit",
        ledger_entry_type: req.event === "fee" ? "fee" : req.event === "withdrawal" ? "debit" : "adjustment",
        transaction_kind:
          req.event === "balance.deduct" ? "debit_adjustment" : req.event,
        delta: -raw,
        amount: raw,
        allow_negative,
        notification_kind: "debit",
        notification_title: "Your account has been debited",
      };
    }
    case "balance.set": {
      const target = money(req.amount ?? 0);
      const delta = money(target - current);
      const direction: Direction = delta >= 0 ? "credit" : delta < 0 ? "debit" : "neutral";
      return {
        direction,
        ledger_entry_type: "adjustment",
        transaction_kind: "correction",
        delta,
        amount: Math.abs(delta),
        allow_negative: true,
        notification_kind: direction === "debit" ? "debit" : "credit",
        notification_title: "Your balance has been updated",
      };
    }
    case "balance.clear": {
      const delta = money(0 - current);
      return {
        direction: delta >= 0 ? "credit" : "debit",
        ledger_entry_type: "adjustment",
        transaction_kind: "correction",
        delta,
        amount: Math.abs(delta),
        allow_negative: true,
        notification_kind: "info",
        notification_title: "Your balance has been cleared",
      };
    }
    case "correction": {
      const delta = money(req.amount ?? 0);
      return {
        direction: delta > 0 ? "credit" : delta < 0 ? "debit" : "neutral",
        ledger_entry_type: "adjustment",
        transaction_kind: "correction",
        delta,
        amount: Math.abs(delta),
        allow_negative: true,
        notification_kind: "info",
        notification_title: "A correction has been posted to your account",
      };
    }
    case "reversal": {
      const delta = money(req.amount ?? 0);
      return {
        direction: delta > 0 ? "credit" : delta < 0 ? "debit" : "neutral",
        ledger_entry_type: "reversal",
        transaction_kind: "correction",
        delta,
        amount: Math.abs(delta),
        allow_negative: true,
        notification_kind: "info",
        notification_title: "A reversal has been posted to your account",
      };
    }
    default:
      throw new CbeError("UNSUPPORTED_EVENT", `Unsupported financial event: ${req.event}`);
  }
}

/**
 * Stage 1 & 2: validate the incoming request and load the tenant-scoped
 * account. Throws CbeError on any failure — never mutates state.
 */
async function validateAndLoad(req: FinancialEventRequest) {
  if (!req.bank_id) throw new CbeError("VALIDATION_FAILED", "bank_id is required");
  if (!req.account_id) throw new CbeError("VALIDATION_FAILED", "account_id is required");
  if (!req.description || !req.description.trim()) {
    throw new CbeError("VALIDATION_FAILED", "description is required");
  }
  const account = await loadAccount(req.bank_id, req.account_id);
  if (req.currency && req.currency !== account.currency) {
    throw new CbeError("INVALID_CURRENCY", "Currency does not match the account currency");
  }
  // Account status gate
  switch (account.status) {
    case "active":
      break;
    case "frozen":
      throw new CbeError("ACCOUNT_FROZEN", "Account is frozen — financial operations are blocked");
    case "suspended":
      throw new CbeError("ACCOUNT_SUSPENDED", "Account is suspended — financial operations are denied");
    case "closed":
      throw new CbeError("ACCOUNT_CLOSED", "Account is closed — no operations are permitted");
    default:
      // Unknown / restricted states fall through to restriction checks below.
      break;
  }
  return account;
}

/**
 * Core entry point. Runs the full pipeline and returns the posted result.
 * Any caller that mutates a customer balance MUST go through this function.
 */
export async function processFinancialEvent(
  req: FinancialEventRequest,
): Promise<FinancialEventResult> {
  const account = await validateAndLoad(req);
  const currentBalance = money(Number(account.current_balance));
  const currentAvailable = money(Number(account.available_balance));

  const resolved = resolveEvent(req, currentBalance);

  // Restriction checks (financial side only; login is unaffected).
  if (resolved.direction === "debit" && (await isDebitRestricted(account.id))) {
    throw new CbeError("ACCOUNT_RESTRICTED", "Debits are currently restricted on this account");
  }
  if (resolved.direction === "credit" && (await isCreditRestricted(account.id))) {
    throw new CbeError("ACCOUNT_RESTRICTED", "Credits are currently restricted on this account");
  }

  const newBalance = money(currentBalance + resolved.delta);
  const newAvailable = money(currentAvailable + resolved.delta);

  if (!resolved.allow_negative && newAvailable < 0) {
    throw new CbeError(
      "INSUFFICIENT_AVAILABLE_BALANCE",
      "Insufficient available balance for this operation",
    );
  }

  // --- Stage: transaction record (creates the customer-facing entry) ---
  const { data: tx, error: txErr } = await supabaseAdmin
    .from("bank_transactions")
    .insert({
      bank_id: account.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      kind: resolved.transaction_kind,
      direction: resolved.direction,
      amount: resolved.amount,
      currency: account.currency,
      description: req.description,
      category: req.category ?? resolved.transaction_kind,
      reference: req.reference ?? null,
      balance_after: newBalance,
      available_after: newAvailable,
      status: "posted",
      created_by: req.actor.id,
      metadata: {
        ...(req.metadata ?? {}),
        cbe_event: req.event,
        cbe_source: req.actor.source,
      },
    })
    .select("id")
    .single();
  if (txErr) throw new CbeError("VALIDATION_FAILED", txErr.message);

  // --- Stage: immutable ledger entry ---
  const { data: ledger, error: ledgerErr } = await supabaseAdmin
    .from("bank_ledger_entries")
    .insert({
      bank_id: account.bank_id,
      customer_id: account.customer_id,
      account_id: account.id,
      transaction_id: tx.id,
      entry_type: resolved.ledger_entry_type,
      direction: resolved.direction,
      amount: resolved.amount,
      currency: account.currency,
      balance_after: newBalance,
      available_after: newAvailable,
      status: "posted",
      event_type: req.event,
      reference: req.reference ?? null,
      description: req.description,
      metadata: {
        ...(req.metadata ?? {}),
        actor_source: req.actor.source,
      },
      created_by: req.actor.id,
    })
    .select("id")
    .single();
  if (ledgerErr) throw new CbeError("VALIDATION_FAILED", ledgerErr.message);

  // --- Stage: balance update ---
  if (resolved.delta !== 0) {
    const { error: accErr } = await supabaseAdmin
      .from("bank_customer_accounts")
      .update({ current_balance: newBalance, available_balance: newAvailable })
      .eq("id", account.id);
    if (accErr) throw new CbeError("VALIDATION_FAILED", accErr.message);
  }

  // --- Stage: notification (informational; failures do not roll back) ---
  await supabaseAdmin.from("bank_notifications").insert({
    bank_id: account.bank_id,
    customer_id: account.customer_id,
    kind: resolved.notification_kind,
    title: resolved.notification_title,
    body: req.description,
    metadata: {
      transaction_id: tx.id,
      ledger_entry_id: ledger.id,
      amount: resolved.amount,
      new_balance: newBalance,
      event: req.event,
    } as never,
  });

  // --- Stage: audit ---
  await supabaseAdmin.from("bank_audit_logs").insert({
    bank_id: account.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    actor_id: req.actor.id,
    actor_email: req.actor.email,
    action: `cbe.${req.event}`,
    previous_value: {
      current_balance: currentBalance,
      available_balance: currentAvailable,
    } as never,
    new_value: {
      current_balance: newBalance,
      available_balance: newAvailable,
    } as never,
    reason: req.description,
    reference: req.reference ?? null,
    metadata: {
      transaction_id: tx.id,
      ledger_entry_id: ledger.id,
      amount: resolved.amount,
      direction: resolved.direction,
      source: req.actor.source,
    } as never,
  });

  // --- Stage: financial event bus ---
  const correlation = (req.metadata?.transfer_id as string | undefined) ?? null;
  await publishFinancialEvent({
    bank_id: account.bank_id,
    customer_id: account.customer_id,
    account_id: account.id,
    transaction_id: tx.id,
    ledger_entry_id: ledger.id,
    event_type: req.event,
    direction: resolved.direction,
    amount: resolved.amount,
    currency: account.currency,
    correlation_id: correlation,
    payload: {
      previous_balance: currentBalance,
      new_balance: newBalance,
      previous_available: currentAvailable,
      new_available: newAvailable,
      actor_source: req.actor.source,
      metadata: req.metadata ?? {},
    },
  });

  return {
    transaction_id: tx.id,
    ledger_entry_id: ledger.id,
    status: "completed",
    direction: resolved.direction,
    amount: resolved.amount,
    currency: account.currency,
    previous_balance: currentBalance,
    new_balance: newBalance,
    previous_available: currentAvailable,
    new_available: newAvailable,
  };
}
