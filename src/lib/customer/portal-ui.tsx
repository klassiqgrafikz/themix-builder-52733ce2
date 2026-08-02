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
import { getLayoutDefinition } from "@/lib/dashboard-layout/types";
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
  const portalLayoutKey: PortalLayoutKey = "sidebar";

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

  return (
        <div
          style={{
            ...cssVars,
            fontFamily: theme.typography.body,
            minHeight: "100vh",
            backgroundColor: "#F8FAFC",
            color: "#0f172a",
          }}
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

          {drawerOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-xl">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="absolute right-2 top-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={t("shell.close")}
                >
                  <X className="h-5 w-5" />
                </button>
                <SidebarBody
                  manifest={manifest}
                  customer={customer}
                  activePath={activePath}
                  slug={slug}
                  onNavigate={() => setDrawerOpen(false)}
                  onLogout={() => logoutMut.mutate()}
                  loggingOut={logoutMut.isPending}
                />
              </div>
            </div>
          )}

          <main className="min-w-0 flex-1 pt-16 md:ml-72 md:pt-0">
            <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">{content}</div>
          </main>
        </div>
      );
}
