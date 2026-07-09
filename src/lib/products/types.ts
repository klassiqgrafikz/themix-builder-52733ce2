// Central Product Catalog types — decoupled from persistence and UI.

export type ProductCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  category_slug: string;
  description: string;
  icon: string;
  status: "active" | "inactive";
  supported_countries: string[];
  supported_currencies: string[];
  eligibility: Record<string, unknown>;
  visibility: "public" | "private" | "internal";
  default_visible: boolean;
  sort_order: number;
};

export type BlueprintProductLink = {
  blueprint_id: string;
  product_code: string;
  sort_order: number;
};

export type BankProductOverride = {
  draft_id: string;
  product_code: string;
  enabled: boolean;
  display_label: string | null;
  visibility: "inherit" | "public" | "private" | "internal";
  sort_order: number;
};

// Resolved product = what actually appears in a generated bank's manifest.
export type ResolvedProduct = {
  code: string;
  name: string;          // display label (override or catalog name)
  category_slug: string;
  description: string;
  icon: string;
  visibility: "public" | "private" | "internal";
  status: "active" | "inactive";
  sort_order: number;
};
