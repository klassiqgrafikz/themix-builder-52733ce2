import type { GeneratedPage, NavItem, ResolvedModule } from "./types";

// Navigation always reflects the resolved (enabled) modules. Disabled
// modules never appear anywhere in the nav.
export function generateNavigation(
  pages: GeneratedPage[],
  modules: ResolvedModule[],
): NavItem[] {
  const enabledKeys = new Set(modules.map((m) => m.key));
  const nav: NavItem[] = [];

  const home = pages.find((p) => p.slug === "home");
  if (home) {
    nav.push({ slug: home.slug, label: home.title, path: home.path, module_key: null });
  }

  for (const page of pages) {
    if (page.system) continue;
    if (page.module_key && !enabledKeys.has(page.module_key)) continue;
    nav.push({
      slug: page.slug,
      label: page.title,
      path: page.path,
      module_key: page.module_key,
    });
  }

  const support = pages.find((p) => p.slug === "support");
  if (support) {
    nav.push({ slug: support.slug, label: support.title, path: support.path, module_key: null });
  }

  return nav;
}
