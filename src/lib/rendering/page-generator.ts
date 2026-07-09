import type { GeneratedPage, ResolvedModule } from "./types";
import { slugify } from "./configuration-loader";

// System pages ship with every bank.
const SYSTEM_PAGES: GeneratedPage[] = [
  { slug: "home", path: "/", title: "Home", module_key: null, system: true },
  { slug: "login", path: "/login", title: "Sign in", module_key: null, system: true },
  { slug: "register", path: "/register", title: "Open an account", module_key: null, system: true },
  { slug: "support", path: "/support", title: "Support", module_key: null, system: true },
];

export function generatePages(modules: ResolvedModule[]): GeneratedPage[] {
  const seen = new Set(SYSTEM_PAGES.map((p) => p.slug));
  const modulePages: GeneratedPage[] = [];

  for (const m of modules) {
    for (const pageTitle of m.pages) {
      const slug = slugify(pageTitle);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      modulePages.push({
        slug,
        path: `/${slug}`,
        title: pageTitle,
        module_key: m.key,
        system: false,
      });
    }
  }

  return [...SYSTEM_PAGES, ...modulePages];
}
