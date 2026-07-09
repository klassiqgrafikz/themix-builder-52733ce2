import { loadBlueprint } from "./blueprint-loader";
import { loadConfiguration, slugify } from "./configuration-loader";
import { extractBrandAssets, injectTheme } from "./theme-injector";
import { resolveModules } from "./module-resolver";
import { generatePages } from "./page-generator";
import { generateRoutes } from "./route-generator";
import { generateNavigation } from "./navigation-generator";
import { buildManifest } from "./manifest-builder";
import { assertTransition, nextAfterRender } from "./render-queue";
import { resolveProducts } from "@/lib/products/resolver";
import type {
  BankProductOverride,
  BlueprintProductLink,
  CatalogProduct,
} from "@/lib/products/types";
import type {
  BankConfigurationInput,
  BankInstance,
  BlueprintInput,
  ModuleCatalogEntry,
  RenderLogEntry,
  RenderStage,
  RenderStatus,
} from "./types";

export type RenderEngineInput = {
  config: BankConfigurationInput;
  blueprint: BlueprintInput;
  moduleCatalog: ModuleCatalogEntry[];
  productCatalog: CatalogProduct[];
  blueprintProducts: BlueprintProductLink[];
  bankProducts: BankProductOverride[];
  previousStatus?: RenderStatus;
  previousLogs?: RenderLogEntry[];
};

// Runs the full pipeline and returns a Bank Instance (never mutates inputs).
export function renderBankInstance(input: RenderEngineInput): BankInstance {
  const logs: RenderLogEntry[] = [];
  const log = (stage: RenderStage, message: string) => {
    logs.push({ stage, level: "info", message, at: new Date().toISOString() });
  };

  const from = input.previousStatus ?? "draft";
  assertTransition(from, "rendering");

  const blueprint = loadBlueprint(input.blueprint);
  log("blueprint_loaded", blueprint ? `Blueprint "${blueprint.name}" loaded` : "Custom build — no blueprint");

  const cfg = loadConfiguration(input.config);
  log("configuration_loaded", `Configuration loaded for ${cfg.identity.bank_name}`);

  const theme = injectTheme(cfg);
  const brand = extractBrandAssets(cfg);
  log("theme_applied", `Theme applied (${theme.dark_mode ? "dark" : "light"}, radius ${theme.radius}px)`);

  const modules = resolveModules(cfg, input.moduleCatalog);
  log(
    "modules_resolved",
    modules.length
      ? `${modules.length} module(s) enabled: ${modules.map((m) => m.label).join(", ")}`
      : "No optional modules enabled",
  );

  const pages = generatePages(modules);
  log("pages_generated", `${pages.length} page(s) generated`);

  const routes = generateRoutes(pages);
  log("routes_generated", `${routes.length} route(s) generated`);

  const navigation = generateNavigation(pages, modules);
  log("navigation_generated", `${navigation.length} navigation item(s) generated`);

  const products = resolveProducts({
    catalog: input.productCatalog,
    blueprintLinks: input.blueprintProducts,
    bankOverrides: input.bankProducts,
    enabledModules: modules.map((m) => m.label),
    countryCode: cfg.identity.country_code ?? cfg.country_code ?? null,
    currency: cfg.identity.currency ?? null,
  });
  log(
    "modules_resolved",
    `${products.length} product(s) resolved from catalog`,
  );

  const slug = cfg.identity.subdomain ?? slugify(cfg.identity.bank_name ?? cfg.id);
  const manifest = buildManifest({
    bankId: cfg.id,
    slug,
    cfg,
    blueprint,
    theme,
    brand,
    modules,
    pages,
    navigation,
    products,
  });
  log("manifest_generated", `Website manifest v${manifest.version} generated`);

  const nextStatus = nextAfterRender();
  assertTransition("rendering", nextStatus);
  log("queued_for_publishing", "Bank instance ready — queued for publishing");

  const instance: BankInstance = {
    id: cfg.id,
    name: cfg.identity.bank_name ?? "Untitled bank",
    slug,
    blueprint_id: blueprint?.id ?? null,
    blueprint_category: blueprint?.blueprint_category ?? blueprint?.category ?? null,
    country_code: cfg.identity.country_code ?? cfg.country_code ?? null,
    currency: cfg.identity.currency ?? null,
    language: cfg.identity.language ?? null,
    timezone: cfg.identity.timezone ?? null,
    brand,
    theme,
    modules,
    pages,
    navigation,
    products,
    manifest,
    status: nextStatus,
    logs: [...(input.previousLogs ?? []), ...logs],
    created_at: cfg.created_at,
    updated_at: new Date().toISOString(),
  };

  return instance;
}
