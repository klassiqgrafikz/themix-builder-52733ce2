import type { GeneratedPage, NavItem, WebsiteManifest } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * TenantSite renders the public banking website from a Website Manifest.
 * It is deliberately independent from the admin UI — no admin components,
 * no data mutations, purely theme-driven presentation.
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <PageBody manifest={manifest} page={page} muted={muted} surface={surface} />
      </main>
      <TenantFooter bankName={bank.name} muted={muted} brand={brand} />
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
  return (
    <header
      style={{ backgroundColor: surface, borderBottom: `1px solid ${muted}22` }}
      className="sticky top-0 z-30 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
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
          <span>{bank.name}</span>
        </Link>
        <nav className="ml-auto hidden gap-1 md:flex">
          {navigation.map((n) =>
            n.slug === "home" ? (
              <NavLink
                key={n.slug}
                slug={bank.slug}
                page="home"
                label={n.label}
                active={activeSlug === n.slug}
                muted={muted}
                primary={theme.colors.primary}
              />
            ) : (
              <NavLink
                key={n.slug}
                slug={bank.slug}
                page={n.slug}
                label={n.label}
                active={activeSlug === n.slug}
                muted={muted}
                primary={theme.colors.primary}
              />
            ),
          )}
        </nav>
        <BrandButton
          label="Sign in"
          href={`/banks/${bank.slug}/login`}
          theme={theme}
          variant="ghost"
        />
        <BrandButton label="Open account" href={`/banks/${bank.slug}/register`} theme={theme} />
      </div>
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
}: {
  slug: string;
  page: string;
  label: string;
  active: boolean;
  muted: string;
  primary: string;
}) {
  const style = { color: active ? primary : muted } as const;
  if (page === "home") {
    return (
      <Link
        to="/banks/$slug"
        params={{ slug }}
        className={cn("rounded px-3 py-2 text-sm font-medium hover:opacity-80")}
        style={style}
      >
        {label}
      </Link>
    );
  }
  return (
    <Link
      to="/banks/$slug/$page"
      params={{ slug, page }}
      className={cn("rounded px-3 py-2 text-sm font-medium hover:opacity-80")}
      style={style}
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
}: {
  label: string;
  href: string;
  theme: WebsiteManifest["theme"];
  variant?: "solid" | "ghost";
}) {
  const radius =
    theme.button_style === "pill" ? 999 : theme.button_style === "square" ? 0 : theme.radius;
  const base = "hidden text-sm font-medium sm:inline-flex items-center px-4 py-2";
  if (variant === "ghost") {
    return (
      <a href={href} className={base} style={{ color: theme.colors.primary, borderRadius: radius }}>
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
  return (
    <div className="space-y-12">
      <section
        className="overflow-hidden rounded-3xl p-8 text-white sm:p-12"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
          borderRadius: Math.max(theme.radius * 2, 16),
        }}
      >
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p
              className="text-sm uppercase tracking-widest opacity-80"
              style={{ fontFamily: theme.typography.body }}
            >
              {bank.blueprint_category ?? "Banking"} · {bank.country_code ?? ""}
            </p>
            <h1
              className="mt-3 text-4xl font-bold sm:text-5xl"
              style={{ fontFamily: theme.typography.heading }}
            >
              Banking, built for you at {bank.name}.
            </h1>
            <p className="mt-4 max-w-xl text-base opacity-90">
              Open an account in minutes, move money in {bank.currency ?? "your currency"}, and
              manage everything from one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BrandButton label="Open account" href={`/banks/${bank.slug}/register`} theme={theme} />
              <BrandButton label="Sign in" href={`/banks/${bank.slug}/login`} theme={theme} variant="ghost" />
            </div>
          </div>
          {brand.hero_image_url ? (
            <img
              src={brand.hero_image_url}
              alt=""
              className="mx-auto max-h-64 w-full rounded-2xl object-cover"
            />
          ) : (
            <div
              className="mx-auto h-48 w-full rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
            />
          )}
        </div>
      </section>

      {modules.length > 0 && (
        <section>
          <h2
            className="text-2xl font-semibold"
            style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
          >
            What you can do with {bank.name}
          </h2>
          <p className="mt-1 text-sm" style={{ color: muted }}>
            Only the modules enabled for this bank are shown.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <div
                key={m.key}
                className="rounded-2xl border p-5"
                style={{
                  borderColor: `${muted}33`,
                  backgroundColor: surface,
                  borderRadius: Math.max(theme.radius, 12),
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide"
                  style={{ color: theme.colors.accent }}
                >
                  {m.group}
                </div>
                <div
                  className="mt-1 text-lg font-semibold"
                  style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
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
        <p className="mt-3 text-sm" style={{ color: muted }}>
          The banking business logic for this section will be wired in during a later phase — this
          page is served today by the Website Generator so external visitors can see the fully
          themed, module-driven site.
        </p>
      </div>
    </section>
  );
}

function TenantFooter({
  bankName,
  muted,
  brand,
}: {
  bankName: string;
  muted: string;
  brand: WebsiteManifest["brand"];
}) {
  return (
    <footer className="border-t py-8" style={{ borderColor: `${muted}22` }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span style={{ color: muted }}>
          © {new Date().getFullYear()} {bankName}. Powered by TheMixWeb.
        </span>
        <span style={{ color: muted }}>
          {brand.favicon_url ? "Icons customised" : "Default icons"}
        </span>
      </div>
    </footer>
  );
}
