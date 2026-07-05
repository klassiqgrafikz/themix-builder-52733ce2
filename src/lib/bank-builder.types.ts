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
