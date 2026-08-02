import type {
  BankConfigurationInput,
  BlueprintInput,
  BrandAssets,
  GeneratedPage,
  NavItem,
  ResolvedModule,
  ResolvedProductRef,
  ThemeSpec,
  WebsiteManifest,
} from "./types";
import { variantFromConfig } from "./template-variant";
import { getDashboardLayoutForKey } from "@/lib/dashboard-layout/types";
import { defaultHomepageContent, defaultCatalogContent } from "./default-content";


export function buildManifest(args: {
  bankId: string;
  slug: string;
  cfg: BankConfigurationInput;
  blueprint: BlueprintInput;
  theme: ThemeSpec;
  brand: BrandAssets;
  modules: ResolvedModule[];
  pages: GeneratedPage[];
  navigation: NavItem[];
  products: ResolvedProductRef[];
}): WebsiteManifest {
  const { bankId, slug, cfg, blueprint, theme, brand, modules, pages, navigation, products } = args;
  const name = cfg.identity.bank_name ?? "Untitled bank";
  const template_variant = variantFromConfig(cfg, blueprint);

  return {
    version: 1,
    bank: {
      id: bankId,
      name,
      slug,
      blueprint_id: blueprint?.id ?? null,
      blueprint_category: blueprint?.blueprint_category ?? blueprint?.category ?? null,
      country_code: cfg.identity.country_code ?? cfg.country_code ?? null,
      currency: cfg.identity.currency ?? null,
      language: cfg.identity.language ?? null,
      timezone: cfg.identity.timezone ?? null,
      template_variant,
    },

    theme,
    brand,
    modules,
    pages,
    navigation,
    products,
    portal_layout_key: "sidebar",
    dashboard_layout: getDashboardLayoutForKey("sidebar"),
    homepage_content: cfg.branding.homepage_content ?? defaultHomepageContent(cfg),
    catalog_content: cfg.branding.catalog_content ?? defaultCatalogContent(cfg),
    metadata: {
      title: name,
      description: `${name} — powered by TheMixWeb`,
      generator: "themixweb-rendering-engine",
      generated_at: new Date().toISOString(),
    },
  };
}
