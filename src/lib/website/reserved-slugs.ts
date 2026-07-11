// Reserved top-level path segments that must never be used as a bank short_slug,
// because they collide with platform routes (see src/routes/*.tsx).
export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "api",
  "assets",
  "auth",
  "bank-builder",
  "banks",
  "gboc",
  "launch",
  "manage",
  "portal",
  "products",
  "public",
  "_build",
  "_serverFn",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  // Reserved for the future flat-portal refactor (Phase 2).
  "accounts",
  "cards",
  "transactions",
  "transfer",
  "beneficiaries",
  "statements",
  "support",
  "profile",
  "security",
  "notifications",
];

const SHORT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,18}[a-z0-9])?$/;

export function sanitizeShortSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

export function validateShortSlug(slug: string): string | null {
  if (!slug) return "Slug is required.";
  if (slug.length < 2) return "Slug must be at least 2 characters.";
  if (slug.length > 20) return "Slug must be 20 characters or fewer.";
  if (!SHORT_SLUG_RE.test(slug)) {
    return "Only lowercase letters, digits, and hyphens; cannot start or end with a hyphen.";
  }
  if (isReservedSlug(slug)) return `"${slug}" is a reserved word.`;
  return null;
}

/** Generate a short slug from a bank name (acronym preferred, else compact name). */
export function suggestShortSlug(name: string | null | undefined, fallback = "bank"): string {
  const source = (name ?? "").trim();
  if (!source) return fallback;
  const words = source.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 2);
  if (words.length >= 2) {
    const acr = words.map((w) => w[0]!.toLowerCase()).join("");
    if (acr.length >= 2 && acr.length <= 6) return acr;
  }
  const compact = source.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  return compact.slice(0, 12) || fallback;
}
