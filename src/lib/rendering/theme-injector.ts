import type { BankConfigurationInput, BrandAssets, ThemeSpec } from "./types";

const DEFAULT_THEME: ThemeSpec = {
  colors: { primary: "#0a2540", secondary: "#1e88e5", accent: "#00c48c" },
  typography: { heading: "Inter", body: "Inter" },
  radius: 8,
  button_style: "rounded",
  dark_mode: false,
};

// Produces a theme spec derived from the bank's own branding. Never mutates
// the blueprint — that guarantee is enforced by the Blueprint Loader.
export function injectTheme(cfg: BankConfigurationInput): ThemeSpec {
  const b = cfg.branding ?? {};
  return {
    colors: {
      primary: b.primary_color ?? DEFAULT_THEME.colors.primary,
      secondary: b.secondary_color ?? DEFAULT_THEME.colors.secondary,
      accent: b.accent_color ?? DEFAULT_THEME.colors.accent,
    },
    typography: {
      heading: b.font_heading ?? DEFAULT_THEME.typography.heading,
      body: b.font_body ?? DEFAULT_THEME.typography.body,
    },
    radius: b.border_radius ?? DEFAULT_THEME.radius,
    button_style: b.button_style ?? DEFAULT_THEME.button_style,
    dark_mode: b.dark_mode ?? DEFAULT_THEME.dark_mode,
  };
}

export function extractBrandAssets(cfg: BankConfigurationInput): BrandAssets {
  const b = cfg.branding ?? {};
  return {
    logo_url: b.logo_url?.trim() ? b.logo_url : null,
    favicon_url: b.favicon_url?.trim() ? b.favicon_url : null,
    hero_image_url: b.hero_image_url?.trim() ? b.hero_image_url : null,
  };
}
