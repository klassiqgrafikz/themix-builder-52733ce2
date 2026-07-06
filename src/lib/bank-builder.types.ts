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

export type BankBranding = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  logo_url: string;
  favicon_url: string;
  hero_image_url: string;
  button_style: "rounded" | "square" | "pill";
  border_radius: number;
  dark_mode: boolean;
};

export type BankFeatures = Record<string, boolean>;
export type BankSimulation = Record<string, boolean>;
export type BankAdminControls = Record<string, boolean>;

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
  "Retail Banking",
  "Commercial Banking",
  "Corporate Banking",
  "Private Banking",
  "Digital Banking",
  "Investment Banking",
] as const;

export const ADMIN_SECTIONS: {
  slug: string;
  label: string;
  description: string;
  icon: string;
}[] = [
  { slug: "customers", label: "Customer Management", description: "Manage customer records across every generated bank.", icon: "Users" },
  { slug: "balances", label: "Balance Manager", description: "Adjust simulated balances for any customer.", icon: "Wallet" },
  { slug: "transactions", label: "Transaction Manager", description: "Create, edit and reverse simulated transactions.", icon: "ArrowLeftRight" },
  { slug: "simulation", label: "Simulation Engine", description: "Configure balance, transaction and scheduled event simulations.", icon: "Cpu" },
  { slug: "restrictions", label: "Restriction Engine", description: "Set account restriction dates and rules.", icon: "ShieldAlert" },
  { slug: "freeze", label: "Account Freeze", description: "Freeze and unfreeze customer accounts.", icon: "Snowflake" },
  { slug: "notifications", label: "Notification Center", description: "Send in-app, email and SMS notifications.", icon: "Bell" },
  { slug: "chat", label: "Live Chat", description: "Configure live chat routing and templates.", icon: "MessageSquare" },
  { slug: "support", label: "Support Settings", description: "Support ticket categories and SLAs.", icon: "LifeBuoy" },
  { slug: "audit", label: "Audit Logs", description: "Immutable audit trail of platform actions.", icon: "FileCheck2" },
  { slug: "activity", label: "Activity Logs", description: "Customer and admin activity across banks.", icon: "Activity" },
  { slug: "analytics", label: "Analytics", description: "Usage, growth and simulation analytics.", icon: "BarChart3" },
  { slug: "roles", label: "Roles & Permissions", description: "Roles and per-bank permissions.", icon: "KeyRound" },
  { slug: "settings", label: "System Settings", description: "Platform-wide configuration.", icon: "Settings" },
  { slug: "banks", label: "Banks", description: "All generated tenant banks.", icon: "Building2" },
];
