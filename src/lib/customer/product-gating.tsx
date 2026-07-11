// Product-gating layer for the customer portal.
// Consumes WebsiteManifest.products (the single source of truth) and answers
// "is this navigation item / route / dashboard widget enabled for this bank?"
//
// No queries, no schema, no server calls — pure derivations from the manifest
// already loaded by the /$slug/portal route loader.
import type { ReactNode } from "react";
import type { WebsiteManifest, ResolvedProductRef } from "@/lib/rendering/types";
import { BrandedCard } from "./portal-ui";

/**
 * Nav-key → product codes that must be enabled for the nav item to appear.
 * If ANY listed code is present in manifest.products the nav item is enabled.
 * Empty array = always enabled (system/utility sections).
 */
export const NAV_PRODUCT_REQUIREMENTS: Record<string, string[]> = {
  dashboard: [],
  accounts: [
    "checking", "savings", "current", "business", "foreign_currency",
    "corporate", "joint", "student", "fixed_deposit_acct",
  ],
  transfer: [
    "internal_transfers", "external_transfers", "local_transfers",
    "international_transfers", "standing_orders", "bill_payments",
  ],
  beneficiaries: [
    "internal_transfers", "external_transfers", "local_transfers",
    "international_transfers",
  ],
  transactions: [],
  cards: ["debit_card", "credit_card", "prepaid_card", "virtual_card"],
  statements: [],
  notifications: [],
  support: [],
  security: [],
  profile: [],
};

export function enabledProductCodes(manifest: WebsiteManifest): Set<string> {
  return new Set(manifest.products.map((p) => p.code));
}

export function isProductEnabled(manifest: WebsiteManifest, code: string): boolean {
  return manifest.products.some((p) => p.code === code);
}

export function isAnyProductEnabled(manifest: WebsiteManifest, codes: string[]): boolean {
  if (codes.length === 0) return true;
  const set = enabledProductCodes(manifest);
  return codes.some((c) => set.has(c));
}

export function isNavEnabled(manifest: WebsiteManifest, navKey: string): boolean {
  const req = NAV_PRODUCT_REQUIREMENTS[navKey];
  if (!req) return true;
  return isAnyProductEnabled(manifest, req);
}

export function enabledProductsByCategory(
  manifest: WebsiteManifest,
  category: string,
): ResolvedProductRef[] {
  return manifest.products.filter((p) => p.category_slug === category);
}

/**
 * Renders a friendly "not available" card for routes that resolve to a
 * disabled product. Used by page bodies rather than a redirect so the URL
 * remains stable and no additional queries are triggered.
 */
export function ProductUnavailable({
  manifest,
  title,
}: {
  manifest: WebsiteManifest;
  title?: string;
}) {
  const primary = manifest.theme.colors.primary;
  return (
    <BrandedCard manifest={manifest}>
      <div className="py-10 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100" />
        <h2 className="text-lg font-semibold" style={{ color: primary }}>
          {title ?? "Service unavailable"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm opacity-70">
          This banking service is not available for this institution.
        </p>
      </div>
    </BrandedCard>
  );
}

/** Conditional render helper used inside dashboard widgets. */
export function IfProduct({
  manifest,
  codes,
  children,
}: {
  manifest: WebsiteManifest;
  codes: string[];
  children: ReactNode;
}) {
  return isAnyProductEnabled(manifest, codes) ? <>{children}</> : null;
}
