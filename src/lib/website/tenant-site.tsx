import type {
  GeneratedPage,
  NavItem,
  ResolvedModule,
  ResolvedProductRef,
  WebsiteManifest,
} from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Download,
  Landmark,
  MapPin,
  Newspaper,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";


const AUTH_KEYWORDS = ["auth", "login", "sign-in", "signin", "register", "signup", "sign-up"];
function isAuthModule(m: { key: string; label: string }): boolean {
  const hay = `${m.key} ${m.label}`.toLowerCase();
  return AUTH_KEYWORDS.some((k) => hay.includes(k));
}

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

function pageForModule(manifest: WebsiteManifest, moduleKey: string): GeneratedPage | null {
  return manifest.pages.find((p) => p.module_key === moduleKey && !p.system) ?? null;
}

/**
 * TenantSite renders the public banking website from a Website Manifest.
 */
export function TenantSite({
  manifest,
  page,
}: {
  manifest: WebsiteManifest;
  page: GeneratedPage;
}) {
  const { theme, brand, bank, navigation } = manifest;
  const isDark = theme.dark_mode;
  const bodyBg = isDark ? "#0b1120" : "#f8fafc";
  const surface = isDark ? "#111827" : "#ffffff";
  const text = isDark ? "#f1f5f9" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#475569";

  return (
    <div
      style={{
        backgroundColor: bodyBg,
        color: text,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
      }}
    >
      <TenantHeader
        manifest={manifest}
        navigation={navigation}
        activeSlug={page.slug}
        surface={surface}
        muted={muted}
      />
      <main className={page.slug === "home" ? "" : "mx-auto max-w-6xl px-4 py-10 sm:px-6"}>
        <PageBody manifest={manifest} page={page} muted={muted} surface={surface} />
      </main>
      <TenantFooter manifest={manifest} muted={muted} surface={surface} />
    </div>
  );
}

function TenantHeader({
  manifest,
  navigation,
  activeSlug,
  surface,
  muted,
}: {
  manifest: WebsiteManifest;
  navigation: NavItem[];
  activeSlug: string;
  surface: string;
  muted: string;
}) {
  const { theme, brand, bank } = manifest;
  const [open, setOpen] = useState(false);
  const hasSession = useHasSession(bank.slug);
  // Filter auth-ish items out of the nav (belt-and-braces; module cards do the same)
  const nav = navigation.filter((n) => !AUTH_KEYWORDS.some((k) => n.slug.includes(k)));

  return (
    <header
      style={{ backgroundColor: surface, borderBottom: `1px solid ${muted}22` }}
      className="sticky top-0 z-30 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/banks/$slug"
          params={{ slug: bank.slug }}
          className="flex items-center gap-2 font-semibold"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          {brand.logo_url ? (
            <img src={brand.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded text-white"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
              }}
            >
              {bank.name.slice(0, 1)}
            </span>
          )}
          <span className="truncate">{bank.name}</span>
        </Link>

        <nav className="ml-auto hidden gap-1 md:flex">
          {nav.map((n) => (
            <NavLink
              key={n.slug}
              slug={bank.slug}
              page={n.slug}
              label={n.label}
              active={activeSlug === n.slug}
              muted={muted}
              primary={theme.colors.primary}
            />
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
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

        <button
          type="button"
          aria-label="Toggle menu"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded md:hidden"
          style={{ color: theme.colors.primary, border: `1px solid ${muted}33` }}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {open && (
        <div className="md:hidden" style={{ borderTop: `1px solid ${muted}22` }}>
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {nav.map((n) => (
              <NavLink
                key={n.slug}
                slug={bank.slug}
                page={n.slug}
                label={n.label}
                active={activeSlug === n.slug}
                muted={muted}
                primary={theme.colors.primary}
                onClick={() => setOpen(false)}
              />
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              <BrandButton
                label={hasSession ? "My portal" : "Customer login"}
                href={hasSession ? `/banks/${bank.slug}/portal` : `/banks/${bank.slug}/login`}
                theme={theme}
                variant="ghost"
                alwaysVisible
              />
              <BrandButton
                label="Open account"
                href={`/banks/${bank.slug}/register`}
                theme={theme}
                alwaysVisible
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function NavLink({
  slug,
  page,
  label,
  active,
  muted,
  primary,
  onClick,
}: {
  slug: string;
  page: string;
  label: string;
  active: boolean;
  muted: string;
  primary: string;
  onClick?: () => void;
}) {
  const style = { color: active ? primary : muted } as const;
  const className = cn("rounded px-3 py-2 text-sm font-medium hover:opacity-80");
  if (page === "home") {
    return (
      <Link to="/banks/$slug" params={{ slug }} className={className} style={style} onClick={onClick}>
        {label}
      </Link>
    );
  }
  return (
    <Link
      to="/banks/$slug/$page"
      params={{ slug, page }}
      className={className}
      style={style}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

function BrandButton({
  label,
  href,
  theme,
  variant = "solid",
  alwaysVisible = false,
}: {
  label: string;
  href: string;
  theme: WebsiteManifest["theme"];
  variant?: "solid" | "ghost";
  alwaysVisible?: boolean;
}) {
  const radius =
    theme.button_style === "pill" ? 999 : theme.button_style === "square" ? 0 : theme.radius;
  const base = cn(
    "text-sm font-medium items-center px-4 py-2 transition",
    alwaysVisible ? "inline-flex" : "hidden sm:inline-flex",
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

function PageBody({
  manifest,
  page,
  muted,
  surface,
}: {
  manifest: WebsiteManifest;
  page: GeneratedPage;
  muted: string;
  surface: string;
}) {
  if (page.slug === "home") return <HomeSection manifest={manifest} muted={muted} surface={surface} />;
  return (
    <GenericSection
      manifest={manifest}
      title={page.title}
      moduleKey={page.module_key}
      surface={surface}
      muted={muted}
    />
  );
}

function HomeSection({
  manifest,
  muted,
  surface,
}: {
  manifest: WebsiteManifest;
  muted: string;
  surface: string;
}) {
  const { theme, brand, bank, modules } = manifest;
  const visibleModules = modules.filter((m) => !isAuthModule(m));

  return (
    <div className="space-y-16">
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p
              className="text-xs uppercase tracking-[0.2em] opacity-80"
              style={{ fontFamily: theme.typography.body }}
            >
              {bank.blueprint_category ?? "Banking"}
              {bank.country_code ? ` · ${bank.country_code}` : ""}
            </p>
            <h1
              className="mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl"
              style={{ fontFamily: theme.typography.heading }}
            >
              Banking, built for you at {bank.name}.
            </h1>
            <p className="mt-5 max-w-xl text-base opacity-90 sm:text-lg">
              Open an account in minutes, move money in {bank.currency ?? "your currency"}, and
              manage everything from one secure place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BrandButton
                label="Open an account"
                href={`/banks/${bank.slug}/register`}
                theme={theme}
                alwaysVisible
              />
              <a
                href={`/banks/${bank.slug}/login`}
                className="inline-flex items-center px-4 py-2 text-sm font-medium"
                style={{
                  borderRadius:
                    theme.button_style === "pill"
                      ? 999
                      : theme.button_style === "square"
                        ? 0
                        : theme.radius,
                  border: "1px solid rgba(255,255,255,0.6)",
                  color: "#fff",
                }}
              >
                Customer login
              </a>
            </div>
          </div>
          {brand.hero_image_url ? (
            <img
              src={brand.hero_image_url}
              alt=""
              className="mx-auto max-h-80 w-full rounded-2xl object-cover shadow-xl"
            />
          ) : (
            <div
              className="mx-auto h-56 w-full rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
            />
          )}
        </div>
      </section>

      {visibleModules.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-2xl font-semibold sm:text-3xl"
                style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
              >
                Everything you need from {bank.name}
              </h2>
              <p className="mt-1 text-sm" style={{ color: muted }}>
                Explore the services enabled for this bank.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleModules.map((m) => (
              <ModuleCard
                key={m.key}
                module={m}
                manifest={manifest}
                surface={surface}
                muted={muted}
              />
            ))}
          </div>
        </section>
      )}

      <ProductsSection manifest={manifest} muted={muted} surface={surface} />
      <ExchangeRatesSection manifest={manifest} muted={muted} surface={surface} />
      <NewsSection manifest={manifest} muted={muted} surface={surface} />
      <SecurityTipsSection manifest={manifest} muted={muted} surface={surface} />
      <MobileBankingSection manifest={manifest} muted={muted} surface={surface} />
      <BranchLocatorSection manifest={manifest} muted={muted} surface={surface} />

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="grid gap-6 rounded-3xl p-8 sm:p-12 md:grid-cols-[1.4fr_1fr] md:items-center"
          style={{
            backgroundColor: surface,
            border: `1px solid ${muted}22`,
            borderRadius: Math.max(theme.radius * 2, 16),
          }}
        >
          <div>
            <h3
              className="text-2xl font-semibold sm:text-3xl"
              style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
            >
              Ready to start banking with {bank.name}?
            </h3>
            <p className="mt-2 text-sm sm:text-base" style={{ color: muted }}>
              Opening an account takes just a few minutes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <BrandButton
              label="Open an account"
              href={`/banks/${bank.slug}/register`}
              theme={theme}
              alwaysVisible
            />
            <BrandButton
              label="Customer login"
              href={`/banks/${bank.slug}/login`}
              theme={theme}
              variant="ghost"
              alwaysVisible
            />
          </div>
        </div>
      </section>

    </div>
  );
}

function ModuleCard({
  module,
  manifest,
  surface,
  muted,
}: {
  module: ResolvedModule;
  manifest: WebsiteManifest;
  surface: string;
  muted: string;
}) {
  const { theme, bank } = manifest;
  const target = pageForModule(manifest, module.key);
  const cardStyle = {
    borderColor: `${muted}33`,
    backgroundColor: surface,
    borderRadius: Math.max(theme.radius, 12),
  };
  const inner = (
    <>
      <div className="text-xs uppercase tracking-wide" style={{ color: theme.colors.accent }}>
        {module.group}
      </div>
      <div
        className="mt-1 text-lg font-semibold"
        style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
      >
        {module.label}
      </div>
      {target && (
        <div className="mt-4 text-sm font-medium" style={{ color: theme.colors.primary }}>
          Learn more →
        </div>
      )}
    </>
  );
  if (!target) {
    return (
      <div className="rounded-2xl border p-5" style={cardStyle}>
        {inner}
      </div>
    );
  }
  return (
    <Link
      to="/banks/$slug/$page"
      params={{ slug: bank.slug, page: target.slug }}
      className="block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={cardStyle}
    >
      {inner}
    </Link>
  );
}

function GenericSection({
  manifest,
  title,
  moduleKey,
  surface,
  muted,
}: {
  manifest: WebsiteManifest;
  title: string;
  moduleKey: string | null;
  surface: string;
  muted: string;
}) {
  const { theme, bank } = manifest;
  const mod = moduleKey ? manifest.modules.find((m) => m.key === moduleKey) : null;
  return (
    <section>
      <p className="text-xs uppercase tracking-widest" style={{ color: theme.colors.accent }}>
        {mod ? mod.group : "General"}
      </p>
      <h1
        className="mt-2 text-3xl font-bold sm:text-4xl"
        style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
      >
        {title}
      </h1>
      <div
        className="mt-6 rounded-2xl border p-8"
        style={{
          borderColor: `${muted}33`,
          backgroundColor: surface,
          borderRadius: Math.max(theme.radius, 12),
        }}
      >
        <p className="text-base" style={{ color: muted }}>
          This is the <strong>{title}</strong> page for {bank.name}. It was generated from the
          bank's Website Manifest because
          {mod
            ? ` the ${mod.label} module is enabled.`
            : " it is part of every bank as a core page."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`/banks/${bank.slug}/register`}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white"
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius:
                theme.button_style === "pill"
                  ? 999
                  : theme.button_style === "square"
                    ? 0
                    : theme.radius,
            }}
          >
            Open an account
          </a>
          <a
            href={`/banks/${bank.slug}/login`}
            className="inline-flex items-center px-4 py-2 text-sm font-medium"
            style={{
              color: theme.colors.primary,
              border: `1px solid ${theme.colors.primary}55`,
              borderRadius:
                theme.button_style === "pill"
                  ? 999
                  : theme.button_style === "square"
                    ? 0
                    : theme.radius,
            }}
          >
            Customer login
          </a>
        </div>
      </div>
    </section>
  );
}

function TenantFooter({
  manifest,
  muted,
  surface,
}: {
  manifest: WebsiteManifest;
  muted: string;
  surface: string;
}) {
  const { theme, bank, brand, navigation } = manifest;
  const isDark = theme.dark_mode;
  const footerBg = isDark ? "#0a0f1e" : "#0f172a";
  const footerText = "#e2e8f0";
  const footerMuted = "#94a3b8";
  const links = navigation.filter((n) => n.slug !== "home").slice(0, 6);
  const contactEmail = `hello@${bank.slug}.themix.bank`;
  const contactPhone = "+1 (800) 555-0198";

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt=""
                  className="h-8 w-8 rounded object-contain"
                />
              ) : (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded text-white"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                  }}
                >
                  {bank.name.slice(0, 1)}
                </span>
              )}
              <span>{bank.name}</span>
            </div>
            <p className="mt-4 text-sm" style={{ color: footerMuted }}>
              Digital banking for everyone in {bank.country_code ?? "your region"}. Regulated
              and secure, backed by TheMixWeb infrastructure.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest">Explore</h4>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: footerMuted }}>
              {links.map((l) => (
                <li key={l.slug}>
                  <Link
                    to="/banks/$slug/$page"
                    params={{ slug: bank.slug, page: l.slug }}
                    className="hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={`/banks/${bank.slug}/register`} className="hover:underline">
                  Open an account
                </a>
              </li>
              <li>
                <a href={`/banks/${bank.slug}/login`} className="hover:underline">
                  Customer login
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest">Contact</h4>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: footerMuted }}>
              <li>Email: {contactEmail}</li>
              <li>Phone: {contactPhone}</li>
              <li>Support: 24/7 in-app chat</li>
              <li>Media: press@{bank.slug}.themix.bank</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest">Head office</h4>
            <address className="mt-4 not-italic text-sm" style={{ color: footerMuted }}>
              1 Financial Plaza
              <br />
              {bank.country_code === "US"
                ? "New York, NY 10005"
                : bank.country_code === "GB"
                  ? "London EC2R 8AH"
                  : "Global HQ"}
              <br />
              {bank.country_code ?? "Worldwide"}
            </address>
          </div>
        </div>

        <div
          className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "rgba(148,163,184,0.2)", color: footerMuted }}
        >
          <span>
            © {new Date().getFullYear()} {bank.name}. All rights reserved. Powered by
            TheMixWeb.
          </span>
          <span>
            {bank.country_code
              ? `Licensed for operations in ${bank.country_code}.`
              : "Licensed and regulated."}
          </span>
        </div>
      </div>
    </footer>
  );
}

// ---------- extra homepage sections ----------

type SectionProps = {
  manifest: WebsiteManifest;
  muted: string;
  surface: string;
};

function SectionHeader({
  manifest,
  eyebrow,
  title,
  subtitle,
  muted,
}: {
  manifest: WebsiteManifest;
  eyebrow: string;
  title: string;
  subtitle?: string;
  muted: string;
}) {
  const { theme } = manifest;
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: theme.colors.accent }}>
        {eyebrow}
      </p>
      <h2
        className="mt-2 text-2xl font-semibold sm:text-3xl"
        style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm" style={{ color: muted }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ProductsSection({ manifest, muted, surface }: SectionProps) {
  const { theme, products } = manifest;
  const visible = (products ?? [])
    .filter((p) => p.visibility === "public" && p.status === "active")
    .slice(0, 6);
  if (visible.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <SectionHeader
        manifest={manifest}
        eyebrow="Products & Services"
        title="Banking products designed around your life"
        subtitle="Explore accounts, cards, loans, and wealth services available at this bank."
        muted={muted}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p: ResolvedProductRef) => (
          <div
            key={p.code}
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: surface,
              borderColor: `${muted}33`,
              borderRadius: Math.max(theme.radius, 12),
            }}
          >
            <div
              className="text-xs uppercase tracking-wide"
              style={{ color: theme.colors.accent }}
            >
              {p.category_slug.replace(/-/g, " ")}
            </div>
            <div
              className="mt-1 text-lg font-semibold"
              style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
            >
              {p.name}
            </div>
            {p.description && (
              <p className="mt-2 text-sm" style={{ color: muted }}>
                {p.description}
              </p>
            )}
            <div
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: theme.colors.primary }}
            >
              Learn more <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExchangeRatesSection({ manifest, muted, surface }: SectionProps) {
  const { theme, bank } = manifest;
  const base = (bank.currency ?? "USD").toUpperCase();
  const targets = ["USD", "EUR", "GBP", "NGN", "JPY", "CAD"].filter((c) => c !== base).slice(0, 5);
  // Deterministic pseudo-rates so preview looks stable across renders.
  const seed = [...bank.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rateFor = (target: string) => {
    const t = [...target].reduce((a, c) => a + c.charCodeAt(0), 0);
    const value = ((seed * 31 + t) % 10000) / 100 + 0.5;
    const change = (((seed + t) % 400) - 200) / 100;
    return { value, change };
  };
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <SectionHeader
        manifest={manifest}
        eyebrow="Markets"
        title="Live exchange rates"
        subtitle={`Indicative rates for 1 ${base}. Actual rates apply at the point of transaction.`}
        muted={muted}
      />
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: surface, borderColor: `${muted}33` }}
      >
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: `${theme.colors.primary}12` }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Pair</th>
              <th className="px-4 py-3 font-semibold">Rate</th>
              <th className="px-4 py-3 font-semibold">24h</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => {
              const r = rateFor(t);
              const up = r.change >= 0;
              return (
                <tr key={t} className="border-t" style={{ borderColor: `${muted}22` }}>
                  <td className="px-4 py-3 font-medium">
                    {base}/{t}
                  </td>
                  <td className="px-4 py-3 font-mono">{r.value.toFixed(4)}</td>
                  <td
                    className="px-4 py-3 font-medium"
                    style={{ color: up ? "#16a34a" : "#dc2626" }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp
                        className={cn("h-4 w-4", !up && "rotate-180")}
                      />
                      {up ? "+" : ""}
                      {r.change.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewsSection({ manifest, muted, surface }: SectionProps) {
  const { theme, bank } = manifest;
  const stories = [
    {
      tag: "Announcement",
      title: `${bank.name} launches instant transfers across the platform`,
      body: "Customers can now send money between accounts in seconds, at no extra cost.",
    },
    {
      tag: "Security",
      title: "New device verification is rolling out this month",
      body: "Every new sign-in from an unknown device now requires an extra confirmation step.",
    },
    {
      tag: "Community",
      title: `${bank.name} partners with local businesses for cashback rewards`,
      body: "Spend with participating merchants and earn cashback directly to your account.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <SectionHeader
        manifest={manifest}
        eyebrow="Latest news"
        title="What's new at the bank"
        muted={muted}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {stories.map((s) => (
          <article
            key={s.title}
            className="flex flex-col rounded-2xl border p-5"
            style={{
              backgroundColor: surface,
              borderColor: `${muted}33`,
              borderRadius: Math.max(theme.radius, 12),
            }}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
              <Newspaper className="h-4 w-4" style={{ color: theme.colors.accent }} />
              <span style={{ color: theme.colors.accent }}>{s.tag}</span>
            </div>
            <h3
              className="mt-2 text-base font-semibold"
              style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
            >
              {s.title}
            </h3>
            <p className="mt-2 flex-1 text-sm" style={{ color: muted }}>
              {s.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SecurityTipsSection({ manifest, muted, surface }: SectionProps) {
  const { theme } = manifest;
  const tips = [
    {
      title: "Never share your PIN or password",
      body: "Our staff will never ask for your password or one-time codes.",
    },
    {
      title: "Enable two-factor authentication",
      body: "Add an extra layer of security to every sign-in on your account.",
    },
    {
      title: "Verify sender details",
      body: "Always double-check account details before sending money to a new beneficiary.",
    },
    {
      title: "Report suspicious activity",
      body: "Contact support immediately if you spot a transaction you don't recognise.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <SectionHeader
        manifest={manifest}
        eyebrow="Security"
        title="Stay safe with these tips"
        muted={muted}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {tips.map((t) => (
          <div
            key={t.title}
            className="flex items-start gap-3 rounded-2xl border p-5"
            style={{
              backgroundColor: surface,
              borderColor: `${muted}33`,
              borderRadius: Math.max(theme.radius, 12),
            }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${theme.colors.primary}15`,
                color: theme.colors.primary,
              }}
            >
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div
                className="text-sm font-semibold"
                style={{
                  fontFamily: theme.typography.heading,
                  color: theme.colors.primary,
                }}
              >
                {t.title}
              </div>
              <p className="mt-1 text-sm" style={{ color: muted }}>
                {t.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobileBankingSection({ manifest, muted, surface }: SectionProps) {
  const { theme, bank } = manifest;
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div
        className="grid gap-8 rounded-3xl p-8 sm:p-12 md:grid-cols-[1.2fr_1fr] md:items-center"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
          color: "#fff",
          borderRadius: Math.max(theme.radius * 2, 20),
        }}
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-widest">
            <Smartphone className="h-4 w-4" />
            Mobile banking
          </div>
          <h2
            className="mt-4 text-2xl font-semibold sm:text-3xl"
            style={{ fontFamily: theme.typography.heading }}
          >
            Bank on the go with the {bank.name} app
          </h2>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            Check balances, send money, freeze cards, and reach support — all from your phone.
            Available for iOS and Android.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              <Download className="h-4 w-4" />
              App Store
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/20"
            >
              <Download className="h-4 w-4" />
              Google Play
            </a>
          </div>
        </div>
        <div className="flex justify-center">
          <div
            className="grid h-64 w-40 place-items-center rounded-[2.2rem] border-4 border-white/20 bg-white/10 backdrop-blur"
            aria-hidden
          >
            <Smartphone className="h-12 w-12 opacity-80" />
          </div>
        </div>
      </div>
      {/* Surface color is intentionally unused in this gradient section. */}
      <span className="sr-only" data-surface={surface}></span>
    </section>
  );
}

function BranchLocatorSection({ manifest, muted, surface }: SectionProps) {
  const { theme, bank } = manifest;
  const country = bank.country_code ?? "your area";
  const branches = [
    { name: "Downtown Branch", city: "Central", hours: "Mon–Fri · 9:00–17:00" },
    { name: "Airport ATM", city: "Terminal 2", hours: "24/7 self-service" },
    { name: "Riverside Branch", city: "North District", hours: "Mon–Sat · 10:00–18:00" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <SectionHeader
        manifest={manifest}
        eyebrow="Locations"
        title={`Branches & ATMs in ${country}`}
        subtitle="Find the nearest branch or ATM — full locator is available inside the customer portal."
        muted={muted}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {branches.map((b) => (
          <div
            key={b.name}
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: surface,
              borderColor: `${muted}33`,
              borderRadius: Math.max(theme.radius, 12),
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${theme.colors.primary}15`,
                  color: theme.colors.primary,
                }}
              >
                <Building2 className="h-5 w-5" />
              </span>
              <div
                className="text-base font-semibold"
                style={{
                  fontFamily: theme.typography.heading,
                  color: theme.colors.primary,
                }}
              >
                {b.name}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: muted }}>
              <MapPin className="h-4 w-4" />
              {b.city}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: muted }}>
              <Landmark className="h-4 w-4" />
              {b.hours}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


