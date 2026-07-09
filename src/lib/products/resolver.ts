import type {
  BankProductOverride,
  BlueprintProductLink,
  CatalogProduct,
  ResolvedProduct,
} from "./types";

// Fallback map: when neither the blueprint nor the bank has explicit product
// selections yet, derive a sensible default set from enabled Bank Modules.
// Keys match module labels/keys used in bb_modules.
export const MODULE_TO_PRODUCT_CODES: Record<string, string[]> = {
  Transfer: ["internal_transfers", "external_transfers", "local_transfers"],
  Beneficiaries: ["internal_transfers"],
  Statements: [],
  Notifications: ["email_alerts", "sms_alerts", "push_notifications"],
  Cards: ["debit_card"],
  Loans: ["personal_loan"],
  Investments: ["fixed_deposits"],
  Support: [],
  "Email Verification": ["email_alerts"],
  "SMS Verification": ["sms_alerts"],
};

// Every generated bank always ships with these base accounts unless the owner
// explicitly disables them via a bank-level override.
const BASE_PRODUCT_CODES = ["checking", "savings"];

export type ResolverInput = {
  catalog: CatalogProduct[];
  blueprintLinks: BlueprintProductLink[];   // may be empty
  bankOverrides: BankProductOverride[];      // may be empty
  enabledModules: string[];                  // module labels or keys
  countryCode: string | null;
  currency: string | null;
};

export function resolveProducts(input: ResolverInput): ResolvedProduct[] {
  const byCode = new Map(input.catalog.map((p) => [p.code, p]));

  // 1. Base candidate set.
  const candidates = new Set<string>();
  for (const code of BASE_PRODUCT_CODES) candidates.add(code);
  for (const link of input.blueprintLinks) candidates.add(link.product_code);

  // 2. If no blueprint mapping, derive from enabled modules.
  if (input.blueprintLinks.length === 0) {
    for (const m of input.enabledModules) {
      const codes = MODULE_TO_PRODUCT_CODES[m] ?? [];
      for (const c of codes) candidates.add(c);
    }
  }

  // 3. Apply overrides — overrides can also add new products the owner chose.
  const overrideMap = new Map(input.bankOverrides.map((o) => [o.product_code, o]));
  for (const o of input.bankOverrides) candidates.add(o.product_code);

  // 4. Materialise, filter and sort.
  const out: ResolvedProduct[] = [];
  for (const code of candidates) {
    const p = byCode.get(code);
    if (!p) continue;
    if (p.status !== "active") continue;

    const override = overrideMap.get(code);
    if (override && override.enabled === false) continue;

    if (
      p.supported_countries.length > 0 &&
      input.countryCode &&
      !p.supported_countries.includes(input.countryCode)
    ) {
      continue;
    }
    if (
      p.supported_currencies.length > 0 &&
      input.currency &&
      !p.supported_currencies.includes(input.currency)
    ) {
      continue;
    }

    const visibility: ResolvedProduct["visibility"] =
      override && override.visibility !== "inherit" ? override.visibility : p.visibility;

    out.push({
      code: p.code,
      name: override?.display_label?.trim() || p.name,
      category_slug: p.category_slug,
      description: p.description,
      icon: p.icon,
      visibility,
      status: p.status,
      sort_order: override?.sort_order ?? p.sort_order,
    });
  }

  out.sort(
    (a, b) =>
      a.category_slug.localeCompare(b.category_slug) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );
  return out;
}
