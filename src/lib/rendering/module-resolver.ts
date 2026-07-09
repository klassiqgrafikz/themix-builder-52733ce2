import type {
  BankConfigurationInput,
  ModuleCatalogEntry,
  ResolvedModule,
} from "./types";

// Only enabled modules end up in the resolved list. Disabled modules never
// generate pages, routes, or nav entries — nothing empty is emitted.
export function resolveModules(
  cfg: BankConfigurationInput,
  catalog: ModuleCatalogEntry[],
): ResolvedModule[] {
  const enabled = cfg.features ?? {};
  return catalog
    .filter((m) => enabled[m.key] === true)
    .map((m) => ({
      key: m.key,
      label: m.label,
      group: m.group_name,
      pages: Array.isArray(m.default_pages) ? [...m.default_pages] : [],
    }));
}
