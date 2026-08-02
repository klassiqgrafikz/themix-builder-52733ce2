import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CustomerRestriction } from "./restrictions.functions";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerProfile } from "./types";
import { logoutCustomer } from "./customer.functions";
import { isNavEnabled, activePathToNavKey, ModuleNotEnabled } from "./product-gating";
import type { PortalLayoutKey } from "@/lib/dashboard-layout/types";
import { getLayoutDefinition, normalizePortalLayoutKey } from "@/lib/dashboard-layout/types";
import { toast } from "sonner";
import {
  BarChart3,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListOrdered,
  Lock,
  LogOut,
  Menu,
  Package,
  ScanLine,
  Send,
  ShieldCheck,
  User,
  Users,
  Wallet,
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

// ---------- Shared shell primitives ----------

function ShellDrawer({
  open,
  onClose,
  manifest,
  customer,
  activePath,
  slug,
  onLogout,
  loggingOut,
}: {
  open: boolean;
  onClose: () => void;
  manifest: WebsiteManifest;
  customer: CustomerProfile;
  activePath: string;
  slug: string;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in-0"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 z-10 w-72 overflow-y-auto shadow-xl animate-in fade-in-0 slide-in-from-left-full"
        style={{
          background: "linear-gradient(180deg, var(--tenant-deep) 0%, var(--tenant-dark) 100%)",
          boxShadow: "8px 0 24px -12px rgba(0,0,0,.45)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarBody
          manifest={manifest}
          customer={customer}
          activePath={activePath}
          slug={slug}
          onNavigate={onClose}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      </div>
    </div>
  );
}

function BottomNav({
  items,
  activePath,
  slug,
  onMenu,
}: {
  items: { key: string; tKey: TranslationKey; path?: string; icon: LucideIcon; menu?: boolean }[];
  activePath: string;
  slug: string;
  onMenu: () => void;
}) {
  const t = useT();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 py-1.5">
        {items.map((n) => {
          const Icon = n.icon;
          const active = !n.menu && activePath === (n.path ?? "");
          const cls = `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition ${
            active ? "text-[var(--tenant-primary)]" : "text-slate-500 hover:text-slate-800"
          }`;
          if (n.menu) {
            return (
              <button key={n.key} type="button" onClick={onMenu} className={cls}>
                <Icon className="h-5 w-5" />
                {t(n.tKey)}
              </button>
            );
          }
          return (
            <Link
              key={n.key}
              to={n.path === "" || !n.path ? "/$slug/portal" : `/$slug/portal${n.path}`}
              params={{ slug }}
              className={cls}
            >
              <Icon className="h-5 w-5" />
              {t(n.tKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function greetingFor(t: ReturnType<typeof useT>, name: string): string {
  const h = new Date().getHours();
  if (h < 12) return t("shell.good_morning", { name });
  if (h < 18) return t("shell.good_afternoon", { name });
  return t("shell.good_evening", { name });
}

// ---------- Restriction helpers ----------

const RestrictionsContext = createContext<CustomerRestriction[]>([]);

export function useRestrictions(): CustomerRestriction[] {
  return useContext(RestrictionsContext);
}

export function isFeatureRestricted(
  restrictions: CustomerRestriction[] | undefined | null,
  feature: string,
): boolean {
  if (!restrictions?.length) return false;
  const now = Date.now();
  const f = feature.toLowerCase();
  return restrictions.some((r) => {
    if (!r.active) return false;
    if (r.end_at && new Date(r.end_at).getTime() < now) return false;
    if (r.start_at && new Date(r.start_at).getTime() > now) return false;
    const types = (r.types ?? []).map((t) => t.toLowerCase());
    return types.length === 0 || types.includes("all") || types.includes(f);
  });
}

function RestrictionBanner({ restrictions }: { restrictions: CustomerRestriction[] }) {
  const active = restrictions.filter((r) => r.active);
  if (!active.length) return null;
  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="font-semibold">Account restricted</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800/90">
        {active.map((r) => (
          <li key={r.id}>{r.reason || (r.types?.join(", ") ?? "Restricted")}</li>
        ))}
      </ul>
    </div>
      );
  }
// ---------- Branded card wrapper ----------

export function BrandedCard({
  manifest: _manifest,
  className = "",
  children,
}: {
  manifest: WebsiteManifest;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
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
  const portalLayoutKey = normalizePortalLayoutKey(manifest.portal_layout_key);

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

  const layoutDef = getLayoutDefinition(portalLayoutKey);
  const nav = layoutDef.nav_items
    .map((key) => NAV.find((n) => n.key === key))
    .filter((n): n is NavEntry => n !== null)
    .filter((n) => isNavEnabled(manifest, n.key));
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

  const shellBase = {
    ...cssVars,
    fontFamily: theme.typography.body,
    minHeight: "100vh",
    backgroundColor: "#F8FAFC",
    color: "#0f172a",
  } as CSSProperties;

  const initials = `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase();
  const drawer = (
    <ShellDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      manifest={manifest}
      customer={customer}
      activePath={activePath}
      slug={slug}
      onLogout={() => logoutMut.mutate()}
      loggingOut={logoutMut.isPending}
    />
  );

  switch (portalLayoutKey) {
    case "traditional":
      return (
        <div style={shellBase} className="flex min-h-screen w-full flex-col" data-layout="traditional">
          <header
            className="relative overflow-hidden"
            style={{ background: `linear-gradient(120deg, var(--tenant-deep) 0%, var(--tenant-primary) 60%, var(--tenant-accent, var(--tenant-primary)) 100%)` }}
          >
            {manifest.brand.dashboard_logo_url && (
              <div
                className="absolute inset-0 opacity-15"
                style={{ backgroundImage: `url(${manifest.brand.dashboard_logo_url})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            )}
            <div className="relative flex w-full items-center justify-between gap-4 px-6 py-6 md:px-10 md:py-8">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  aria-label={t("shell.menu")}
                  onClick={() => setDrawerOpen(true)}
                  className="flex-none rounded-xl bg-white/15 p-2.5 text-white transition hover:bg-white/25"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
                    {manifest.bank.name} · {t("shell.online_banking")}
                  </p>
                  <h1 className="mt-1 truncate text-2xl font-bold text-white md:text-3xl" style={{ fontFamily: theme.typography.heading }}>
                    {t("shell.hello", { name: customer.first_name })}
                  </h1>
                </div>
              </div>
              <NotificationBell slug={slug} tone="dark" />
            </div>
          </header>
          <main className="w-full flex-1 px-6 py-8 md:px-10 md:py-10">{content}</main>
          {drawer}
        </div>
      );
    case "secure_tools":
      return (
        <div style={shellBase} className="flex min-h-screen w-full flex-col" data-layout="secure-tools">
          <div className="border-b border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between gap-3 px-6 py-2 md:px-10">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Lock className="h-3.5 w-3.5" /> {t("shell.secure_banking")}
              </p>
            </div>
          </div>
          <header className="border-b border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between gap-4 px-6 py-4 md:px-10">
              <Link to="/$slug/portal" params={{ slug }} className="flex min-w-0 items-center gap-2.5">
                {manifest.brand.dashboard_logo_url ? (
                  <img src={manifest.brand.dashboard_logo_url} alt="" className="h-9 w-9 flex-none rounded-lg object-contain" />
                ) : (
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-lg text-sm font-bold text-white"
                    style={{ background: "var(--tenant-primary)" }}
                  >
                    {manifest.bank.name.slice(0, 1)}
                  </span>
                )}
                <span className="truncate text-[15px] font-semibold text-slate-900" style={{ fontFamily: theme.typography.heading }}>
                  {manifest.bank.name}
                </span>
              </Link>
              <nav className="hidden items-center gap-0.5 lg:flex">
                {nav.map((n) => (
                  <Link
                    key={n.key}
                    to={n.path === "" ? "/$slug/portal" : `/$slug/portal${n.path}`}
                    params={{ slug }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      activePath === n.path ? "text-[var(--tenant-primary)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {t(n.tKey)}
                  </Link>
                ))}
              </nav>
              <div className="flex flex-none items-center gap-2">
                <NotificationBell slug={slug} tone="light" />
                <button
                  type="button"
                  onClick={() => logoutMut.mutate()}
                  disabled={logoutMut.isPending}
                  className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:flex"
                >
                  <LogOut className="h-4 w-4" /> {logoutMut.isPending ? t("shell.logging_out") : t("shell.logout")}
                </button>
                <button
                  type="button"
                  aria-label={t("shell.menu")}
                  onClick={() => setDrawerOpen(true)}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>
          <main className="w-full flex-1 px-6 py-8 md:px-10 md:py-10">{content}</main>
          {drawer}
        </div>
      );
    case "multi_account":
      return (
        <div style={shellBase} className="flex min-h-screen w-full flex-col" data-layout="multi-account">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between gap-3 px-5 py-3.5">
              <Link
                to="/$slug/portal/profile"
                params={{ slug }}
                aria-label="Profile"
                className="grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--tenant-primary)" }}
              >
                {initials}
              </Link>
              <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                {t("shell.hello", { name: customer.first_name })}
              </p>
              <NotificationBell slug={slug} tone="light" />
            </div>
          </header>
          <main className="w-full flex-1 px-5 py-6 pb-24">{content}</main>
          <BottomNav
            slug={slug}
            activePath={activePath}
            onMenu={() => setDrawerOpen(true)}
            items={[
              { key: "menu", tKey: "shell.menu", icon: Menu, menu: true },
              { key: "accounts", tKey: "nav.accounts", path: "/accounts", icon: Wallet },
              { key: "quick", tKey: "shell.quick_links", path: "/cards", icon: LayoutGrid },
              { key: "payments", tKey: "shell.payments", path: "/transfer", icon: Send },
              { key: "services", tKey: "shell.services", path: "/support", icon: LifeBuoy },
            ]}
          />
          {drawer}
        </div>
      );
    case "rewards":
      return (
        <div style={shellBase} className="flex min-h-screen w-full flex-col" data-layout="rewards">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between gap-3 px-5 py-3.5">
              <button
                type="button"
                aria-label={t("shell.menu")}
                onClick={() => setDrawerOpen(true)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1">
                <Link to="/$slug/portal/notifications" params={{ slug }} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("shell.inbox")}>
                  <Inbox className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
                </Link>
                <Link to="/$slug/portal/notifications" params={{ slug }} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("shell.products")}>
                  <Package className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
                </Link>
              </div>
              <button
                type="button"
                onClick={() => logoutMut.mutate()}
                disabled={logoutMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" /> {logoutMut.isPending ? t("shell.logging_out") : t("shell.log_out")}
              </button>
            </div>
          </header>
          <main className="w-full flex-1 px-5 py-6 pb-24">{content}</main>
          <BottomNav
            slug={slug}
            activePath={activePath}
            onMenu={() => setDrawerOpen(true)}
            items={[
              { key: "accounts", tKey: "nav.accounts", path: "/accounts", icon: Wallet },
              { key: "pay", tKey: "shell.pay_transfer", path: "/transfer", icon: Send },
              { key: "deposit", tKey: "shell.deposit_checks", path: "/cards", icon: ScanLine },
              { key: "services", tKey: "shell.services", path: "/support", icon: LifeBuoy },
            ]}
          />
          {drawer}
        </div>
      );
    case "neo":
      return (
        <div style={shellBase} className="flex min-h-screen w-full flex-col" data-layout="neo">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between gap-3 px-5 py-3.5">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                {greetingFor(t, customer.first_name)}
              </p>
              <NotificationBell slug={slug} tone="light" />
            </div>
          </header>
          <main className="w-full flex-1 px-5 py-6 pb-24">{content}</main>
          <BottomNav
            slug={slug}
            activePath={activePath}
            onMenu={() => setDrawerOpen(true)}
            items={[
              { key: "home", tKey: "shell.home", path: "", icon: LayoutDashboard },
              { key: "analytics", tKey: "shell.analytics", path: "/transactions", icon: BarChart3 },
              { key: "profile", tKey: "nav.profile", path: "/profile", icon: User },
            ]}
          />
          {drawer}
        </div>
      );
    case "sidebar":
    default:
      return (
        <div
          style={shellBase}
          className="flex w-full" data-layout="sidebar"
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
              aria-label={t("shell.menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 truncate text-center text-sm font-semibold text-slate-900">
              {activeLabel}
            </div>
            <NotificationBell slug={slug} tone="light" />
          </header>

          {drawer}

          <main className="min-w-0 flex-1 pt-16 md:ml-72 md:pt-0">
            <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:px-10">{content}</div>
          </main>
        </div>
      );
  }
}
