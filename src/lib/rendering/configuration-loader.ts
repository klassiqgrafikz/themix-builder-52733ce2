import type { BankConfigurationInput } from "./types";

export class ConfigurationError extends Error {}

// Validates and normalises the persisted draft into a stable input for the engine.
export function loadConfiguration(raw: BankConfigurationInput): BankConfigurationInput {
  const cfg = JSON.parse(JSON.stringify(raw)) as BankConfigurationInput;

  if (!cfg.identity?.bank_name) {
    throw new ConfigurationError("Bank name is required before rendering");
  }
  if (!cfg.identity.subdomain) {
    throw new ConfigurationError("Bank subdomain is required before rendering");
  }
  if (!cfg.identity.country_code) {
    throw new ConfigurationError("Bank country is required before rendering");
  }

  cfg.features = cfg.features ?? {};
  cfg.branding = cfg.branding ?? {};
  return cfg;
}

export function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
