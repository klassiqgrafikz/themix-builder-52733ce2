import type { GeneratedPage, WebsiteManifest } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Client-only check: is there a customer session cookie for this bank slug?
function useHasSession(slug: string): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const name = `themix_customer_${slug}=`;
    const found = document.cookie.split(";").some((c) => {
      const t = c.trim();
      return t.startsWith(name) && t.length > name.length;
    });
    setHas(found);
  }, [slug]);
  return has;
}

/**
 * TenantSite renders the public banking website from a Website Manifest.
 *
 * The public site is intentionally a minimal gateway: header with two actions
 * (Open Account, Customer Login) and a branded landing surface featuring the
 * bank logo and name. All banking functionality is behind authentication.
 */
export function TenantSite({
  manifest,
  page,
}: {
  manifest: WebsiteManifest;
  page: GeneratedPage;
}) {
  const { theme } = manifest;
  const isDark = theme.dark_mode;
  const bodyBg = isDark ? "#0b1120" : "#f8fafc";
  const text = isDark ? "#f1f5f9" : "#0f172a";

  // Ignore per-page routing on the public site — the homepage is the only
  // public surface. Any other "page" URL falls back to the same gateway.
  void page;

  return (
    <div
      style={{
        backgroundColor: bodyBg,
        color: text,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TenantHeader manifest={manifest} />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <Gateway manifest={manifest} />
      </main>
    </div>
  );
}

function TenantHeader({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank } = manifest;
  const hasSession = useHasSession(bank.slug);
  const surface = theme.dark_mode ? "#111827" : "#ffffff";
  const border = theme.dark_mode ? "#1f2937" : "#e5e7eb";

  return (
    <header
      style={{ backgroundColor: surface, borderBottom: `1px solid ${border}` }}
      className="sticky top-0 z-30"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/banks/$slug"
          params={{ slug: bank.slug }}
          className="min-w-0 truncate text-sm font-semibold sm:text-base"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          {bank.name}
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <BrandButton
            label={hasSession ? "My portal" : "Customer login"}
            href={hasSession ? `/banks/${bank.slug}/portal` : `/banks/${bank.slug}/login`}
            theme={theme}
            variant="ghost"
          />
          <BrandButton
            label="Open account"
            href={`/banks/${bank.slug}/register`}
            theme={theme}
          />
        </div>
      </div>
    </header>
  );
}

function Gateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, brand, bank } = manifest;
  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      {brand.logo_url ? (
        <img
          src={brand.logo_url}
          alt={`${bank.name} logo`}
          className="h-32 w-32 object-contain sm:h-40 sm:w-40"
        />
      ) : (
        <div
          className="flex h-32 w-32 items-center justify-center rounded-2xl text-4xl font-bold text-white sm:h-40 sm:w-40 sm:text-5xl"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
            fontFamily: theme.typography.heading,
          }}
        >
          {bank.name.slice(0, 1)}
        </div>
      )}
      <h1
        className="mt-8 text-3xl font-bold sm:text-4xl"
        style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
      >
        {bank.name}
      </h1>
    </div>
  );
}

function BrandButton({
  label,
  href,
  theme,
  variant = "solid",
}: {
  label: string;
  href: string;
  theme: WebsiteManifest["theme"];
  variant?: "solid" | "ghost";
}) {
  const radius =
    theme.button_style === "pill" ? 999 : theme.button_style === "square" ? 0 : theme.radius;
  const base = cn(
    "inline-flex items-center px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm",
  );
  if (variant === "ghost") {
    return (
      <a
        href={href}
        className={base}
        style={{
          color: theme.colors.primary,
          borderRadius: radius,
          border: `1px solid ${theme.colors.primary}55`,
        }}
      >
        {label}
      </a>
    );
  }
  return (
    <a
      href={href}
      className={base}
      style={{ backgroundColor: theme.colors.accent, color: "#fff", borderRadius: radius }}
    >
      {label}
    </a>
  );
}
