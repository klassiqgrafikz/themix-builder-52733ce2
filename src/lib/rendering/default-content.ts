import type { BankConfigurationInput, HomepageContent, CatalogContent } from "./types";

function rf(desktop: string, mobile?: string): { desktop: string; mobile: string } {
  return { desktop, mobile: mobile ?? desktop };
}

function card(
  id: string,
  iconKey: string,
  title: string,
  description: string,
): { id: string; icon_key: string; title: { desktop: string; mobile: string }; description: { desktop: string; mobile: string }; visible_desktop: boolean; visible_mobile: boolean } {
  return { id, icon_key: iconKey, title: rf(title), description: rf(description), visible_desktop: true, visible_mobile: true };
}

export function defaultHomepageContent(cfg: BankConfigurationInput): HomepageContent {
  const bankName = cfg.identity.bank_name ?? "Your Bank";
  return {
    gateway: {
      heading: rf("Banking that keeps up with your day."),
      subtitle: rf(
        `Open a ${bankName} account in minutes. Instant transfers, real-time notifications and a portal designed around your money — not paperwork.`,
        `Open a ${bankName} account in minutes. Instant transfers and a portal designed around your money.`,
      ),
    },
    modern: {
      badge: rf("Digital-first banking"),
      hero_title: rf("Banking that keeps up\nwith your day."),
      hero_subtitle: rf(
        `Open a ${bankName} account in minutes. Instant transfers, real-time notifications and a portal designed around your money — not paperwork.`,
        `Open a ${bankName} account in minutes. Instant transfers and a portal designed around your money.`,
      ),
      cta_primary: rf("Open an account"),
      cta_secondary: rf("Customer login"),
      features: [
        card("f1", "Sparkles", "Instant onboarding", "Sign up online, no branch visit."),
        card("f2", "ShieldCheck", "Bank-grade security", "Encrypted end-to-end, 24/7 monitored."),
        card("f3", "Landmark", "Real accounts", "Full domestic and international rails."),
      ],
      show_balance_card: true,
    },
    corporate: {
      badge: rf("A trusted banking partner since day one"),
      hero_title: rf("Enterprise banking, delivered with precision."),
      hero_subtitle: rf(
        `${bankName} provides commercial, corporate and institutional clients with the transaction banking, lending and treasury infrastructure they rely on.`,
        `${bankName} provides commercial, corporate and institutional clients with the banking infrastructure they rely on.`,
      ),
      cta_primary: rf("Open a corporate account"),
      cta_secondary: rf("Customer login"),
      features: [
        card("f1", "Building2", "Transaction Banking", "Purpose-built services for enterprise clients operating across multiple jurisdictions."),
        card("f2", "Building2", "Corporate Lending", "Purpose-built services for enterprise clients operating across multiple jurisdictions."),
        card("f3", "Building2", "Treasury & FX", "Purpose-built services for enterprise clients operating across multiple jurisdictions."),
        card("f4", "Building2", "Trade Finance", "Purpose-built services for enterprise clients operating across multiple jurisdictions."),
      ],
      show_balance_card: false,
    },
    premium: {
      badge: rf("By invitation"),
      hero_title: rf("Discreet wealth,\nattended personally."),
      hero_subtitle: rf(
        `${bankName} serves a limited number of principal families and institutions worldwide. Every relationship is anchored by a dedicated private banker and a house of advisors.`,
        `${bankName} serves a limited number of principal families worldwide.`,
      ),
      cta_primary: rf("Begin an introduction"),
      cta_secondary: rf("Customer login"),
      features: [
        card("f1", "Crown", "Private Reserve", "A discretionary mandate, actively managed by our house."),
        card("f2", "Crown", "Global Custody", "Multi-jurisdiction custody with cross-border reporting."),
        card("f3", "Crown", "Concierge Desk", "Travel, aviation, art and lifestyle at every hour."),
      ],
      show_balance_card: false,
    },
  };
}

export function defaultCatalogContent(_cfg: BankConfigurationInput): CatalogContent {
  return {
    heading: rf("Products & Services"),
    subtitle: rf(
      "Explore our range of banking products designed for every need.",
      "Explore our range of banking products.",
    ),
  };
}
