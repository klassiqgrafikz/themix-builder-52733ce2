import type { GeneratedPage, WebsiteManifest, HomepageFeatureCard } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Sparkles, ArrowRight, Landmark, Building2, Crown,
  Wallet, Globe, Lock, Zap, Users, BarChart3, PiggyBank, CreditCard, Repeat,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, ShieldCheck, Landmark, Building2, Crown,
  Wallet, Globe, Lock, Zap, Users, BarChart3, PiggyBank, CreditCard, Repeat, ArrowRight,
};

function IconByKey({ k, className }: { k: string; className?: string }) {
  const C = ICONS[k];
  if (!C) return <div className={className} />;
  return <C className={className} />;
}

function rf(field: { desktop: string; mobile: string } | undefined, fallback: string): { desktop: string; mobile: string } {
  return field ?? { desktop: fallback, mobile: fallback };
}

function Rtf({ field, fallback, className }: { field: { desktop: string; mobile: string } | undefined; fallback: string; className?: string }) {
  const f = rf(field, fallback);
  return (
    <span className={className}>
      <span className="hidden md:inline" style={{ whiteSpace: "pre-line" }}>{f.desktop}</span>
      <span className="inline md:hidden" style={{ whiteSpace: "pre-line" }}>{f.mobile}</span>
    </span>
  );
}

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
    portalHref: hasSession ? `/${bank.slug}/portal` : `/${bank.slug}/login`,
    portalLabel: hasSession ? "My portal" : "Customer login",
    registerHref: `/${bank.slug}/register`,
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
  const mc = manifest.homepage_content?.modern;
  const balCard = mc?.show_balance_card ?? true;

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
            <Rtf field={mc?.cta_secondary} fallback={actions.portalLabel} />
          </a>
          <a
            href={actions.registerHref}
            className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: theme.colors.accent }}
          >
            <Rtf field={mc?.cta_primary} fallback="Open account" /> <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-8 md:grid-cols-2 md:py-16">
        <div className="flex flex-col justify-center">
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: `${theme.colors.accent}22`, color: theme.colors.accent }}
          >
            <Sparkles className="h-3 w-3" /> <Rtf field={mc?.badge} fallback="Digital-first banking" />
          </span>
          <h1
            className="mt-5 text-4xl font-bold leading-tight sm:text-5xl"
            style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
          >
            <Rtf field={mc?.hero_title} fallback="Banking that keeps up\nwith your day." />
          </h1>
          <p className="mt-5 max-w-md text-base opacity-80">
            <Rtf
              field={mc?.hero_subtitle}
              fallback={`Open a ${bank.name} account in minutes. Instant transfers, real-time notifications and a portal designed around your money — not paperwork.`}
            />
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={actions.registerHref}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: theme.colors.accent }}
            >
              <Rtf field={mc?.cta_primary} fallback="Open an account" /> <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={actions.portalHref}
              className="rounded-full px-5 py-3 text-sm font-semibold"
              style={{
                color: theme.colors.primary,
                border: `1px solid ${theme.colors.primary}33`,
              }}
            >
              <Rtf field={mc?.cta_secondary} fallback={actions.portalLabel} />
            </a>
          </div>
        </div>

        {balCard && (
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
        )}
      </main>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-16 md:grid-cols-3">
        {(mc?.features ?? []).filter((f) => f.visible_desktop || f.visible_mobile).map((f) => (
          <div
            key={f.id}
            className={cn(
              "rounded-3xl p-6",
              !f.visible_desktop && "hidden md:hidden",
              !f.visible_mobile && "hidden",
            )}
            style={{ backgroundColor: surface, border: `1px solid ${theme.colors.primary}11` }}
          >
            <IconByKey k={f.icon_key} className="h-6 w-6" style={{ color: theme.colors.accent } as CSSProperties} />
            <div
              className="mt-3 text-base font-semibold"
              style={{ fontFamily: theme.typography.heading }}
            >
              <Rtf field={f.title} fallback="" />
            </div>
            <div className="mt-1 text-sm opacity-70">
              <Rtf field={f.description} fallback="" />
            </div>
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
  const cc = manifest.homepage_content?.corporate;

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
            <a href={actions.portalHref}><Rtf field={cc?.cta_secondary} fallback={actions.portalLabel} /></a>
            <a href={`/${bank.slug}/forgot`}>Forgot password</a>
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
            {["Personal", "Business", "Corporate", "Wealth", "About", "Contact"].map((l) => (
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
            <Rtf field={cc?.cta_primary} fallback="Open account" />
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
              <Rtf field={cc?.badge} fallback="A trusted banking partner since day one" />
            </div>
            <h1
              className="mt-3 text-4xl font-semibold leading-tight text-slate-900"
              style={{ fontFamily: theme.typography.heading }}
            >
              <Rtf field={cc?.hero_title} fallback="Enterprise banking, delivered with precision." />
            </h1>
            <p className="mt-4 max-w-2xl text-slate-600">
              <Rtf
                field={cc?.hero_subtitle}
                fallback={`${bank.name} provides commercial, corporate and institutional clients with the transaction banking, lending and treasury infrastructure they rely on.`}
              />
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href={actions.registerHref}
                className="rounded px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <Rtf field={cc?.cta_primary} fallback="Open a corporate account" />
              </a>
              <a
                href={actions.portalHref}
                className="rounded border px-5 py-2.5 text-sm font-semibold"
                style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
              >
                <Rtf field={cc?.cta_secondary} fallback={actions.portalLabel} />
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
        {(cc?.features ?? []).filter((f) => f.visible_desktop || f.visible_mobile).map((f) => (
          <div key={f.id} className={cn("border-l-2 bg-white p-5 shadow-sm", !f.visible_desktop && "hidden md:hidden", !f.visible_mobile && "hidden")} style={{ borderColor: theme.colors.accent }}>
            <div
              className="text-sm font-semibold text-slate-900"
              style={{ fontFamily: theme.typography.heading }}
            >
              <Rtf field={f.title} fallback="" />
            </div>
            <div className="mt-1 text-xs text-slate-600">
              <Rtf field={f.description} fallback="" />
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
  const pc = manifest.homepage_content?.premium;
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
              Online Banking
            </div>
          </div>
        </Link>
        <nav className="ml-auto hidden items-center gap-8 text-[13px] uppercase tracking-[0.18em] text-white/70 md:flex">
          <span>Wealth</span>
          <span>Advisory</span>
          <span>Concierge</span>
          <a href={actions.portalHref} className="hover:text-white">
            <Rtf field={pc?.cta_secondary} fallback={actions.portalLabel} />
          </a>
        </nav>
        <a
          href={actions.registerHref}
          className="ml-6 border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
          style={{ borderColor: "#c9a84c", color: "#c9a84c" }}
        >
          <Rtf field={pc?.cta_primary} fallback="Request an invitation" />
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-8 pb-16 pt-8 md:pt-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#c9a84c]">
            <Crown className="h-3.5 w-3.5" /> <Rtf field={pc?.badge} fallback="By invitation" />
          </div>
          <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl" style={heading}>
            <Rtf field={pc?.hero_title} fallback="Discreet wealth,\nattended personally." />
          </h1>
          <p className="mt-6 max-w-xl text-white/70">
            <Rtf
              field={pc?.hero_subtitle}
              fallback={`${bank.name} serves a limited number of principal families and institutions worldwide. Every relationship is anchored by a dedicated private banker and a house of advisors.`}
            />
          </p>
          <div className="mt-10 flex gap-4">
            <a
              href={actions.registerHref}
              className="px-8 py-3.5 text-xs uppercase tracking-[0.25em] text-black"
              style={{ backgroundColor: "#c9a84c" }}
            >
              <Rtf field={pc?.cta_primary} fallback="Begin an introduction" />
            </a>
            <a
              href={actions.portalHref}
              className="border px-8 py-3.5 text-xs uppercase tracking-[0.25em] text-white/85"
              style={{ borderColor: "rgba(255,255,255,0.25)" }}
            >
              <Rtf field={pc?.cta_secondary} fallback={actions.portalLabel} />
            </a>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {(pc?.features ?? []).filter((f) => f.visible_desktop || f.visible_mobile).map((f) => (
            <div
              key={f.id}
              className={cn("relative overflow-hidden border p-8", !f.visible_desktop && "hidden md:hidden", !f.visible_mobile && "hidden")}
              style={{
                borderColor: "rgba(201,168,76,0.35)",
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(201,168,76,0.05) 100%)",
              }}
            >
              <div className="text-xs uppercase tracking-[0.3em] text-[#c9a84c]">Service</div>
              <div className="mt-4 text-2xl" style={heading}>
                <Rtf field={f.title} fallback="" />
              </div>
              <div className="mt-3 text-sm text-white/70">
                <Rtf field={f.description} fallback="" />
              </div>
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
          © {new Date().getFullYear()} {bank.name} · Online Banking
        </div>
      </footer>
    </div>
  );
}

/* Preserve prior default export for any external caller (keep tree-shakable). */
export function _unusedShellPreserve(): ReactNode {
  return <div className={cn("hidden")} />;
}
