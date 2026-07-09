import type { GeneratedPage } from "./types";

export type GeneratedRoute = {
  path: string;
  page_slug: string;
  public: boolean;
};

const PROTECTED = new Set(["dashboard", "transfers", "cards", "statements", "beneficiaries", "loans", "investments"]);

export function generateRoutes(pages: GeneratedPage[]): GeneratedRoute[] {
  return pages.map((p) => ({
    path: p.path,
    page_slug: p.slug,
    public: !PROTECTED.has(p.slug),
  }));
}
