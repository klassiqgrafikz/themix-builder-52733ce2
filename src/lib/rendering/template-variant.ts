import type { BankConfigurationInput, BlueprintInput } from "./types";

export type TemplateVariant = "modern" | "corporate" | "premium";

export const TEMPLATE_VARIANTS: {
  id: TemplateVariant;
  name: string;
  tagline: string;
  description: string;
}[] = [
  {
    id: "modern",
    name: "Modern Digital Bank",
    tagline: "Clean fintech · Rounded · Minimal",
    description:
      "Large balance cards, generous whitespace, minimal navigation and a contemporary dashboard.",
  },
  {
    id: "corporate",
    name: "Corporate Banking",
    tagline: "Traditional · Information-dense · Formal",
    description:
      "Professional header, formal top navigation, tabular dashboard and enterprise-style layouts.",
  },
  {
    id: "premium",
    name: "Premium / Private Banking",
    tagline: "Elegant · Executive · Luxury",
    description:
      "Serif display type, dark executive shell, luxury card treatments and distinct premium navigation.",
  },
];

// Deterministic mapping from existing blueprint metadata to one of the 3 masters.
// Never requires schema changes — reads only blueprint fields we already have.
export function resolveTemplateVariant(input: {
  branding?: { template_variant?: string | null } | null;
  blueprint?: BlueprintInput;
  category?: string | null;
}): TemplateVariant {
  const explicit = input.branding?.template_variant;
  if (explicit === "modern" || explicit === "corporate" || explicit === "premium") {
    return explicit;
  }
  const hay = [
    input.blueprint?.blueprint_category ?? "",
    input.blueprint?.category ?? "",
    input.blueprint?.name ?? "",
    input.category ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (/(private|premium|wealth|elite|prestige)/.test(hay)) return "premium";
  if (/(corporate|commercial|enterprise|business|investment)/.test(hay)) return "corporate";
  return "modern";
}

export function variantFromConfig(
  cfg: BankConfigurationInput,
  blueprint: BlueprintInput,
): TemplateVariant {
  return resolveTemplateVariant({
    branding: cfg.branding as { template_variant?: string | null },
    blueprint,
  });
}
