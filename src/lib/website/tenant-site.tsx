import type { GeneratedPage, WebsiteManifest } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, ArrowRight, Landmark, Building2, Crown } from "lucide-react";

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

export function TenantSite({
  manifest,
  page,
}: {
  manifest: WebsiteManifest;
  page: GeneratedPage;
}) {
  void page;
  const variant = manifest.bank.template_variant ?? "modern";
  if (variant === "corporate") return <CorporateGateway manifest={manifest} />;
  if (variant === "premium") return <PremiumGateway manifest={manifest} />;
  return <ModernGateway manifest={manifest} />;
}

/* ---------- shared bits ---------- */

function BrandLogo({ manifest, size = 44 }: { manifest: WebsiteManifest; size?: number }) {
  const { brand, bank, theme } = manifest;
  if (brand.login_logo_url) {
    return (
      <img
        src={brand.login_logo_url}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-xl object-contain"
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
        fontFamily: theme.typography.heading,
      }}
      className="flex items-center justify-center rounded-xl font-bold text-white"
    >
      {bank.name.slice(0, 1)}
    </span>
  );
}

function useActions(bank: WebsiteManifest["bank"]) {
  const hasSession = useHasSession(bank.slug);
  return {
    portalHref: hasSession ? `/banks/${bank.slug}/portal` : `/banks/${bank.slug}/login`,
    portalLabel: hasSession ? "My portal" : "Customer login",
    registerHref: `/banks/${bank.slug}/register`,
  };
}

/* ================================================================
 * MODERN — fintech, rounded, big balance card hero, minimal chrome
 * ================================================================ */
function ModernGateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank } = manifest;
  const actions = useActions(bank);
  const bg = theme.dark_mode ? "#0b1120" : "#f8fafc";
  const text = theme.dark_mode ? "#f1f5f9" : "#0f172a";
  const surface = theme.dark_mode ? "#111827" : "#ffffff";

  return (
    <div
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
      }}
    >
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
        <Link to="/$slug" params={{ slug: bank.slug }} className="flex items-center gap-3">
          <BrandLogo manifest={manifest} size={40} />
          <span
            className="text-lg font-semibold"
            style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
          >
            {bank.name}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={actions.portalHref}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ color: theme.colors.primary, border: `1px solid ${theme.colors.primary}33` }}
          >
            {actions.portalLabel}
          </a>
          <a
            href={actions.registerHref}
            className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Open account <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-8 md:grid-cols-2 md:py-16">
        <div className="flex flex-col justify-center">
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: `${theme.colors.accent}22`, color: theme.colors.accent }}
          >
            <Sparkles className="h-3 w-3" /> Digital-first banking
          </span>
          <h1
            className="mt-5 text-4xl font-bold leading-tight sm:text-5xl"
            style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
          >
            Banking that keeps up
            <br />
            with your day.
          </h1>
          <p className="mt-5 max-w-md text-base opacity-80">
            Open a {bank.name} account in minutes. Instant transfers, real-time notifications and a
            portal designed around your money — not paperwork.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={actions.registerHref}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: theme.colors.accent }}
            >
              Open an account <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={actions.portalHref}
              className="rounded-full px-5 py-3 text-sm font-semibold"
              style={{
                color: theme.colors.primary,
                border: `1px solid ${theme.colors.primary}33`,
              }}
            >
              {actions.portalLabel}
            </a>
          </div>
        </div>

        {/* Big balance card mock */}
        <div className="flex items-center justify-center">
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            }}
          >
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>Available balance</span>
              <span>{bank.currency ?? "USD"}</span>
            </div>
            <div
              className="mt-3 text-4xl font-bold"
              style={{ fontFamily: theme.typography.heading }}
            >
              {(12480.55).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
              {["Send", "Request", "Top up"].map((a) => (
                <div key={a} className="rounded-2xl bg-white/15 py-3 backdrop-blur">
                  {a}
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              {["Salary", "Coffee shop", "Subscription"].map((t, i) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className="opacity-80">{t}</span>
                  <span>{i === 0 ? "+1,240.00" : i === 1 ? "-4.20" : "-9.99"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-16 md:grid-cols-3">
        {[
          { icon: Sparkles, t: "Instant onboarding", d: "Sign up online, no branch visit." },
          { icon: ShieldCheck, t: "Bank-grade security", d: "Encrypted end-to-end, 24/7 monitored." },
          { icon: Landmark, t: "Real accounts", d: "Full domestic and international rails." },
        ].map(({ icon: Icon, t, d }) => (
          <div
            key={t}
            className="rounded-3xl p-6"
            style={{ backgroundColor: surface, border: `1px solid ${theme.colors.primary}11` }}
          >
            <Icon className="h-6 w-6" style={{ color: theme.colors.accent }} />
            <div
              className="mt-3 text-base font-semibold"
              style={{ fontFamily: theme.typography.heading }}
            >
              {t}
            </div>
            <div className="mt-1 text-sm opacity-70">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ================================================================
 * CORPORATE — formal top nav, dense information layout, tabular
 * ================================================================ */
function CorporateGateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank } = manifest;
  const actions = useActions(bank);

  const navLinks = ["Personal", "Business", "Corporate", "Wealth", "About", "Contact"];

  return (
    <div
      style={{
        backgroundColor: "#f4f6fa",
        color: "#0f172a",
        fontFamily: theme.typography.body,
        minHeight: "100vh",
      }}
    >
      {/* Utility bar */}
      <div
        className="text-xs text-white"
        style={{ backgroundColor: theme.colors.primary }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-1.5">
          <span className="opacity-80">
            {bank.country_code ?? "GLOBAL"} · {bank.currency ?? "USD"} · Est. corporate services
          </span>
          <div className="flex items-center gap-4 opacity-90">
            <a href={actions.portalHref}>{actions.portalLabel}</a>
            <a href={`/banks/${bank.slug}/forgot`}>Forgot password</a>
            <span>Rates &amp; fees</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-5">
          <Link to="/$slug" params={{ slug: bank.slug }} className="flex items-center gap-3">
            <BrandLogo manifest={manifest} size={44} />
            <div>
              <div
                className="text-xl font-semibold"
                style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
              >
                {bank.name}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500">
                Corporate &amp; Institutional
              </div>
            </div>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
            {navLinks.map((l) => (
              <span key={l} className="hover:text-slate-900">
                {l}
              </span>
            ))}
          </nav>
          <a
            href={actions.registerHref}
            className="rounded px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Open account
          </a>
        </div>
      </header>

      {/* Hero band */}
      <section
        className="border-b"
        style={{
          background: `linear-gradient(180deg, ${theme.colors.primary}0d 0%, transparent 100%)`,
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              A trusted banking partner since day one
            </div>
            <h1
              className="mt-3 text-4xl font-semibold leading-tight text-slate-900"
              style={{ fontFamily: theme.typography.heading }}
            >
              Enterprise banking, delivered with precision.
            </h1>
            <p className="mt-4 max-w-2xl text-slate-600">
              {bank.name} provides commercial, corporate and institutional clients with the
              transaction banking, lending and treasury infrastructure they rely on.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href={actions.registerHref}
                className="rounded px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Open a corporate account
              </a>
              <a
                href={actions.portalHref}
                className="rounded border px-5 py-2.5 text-sm font-semibold"
                style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
              >
                {actions.portalLabel}
              </a>
            </div>
          </div>
          <div className="rounded border bg-white p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Building2 className="h-4 w-4" style={{ color: theme.colors.primary }} />
              Today's indicative rates
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y">
                {[
                  ["Prime lending", "8.25%"],
                  ["Savings — 12m", "4.10%"],
                  ["FX (USD/EUR)", "1.0842"],
                  ["Treasury bill 91d", "5.05%"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2 text-slate-600">{k}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-12 md:grid-cols-4">
        {[
          "Transaction Banking",
          "Corporate Lending",
          "Treasury &amp; FX",
          "Trade Finance",
        ].map((t) => (
          <div key={t} className="border-l-2 bg-white p-5 shadow-sm" style={{ borderColor: theme.colors.accent }}>
            <div
              className="text-sm font-semibold text-slate-900"
              style={{ fontFamily: theme.typography.heading }}
              dangerouslySetInnerHTML={{ __html: t }}
            />
            <div className="mt-1 text-xs text-slate-600">
              Purpose-built services for enterprise clients operating across multiple jurisdictions.
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} {bank.name}. Regulated by the applicable financial authority.
        </div>
      </footer>
    </div>
  );
}

/* ================================================================
 * PREMIUM — dark executive, serif display, luxury card treatment
 * ================================================================ */
function PremiumGateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank } = manifest;
  const actions = useActions(bank);
  const heading: CSSProperties = {
    fontFamily: `'Cormorant Garamond', 'Playfair Display', ${theme.typography.heading}, serif`,
    letterSpacing: "-0.01em",
  };

  return (
    <div
      style={{
        backgroundColor: "#0a0a0f",
        color: "#f5f2ea",
        fontFamily: theme.typography.body,
        minHeight: "100vh",
        backgroundImage:
          "radial-gradient(1200px 600px at 80% -10%, rgba(201,168,76,0.10), transparent 60%)",
      }}
    >
      <header className="mx-auto flex max-w-6xl items-center px-8 py-6">
        <Link to="/$slug" params={{ slug: bank.slug }} className="flex items-center gap-3">
          <BrandLogo manifest={manifest} size={40} />
          <div>
            <div className="text-lg" style={heading}>
              {bank.name}
            </div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#c9a84c]">
              Private Banking
            </div>
          </div>
        </Link>
        <nav className="ml-auto hidden items-center gap-8 text-[13px] uppercase tracking-[0.18em] text-white/70 md:flex">
          <span>Wealth</span>
          <span>Advisory</span>
          <span>Concierge</span>
          <a href={actions.portalHref} className="hover:text-white">
            {actions.portalLabel}
          </a>
        </nav>
        <a
          href={actions.registerHref}
          className="ml-6 border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
          style={{ borderColor: "#c9a84c", color: "#c9a84c" }}
        >
          Request an invitation
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-8 pb-16 pt-8 md:pt-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#c9a84c]">
            <Crown className="h-3.5 w-3.5" /> By invitation
          </div>
          <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl" style={heading}>
            Discreet wealth,
            <br />
            attended personally.
          </h1>
          <p className="mt-6 max-w-xl text-white/70">
            {bank.name} serves a limited number of principal families and institutions worldwide.
            Every relationship is anchored by a dedicated private banker and a house of advisors.
          </p>
          <div className="mt-10 flex gap-4">
            <a
              href={actions.registerHref}
              className="px-8 py-3.5 text-xs uppercase tracking-[0.25em] text-black"
              style={{ backgroundColor: "#c9a84c" }}
            >
              Begin an introduction
            </a>
            <a
              href={actions.portalHref}
              className="border px-8 py-3.5 text-xs uppercase tracking-[0.25em] text-white/85"
              style={{ borderColor: "rgba(255,255,255,0.25)" }}
            >
              {actions.portalLabel}
            </a>
          </div>
        </div>

        {/* Luxury card row */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { t: "Private Reserve", d: "A discretionary mandate, actively managed by our house." },
            { t: "Global Custody", d: "Multi-jurisdiction custody with cross-border reporting." },
            { t: "Concierge Desk", d: "Travel, aviation, art and lifestyle at every hour." },
          ].map((c) => (
            <div
              key={c.t}
              className="relative overflow-hidden border p-8"
              style={{
                borderColor: "rgba(201,168,76,0.35)",
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(201,168,76,0.05) 100%)",
              }}
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[#c9a84c]">Service</div>
              <div className="mt-4 text-2xl" style={heading}>
                {c.t}
              </div>
              <div className="mt-3 text-sm text-white/70">{c.d}</div>
              <div
                className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
                style={{ backgroundColor: "#c9a84c" }}
              />
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-8 py-6 text-[11px] uppercase tracking-[0.25em] text-white/40">
          © {new Date().getFullYear()} {bank.name} · Private Banking
        </div>
      </footer>
    </div>
  );
}

/* Preserve prior default export for any external caller (keep tree-shakable). */
export function _unusedShellPreserve(): ReactNode {
  return <div className={cn("hidden")} />;
}
