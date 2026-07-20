import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CustomerRestriction } from "./restrictions.functions";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerProfile } from "./types";
import { logoutCustomer } from "./customer.functions";
import { isNavEnabled, activePathToNavKey, ModuleNotEnabled } from "./product-gating";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Wallet,
  Send,
  Users,
  ListOrdered,
  CreditCard,
  FileText,
  LifeBuoy,
  ShieldCheck,
  User,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { I18nProvider, useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

type NavEntry = {
  key: string;
  tKey: TranslationKey;
  path: string;
  icon: LucideIcon;
};

const NAV: NavEntry[] = [
  { key: "dashboard", tKey: "nav.dashboard", path: "", icon: LayoutDashboard },
  { key: "accounts", tKey: "nav.accounts", path: "/accounts", icon: Wallet },
  { key: "transfer", tKey: "nav.transfer", path: "/transfer", icon: Send },
  { key: "beneficiaries", tKey: "nav.beneficiaries", path: "/beneficiaries", icon: Users },
  { key: "transactions", tKey: "nav.transactions", path: "/transactions", icon: ListOrdered },
  { key: "cards", tKey: "nav.cards", path: "/cards", icon: CreditCard },
  { key: "statements", tKey: "nav.statements", path: "/statements", icon: FileText },
  { key: "support", tKey: "nav.support", path: "/support", icon: LifeBuoy },
  { key: "security", tKey: "nav.security", path: "/security", icon: ShieldCheck },
  { key: "profile", tKey: "nav.profile", path: "/profile", icon: User },
];

function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
  g = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
  b = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function SidebarBody({
  manifest,
  customer,
  activePath,
  slug,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  manifest: WebsiteManifest;
  customer: CustomerProfile;
  activePath: string;
  slug: string;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const theme = manifest.theme;
  const t = useT();
  const nav = NAV.filter((n) => isNavEnabled(manifest, n.key));
  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: `linear-gradient(180deg, var(--tenant-deep) 0%, var(--tenant-dark) 100%)`,
        color: "#e2e8f0",
      }}
    >
      <div className="px-6 pb-6 pt-7">
        <Link
          to="/$slug/portal"
          params={{ slug }}
          onClick={onNavigate}
          className="flex items-center gap-3"
        >
          {manifest.brand.dashboard_logo_url ? (
            <img
              src={manifest.brand.dashboard_logo_url}
              alt=""
              className="h-11 w-11 rounded-xl bg-white/10 object-contain p-1.5 ring-1 ring-white/15"
            />
          ) : (
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white ring-1 ring-white/15"
              style={{
                background: `linear-gradient(135deg, var(--tenant-primary), var(--tenant-accent))`,
              }}
            >
              {manifest.bank.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <div
              className="truncate text-[15px] font-semibold text-white"
              style={{ fontFamily: theme.typography.heading }}
            >
              {manifest.bank.name}
            </div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
              {t("shell.online_banking")}
            </div>
          </div>
        </Link>
      </div>

      <div className="mx-6 mb-4 h-px bg-white/10" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-4">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = activePath === n.path;
          return (
            <Link
              key={n.key}
              to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
              params={{ slug }}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors"
              style={{
                backgroundColor: active ? "rgba(255,255,255,0.10)" : "transparent",
                color: active ? "#ffffff" : "rgba(226,232,240,0.75)",
                fontWeight: active ? 600 : 500,
                boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : undefined,
              }}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{t(n.tKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 px-1 text-xs text-white/60">
          <div className="truncate font-medium text-white/85">
            {customer.first_name} {customer.last_name}
          </div>
          <div className="truncate">{customer.customer_number}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? t("shell.logging_out") : t("shell.logout")}
        </button>
      </div>
    </div>
  );
}

type PortalShellProps = {
  manifest: WebsiteManifest;
  customer: CustomerProfile;
  activePath: string;
  restrictions?: CustomerRestriction[];
  children: ReactNode;
};

export function PortalShell(props: PortalShellProps) {
  const { manifest } = props;
  return (
    <I18nProvider
      language={manifest?.bank?.language}
      currency={manifest?.bank?.currency}
      timezone={manifest?.bank?.timezone}
    >
      <PortalShellInner {...props} />
    </I18nProvider>
  );
}

function PortalShellInner({
  manifest,
  customer,
  activePath,
  restrictions = [],
  children,
}: PortalShellProps) {
  const t = useT();
  const theme = manifest.theme;
  const primary = theme.colors.primary || "#061938";
  const tenantDark = shade(primary, 0.55);
  const tenantDeep = shade(primary, 0.7);
  const variant = manifest.bank.template_variant ?? "modern";
  const rawStyle = (manifest as unknown as { dashboard_style?: string; brand?: { dashboard_style?: string } })
    .dashboard_style ??
    (manifest as unknown as { brand?: { dashboard_style?: string } }).brand?.dashboard_style;
  const dashboardLayout: "classic" | "modern" | "minimal" | "premium" =
    rawStyle === "modern" ? "modern" :
    rawStyle === "minimal" ? "minimal" :
    rawStyle === "premium" || rawStyle === "premium_card" ? "premium" :
    "classic";

  const slug = manifest.bank.slug;
  const navigate = useNavigate();
  const doLogout = useServerFn(logoutCustomer);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const key = `portal:last:${slug}`;
      if (activePath && activePath !== "") localStorage.setItem(key, activePath);
    } catch { /* ignore */ }
  }, [activePath, slug]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [activePath]);

  const logoutMut = useMutation({
    mutationFn: () => doLogout({ data: { slug } }),
    onSuccess: () => {
      toast.success(t("shell.signed_out"));
      navigate({ to: "/$slug/login", params: { slug } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Logout failed"),
  });

  const cssVars = {
    "--tenant-primary": primary,
    "--tenant-accent": theme.colors.accent,
    "--tenant-dark": tenantDark,
    "--tenant-deep": tenantDeep,
  } as CSSProperties;

  const nav = NAV.filter((n) => isNavEnabled(manifest, n.key));
  const activeLabel = (() => { const n = nav.find((x) => x.path === activePath); return n ? t(n.tKey) : t("nav.dashboard"); })();

  const navKey = activePathToNavKey(activePath);
  const gated = navKey !== null && !isNavEnabled(manifest, navKey);

  const content = (
    <RestrictionsContext.Provider value={restrictions}>
      <RestrictionBanner restrictions={restrictions} />
      {gated ? (
        <ModuleNotEnabled manifest={manifest} slug={slug} navKey={navKey} />
      ) : (
        children
      )}
    </RestrictionsContext.Provider>
  );

  if (variant === "corporate") {
    return (
      <div
        style={{
          ...cssVars,
          fontFamily: theme.typography.body,
          minHeight: "100vh",
          backgroundColor: "#f1f5f9",
          color: "#0f172a",
        }}
        className="flex w-full flex-col" data-layout={dashboardLayout}
      >
        <div className="text-white" style={{ backgroundColor: primary }}>
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-2 text-xs">
            <span className="opacity-80">
              {customer.first_name} {customer.last_name} · {customer.customer_number}
            </span>
            <button
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="inline-flex items-center gap-1 opacity-90 hover:opacity-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              {logoutMut.isPending ? t("shell.logging_out") : t("shell.logout")}
            </button>
          </div>
        </div>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-6 py-4">
            <Link
              to="/$slug/portal"
              params={{ slug }}
              className="flex items-center gap-3"
            >
              {manifest.brand.dashboard_logo_url ? (
                <img src={manifest.brand.dashboard_logo_url} alt="" className="h-9 w-9 object-contain" />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {manifest.bank.name.slice(0, 1)}
                </span>
              )}
              <div>
                <div
                  className="text-base font-semibold text-slate-900"
                  style={{ fontFamily: theme.typography.heading }}
                >
                  {manifest.bank.name}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  {t("shell.online_banking")}
                </div>
              </div>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell slug={slug} tone="light" />
              <button
                type="button"
                className="rounded p-2 md:hidden"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="hidden overflow-x-auto border-t md:block">
            <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-4">
              {nav.map((n) => {
                const Icon = n.icon;
                const active = activePath === n.path;
                return (
                  <Link
                    key={n.key}
                    to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
                    params={{ slug }}
                    className="inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm"
                    style={{
                      borderColor: active ? theme.colors.accent : "transparent",
                      color: active ? primary : "#334155",
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <Icon className="h-4 w-4" /> {t(n.tKey)}
                  </Link>
                );
              })}
            </div>
          </nav>
          {drawerOpen && (
            <div className="border-t md:hidden">
              {nav.map((n) => {
                const Icon = n.icon;
                const active = activePath === n.path;
                return (
                  <Link
                    key={n.key}
                    to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
                    params={{ slug }}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 border-b px-6 py-3 text-sm"
                    style={{
                      color: active ? primary : "#334155",
                      backgroundColor: active ? `${primary}0d` : undefined,
                    }}
                  >
                    <Icon className="h-4 w-4" /> {t(n.tKey)}
                  </Link>
                );
              })}
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">{content}</main>
      </div>
    );
  }

  if (variant === "premium") {
    return (
      <div
        style={{
          ...cssVars,
          fontFamily: theme.typography.body,
          minHeight: "100vh",
          backgroundColor: "#0a0a0f",
          color: "#f5f2ea",
        }}
        className="flex w-full" data-layout={dashboardLayout}
      >
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r md:flex md:flex-col"
          style={{ borderColor: "rgba(201,168,76,0.25)", backgroundColor: "#0d0d14" }}
        >
          <div className="border-b px-6 py-6" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
            <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: "#c9a84c" }}>
              {t("shell.online_banking")}
            </div>
            <div
              className="mt-2 text-xl"
              style={{
                fontFamily: `'Cormorant Garamond','Playfair Display',${theme.typography.heading},serif`,
              }}
            >
              {manifest.bank.name}
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = activePath === n.path;
              return (
                <Link
                  key={n.key}
                  to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
                  params={{ slug }}
                  className="flex items-center gap-3 px-3 py-2.5 text-[13px] uppercase tracking-[0.15em]"
                  style={{
                    color: active ? "#c9a84c" : "rgba(245,242,234,0.65)",
                    borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon className="h-4 w-4" /> {t(n.tKey)}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-4" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
            <div className="text-xs text-white/60">
              <div className="truncate text-white/85">
                {customer.first_name} {customer.last_name}
              </div>
              <div className="truncate">{customer.customer_number}</div>
            </div>
            <button
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="mt-3 w-full border px-3 py-2 text-[11px] uppercase tracking-[0.25em]"
              style={{ borderColor: "rgba(201,168,76,0.5)", color: "#c9a84c" }}
            >
              {logoutMut.isPending ? t("shell.logging_out") : t("shell.logout")}
            </button>
          </div>
        </aside>

        <header
          className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b px-4 py-3 md:hidden"
          style={{ borderColor: "rgba(201,168,76,0.25)", backgroundColor: "#0d0d14" }}
        >
          <button onClick={() => setDrawerOpen(true)} className="p-2 text-white/70">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center text-sm uppercase tracking-[0.25em]" style={{ color: "#c9a84c" }}>
            {activeLabel}
          </div>
          <NotificationBell slug={slug} tone="gold" />
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
            <div
              className="absolute inset-y-0 left-0 w-72 border-r p-4"
              style={{ borderColor: "rgba(201,168,76,0.25)", backgroundColor: "#0d0d14" }}
            >
              <button onClick={() => setDrawerOpen(false)} className="absolute right-2 top-2 p-2 text-white/70">
                <X className="h-5 w-5" />
              </button>
              <div className="mb-6 text-[10px] uppercase tracking-[0.35em]" style={{ color: "#c9a84c" }}>
                {manifest.bank.name}
              </div>
              {nav.map((n) => {
                const Icon = n.icon;
                const active = activePath === n.path;
                return (
                  <Link
                    key={n.key}
                    to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
                    params={{ slug }}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-2 py-2.5 text-[13px] uppercase tracking-[0.15em]"
                    style={{
                      color: active ? "#c9a84c" : "rgba(245,242,234,0.65)",
                    }}
                  >
                    <Icon className="h-4 w-4" /> {t(n.tKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="fixed right-4 top-4 z-30 hidden md:block">
          <NotificationBell slug={slug} tone="gold" />
        </div>

        <main className="min-w-0 flex-1 pt-16 md:ml-64 md:pt-0">
          <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">{content}</div>
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cssVars,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
        backgroundColor: "#F8FAFC",
        color: "#0f172a",
      }}
      className="flex w-full" data-layout={dashboardLayout}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 md:block">
        <SidebarBody
          manifest={manifest}
          customer={customer}
          activePath={activePath}
          slug={slug}
          onLogout={() => logoutMut.mutate()}
          loggingOut={logoutMut.isPending}
        />
      </aside>

      <header
        className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3 md:hidden"
        style={{ borderColor: "#e2e8f0" }}
      >
        <button
          type="button"
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
      
