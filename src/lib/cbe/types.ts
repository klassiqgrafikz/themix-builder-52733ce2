// Core Banking Engine — shared types.
// The CBE is the single financial processing pipeline for every generated
// bank. All financial events (customer or GBOC initiated) must flow through
// it. It is intentionally UI-agnostic and tenant-aware.

export const FINANCIAL_EVENTS = [
  "balance.add",
  "balance.deduct",
  "balance.set",
  "balance.clear",
  "deposit",
  "withdrawal",
  "credit_adjustment",
  "debit_adjustment",
  "fee",
  "refund",
  "interest",
  "reversal",
  "correction",
] as const;
export type FinancialEventType = (typeof FINANCIAL_EVENTS)[number];

export const LEDGER_ENTRY_TYPES = [
  "credit",
  "debit",
  "adjustment",
  "fee",
  "refund",
  "interest",
  "reversal",
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export type Direction = "credit" | "debit" | "neutral";

export const TRANSACTION_LIFECYCLE = [
  "requested",
  "validated",
  "posted",
  "completed",
  "rejected",
] as const;
export type TransactionLifecycle = (typeof TRANSACTION_LIFECYCLE)[number];

export type Actor = {
  id: string | null;
  email: string | null;
  source: "gboc" | "customer" | "system";
};

export type FinancialEventRequest = {
  event: FinancialEventType;
  bank_id: string;
  account_id: string;
  amount?: number;
  currency?: string; // must match account currency when provided
  description: string;
  category?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown>;
  actor: Actor;
  /** Explicit override — engine defaults derived from event when omitted. */
  allow_negative?: boolean;
};

export type FinancialEventResult = {
  transaction_id: string;
  ledger_entry_id: string;
  status: TransactionLifecycle;
  direction: Direction;
  amount: number;
  currency: string;
  previous_balance: number;
  new_balance: number;
  previous_available: number;
  new_available: number;
};
