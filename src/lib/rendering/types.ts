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
  /** Displayed on unauthenticated pages: public gateway, login, register, forgot. */
  login_logo_url: string | null;
  /** Displayed on the authenticated customer portal: dashboard, sidebar, mobile nav, statements. */
  dashboard_logo_url: string | null;
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

export type ResolvedProductRef = {
  code: string;
  name: string;
  category_slug: string;
  description: string;
  icon: string;
  visibility: "public" | "private" | "internal";
  status: "active" | "inactive";
  sort_order: number;
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
    template_variant: "modern" | "corporate" | "premium";
  };

  theme: ThemeSpec;
  brand: BrandAssets;
  modules: ResolvedModule[];
  pages: GeneratedPage[];
  navigation: NavItem[];
  products: ResolvedProductRef[];
  metadata: {
    title: string;
    description: string;
    generator: "themixweb-rendering-engine";
    generated_at: string;
  };
  /**
   * Customer-dashboard layout published from the Dashboard Layout Designer.
   * Optional — omitted means the portal renders the default layout.
   * Mirrors `@/lib/dashboard-layout/types#DashboardLayout` but inlined to
   * avoid a dependency cycle with the rendering engine.
   */
  dashboard_layout?: {
    version: 1;
    items: {
      id: string;
      kind: string;
      width?: "full" | "half" | "third";
      visible?: boolean;
      locked?: boolean;
      props?: { [key: string]: string | number | boolean | null | undefined };
    }[];
    updated_at: string;
  };
  /**
   * Simple customer-dashboard style switch controlled from Manage Bank →
   * Dashboard Layout. Only swaps the account-summary component; every other
   * section renders unchanged.
   */
  dashboard_style?: "classic" | "modern" | "minimal" | "premium" | "premium_card";

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
  products: ResolvedProductRef[];
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
    login_logo_url?: string;
    dashboard_logo_url?: string;
    button_style?: "rounded" | "square" | "pill";
    border_radius?: number;
    dark_mode?: boolean;
    template_variant?: "modern" | "corporate" | "premium";
    dashboard_style?: "classic" | "premium_card";
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
