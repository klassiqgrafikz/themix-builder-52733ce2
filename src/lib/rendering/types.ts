// Rendering engine types — kept independent from UI and DB layers.

export type RenderStatus =
  | "draft"
  | "rendering"
  | "ready"
  | "published"
  | "archived";

export type RenderStage =
  | "blueprint_loaded"
  | "configuration_loaded"
  | "manifest_loaded"
  | "theme_applied"
  | "modules_resolved"
  | "modules_injected"
  | "pages_generated"
  | "routes_generated"
  | "routes_registered"
  | "navigation_generated"
  | "manifest_generated"
  | "website_generated"
  | "queued_for_publishing"
  | "publishing_started"
  | "publishing_completed"
  | "publishing_failed";


export type RenderLogLevel = "info" | "warn" | "error";

export type RenderLogEntry = {
  stage: RenderStage | string;
  level: RenderLogLevel;
  message: string;
  at: string; // ISO
};

export type ThemeSpec = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  radius: number;
  button_style: "rounded" | "square" | "pill";
  dark_mode: boolean;
};

export type BrandAssets = {
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
};

export type ResolvedModule = {
  key: string;
  label: string;
  group: string;
  pages: string[];
};

export type GeneratedPage = {
  slug: string;         // e.g. "dashboard"
  path: string;         // e.g. "/dashboard"
  title: string;
  module_key: string | null; // null for system pages (home, login…)
  system: boolean;
};

export type NavItem = {
  slug: string;
  label: string;
  path: string;
  module_key: string | null;
};

export type WebsiteManifest = {
  version: 1;
  bank: {
    id: string;
    name: string;
    slug: string;
    blueprint_id: string | null;
    blueprint_category: string | null;
    country_code: string | null;
    currency: string | null;
    language: string | null;
    timezone: string | null;
  };
  theme: ThemeSpec;
  brand: BrandAssets;
  modules: ResolvedModule[];
  pages: GeneratedPage[];
  navigation: NavItem[];
  metadata: {
    title: string;
    description: string;
    generator: "themixweb-rendering-engine";
    generated_at: string;
  };
};

export type BankInstance = {
  id: string;
  name: string;
  slug: string;
  blueprint_id: string | null;
  blueprint_category: string | null;
  country_code: string | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  brand: BrandAssets;
  theme: ThemeSpec;
  modules: ResolvedModule[];
  pages: GeneratedPage[];
  navigation: NavItem[];
  manifest: WebsiteManifest;
  status: RenderStatus;
  logs: RenderLogEntry[];
  created_at: string;
  updated_at: string;
};

// Minimal shape the engine needs from persisted config. Kept structural so we
// don't couple the engine to Supabase row types.
export type BankConfigurationInput = {
  id: string;
  owner_id: string;
  mode: "template" | "custom";
  template_id: string | null;
  country_code: string | null;
  identity: {
    bank_name?: string;
    subdomain?: string;
    country_code?: string;
    currency?: string;
    timezone?: string;
    language?: string;
  };
  branding: {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    font_heading?: string;
    font_body?: string;
    logo_url?: string;
    favicon_url?: string;
    hero_image_url?: string;
    button_style?: "rounded" | "square" | "pill";
    border_radius?: number;
    dark_mode?: boolean;
  };
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type BlueprintInput = {
  id: string;
  name: string;
  category: string;
  blueprint_category: string | null;
  country_code: string;
  currency: string;
  language: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  theme: "light" | "dark";
  pages: string[];
  supported_modules: string[];
} | null;

export type ModuleCatalogEntry = {
  key: string;
  label: string;
  group_name: string;
  default_pages: string[];
};
