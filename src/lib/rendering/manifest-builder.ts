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
    },
    theme,
    brand,
    modules,
    pages,
    navigation,
    products,
    metadata: {
      title: name,
      description: `${name} — powered by TheMixWeb`,
      generator: "themixweb-rendering-engine",
      generated_at: new Date().toISOString(),
    },
  };
}
