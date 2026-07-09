// Global Banking Operations Center — shared types.

export type GbocBankSummary = {
  id: string;
  slug: string | null;
  bank_name: string;
  logo_url: string | null;
  blueprint: string | null;
  country: string | null;
  currency: string | null;
  status: string;
  render_status: string;
  customer_count: number;
  account_count: number;
};

export type GbocCustomerRow = {
  id: string;
  bank_id: string;
  customer_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  profile_picture_url: string | null;
  last_login_at: string | null;
  primary_account_number: string | null;
  primary_account_status: string | null;
  current_balance: number;
  available_balance: number;
  account_count: number;
};

export type GbocAccount = {
  id: string;
  account_number: string;
  account_name: string;
  currency: string;
  account_type: string;
  status: string;
  current_balance: number;
  available_balance: number;
  frozen_at: string | null;
  suspended_at: string | null;
  closed_at: string | null;
  restriction_summary: Record<string, unknown>;
  created_at: string;
};

export type GbocTransaction = {
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
  available_after: number;
  status: string;
  created_at: string;
};

export type GbocNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type GbocRestriction = {
  id: string;
  account_id: string;
  types: string[];
  start_at: string | null;
  end_at: string | null;
  reason: string;
  reference: string | null;
  active: boolean;
  created_at: string;
};

export type GbocAuditEntry = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  reference: string | null;
  created_at: string;
};

export type GbocCustomerDetail = {
  customer: {
    id: string;
    bank_id: string;
    customer_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    profile_picture_url: string | null;
    country: string | null;
    last_login_at: string | null;
    created_at: string;
  };
  accounts: GbocAccount[];
  transactions: GbocTransaction[];
  notifications: GbocNotification[];
  restrictions: GbocRestriction[];
  audit: GbocAuditEntry[];
};

export const BALANCE_OPS = ["add", "deduct", "set", "clear"] as const;
export type BalanceOp = (typeof BALANCE_OPS)[number];

export const ACCOUNT_ACTIONS = [
  "freeze",
  "unfreeze",
  "suspend",
  "reactivate",
  "close",
  "reopen",
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

export const RESTRICTION_TYPES = [
  "all",
  "incoming",
  "outgoing",
  "transfers",
  "cards",
  "withdrawals",
] as const;
export type RestrictionType = (typeof RESTRICTION_TYPES)[number];

export const TRANSACTION_KINDS = [
  "deposit",
  "withdrawal",
  "credit_adjustment",
  "debit_adjustment",
  "fee",
  "refund",
  "interest",
  "correction",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
