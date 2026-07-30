export type BankCountry = {
  code: string;
  name: string;
  currency: string;
  timezone: string;
  default_language: string;
  flag_emoji: string;
  region: string;
};

export type BankTemplate = {
  id: string;
  name: string;
  country_code: string;
  category: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  pages: string[];
  region: string;
  currency: string;
  language: string;
  theme: "light" | "dark";
  features: string[];
  mobile_support: boolean;
  is_premium: boolean;
  updated_at: string;
  blueprint_category: string | null;
  version: string;
  popularity: number;
  recommended: boolean;
  supported_modules: string[];
};

export type BlueprintCategory = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
};

export type BankModule = {
  key: string;
  group_name: string;
  label: string;
  description: string;
  default_pages: string[];
  sort_order: number;
};

export type BankIdentity = {
  bank_name: string;
  subdomain: string;
  country_code: string;
  currency: string;
  timezone: string;
  language: string;
};

export type DashboardStyle = "classic" | "modern" | "minimal" | "premium";
// Legacy value kept for backwards-compat on drafts saved before v2 of the picker.
export type DashboardStyleStored = DashboardStyle | "premium_card";
export function normalizeDashboardStyle(v: unknown): DashboardStyle {
  if (v === "modern" || v === "minimal" || v === "premium") return v;
  if (v === "premium_card") return "premium";
  return "classic";
}

export type BankBranding = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  login_logo_url: string;
  dashboard_logo_url: string;
  button_style: "rounded" | "square" | "pill";
  border_radius: number;
  dark_mode: boolean;
  dashboard_style?: DashboardStyle;
};

export type BankFeatures = Record<string, boolean>;
export type BankSimulation = Record<string, boolean>;
export type BankAdminControls = Record<string, boolean>;

import type { NavItem, RenderLogEntry, RenderStatus, WebsiteManifest } from "./rendering/types";
export type { NavItem, RenderLogEntry, RenderStatus, WebsiteManifest } from "./rendering/types";



export type BankDraft = {
  id: string;
  owner_id: string;
  mode: "template" | "custom";
  country_code: string | null;
  template_id: string | null;
  identity: Partial<BankIdentity>;
  branding: Partial<BankBranding>;
  features: BankFeatures;
  simulation: BankSimulation;
  admin_controls: BankAdminControls;
  current_step: number;
  status: "draft" | "saved";
  slug: string | null;
  short_slug: string | null;
  manifest: WebsiteManifest | Record<string, never>;
  navigation: NavItem[];
  render_logs: RenderLogEntry[];
  render_status: RenderStatus;
  rendered_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};


export const FEATURE_OPTIONS = [
  "Customer Registration",
  "Customer Login",
  "Forgot Password",
  "Transfer",
  "Beneficiaries",
  "Statements",
  "Notifications",
  "Cards",
  "Loans",
  "Investments",
  "Support",
  "Email Verification",
  "SMS Verification",
] as const;

export const SIMULATION_OPTIONS = [
  "Enable Balance Simulation",
  "Enable Transaction Simulation",
  "Enable Scheduled Deposits",
  "Enable Scheduled Withdrawals",
  "Enable Pending Transfers",
  "Enable Failed Transfers",
  "Enable Reversed Transfers",
  "Enable Restriction Dates",
  "Enable Account Freeze",
  "Enable Demo Notifications",
] as const;

export const ADMIN_OPTIONS = [
  "Balance Adder",
  "Balance Deductor",
  "Freeze Customer",
  "Restriction Date",
  "Clear Balance",
  "Edit Transactions",
  "Edit Customer",
  "Live Chat Toggle",
  "Support Widget",
  "Activity Logs",
  "Audit Logs",
] as const;

export const CATEGORY_OPTIONS = [
  "Online Banking",
] as const;

export const ADMIN_SECTIONS: {
  slug: string;
  label: string;
  description: string;
  icon: string;
}[] = [
  { slug: "balance-adder", label: "Balance Adder", description: "Credit simulated balances to any customer of the selected bank.", icon: "PlusCircle" },
  { slug: "balance-deductor", label: "Balance Deductor", description: "Debit simulated balances from any customer of the selected bank.", icon: "MinusCircle" },
  { slug: "freeze", label: "Freeze Account", description: "Temporarily freeze or unfreeze a customer account.", icon: "Snowflake" },
  { slug: "restrictions", label: "Restriction Date", description: "Apply date-based restrictions to customer accounts.", icon: "CalendarClock" },
  { slug: "clear-balance", label: "Clear Balance", description: "Reset a customer's balance to zero.", icon: "Eraser" },
  { slug: "customers", label: "Customer Manager", description: "View and manage customer records for the selected bank.", icon: "Users" },
  { slug: "transactions", label: "Transaction Manager", description: "Create, edit, and reverse simulated transactions.", icon: "ArrowLeftRight" },
  { slug: "chat", label: "Live Chat Configuration", description: "Configure the live chat widget for the selected bank.", icon: "MessageSquare" },
  { slug: "notifications", label: "Notification Engine", description: "Send in-app, email, and SMS notifications.", icon: "Bell" },
  { slug: "simulation", label: "Simulation Engine", description: "Configure balance, transaction, and scheduled event simulations.", icon: "Cpu" },
  { slug: "audit", label: "Audit Logs", description: "Immutable audit trail of platform actions.", icon: "FileCheck2" },
];
