import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CustomerRestriction } from "./restrictions.functions";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerProfile } from "./types";
import { logoutCustomer } from "./customer.functions";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Wallet,
  Send,
  Users,
  ListOrdered,
  CreditCard,
  FileText,
  Bell,
  LifeBuoy,
  ShieldCheck,
  User,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

type NavEntry = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

const NAV: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", path: "", icon: LayoutDashboard },
  { key: "accounts", label: "Accounts", path: "/accounts", icon: Wallet },
  { key: "transfer", label: "Transfer", path: "/transfer", icon: Send },
  { key: "beneficiaries", label: "Beneficiaries", path: "/beneficiaries", icon: Users },
  { key: "transactions", label: "Transactions", path: "/transactions", icon: ListOrdered },
  { key: "cards", label: "Cards", path: "/cards", icon: CreditCard },
  { key: "statements", label: "Statements", path: "/statements", icon: FileText },
  { key: "notifications", label: "Notifications", path: "/notifications", icon: Bell },
  { key: "support", label: "Support", path: "/support", icon: LifeBuoy },
  { key: "security", label: "Security", path: "/security", icon: ShieldCheck },
  { key: "profile", label: "Profile", path: "/profile", icon: User },
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
          to="/banks/$slug/portal"
          params={{ slug }}
          onClick={onNavigate}
          className="flex items-center gap-3"
        >
          {manifest.brand.logo_url ? (
            <img
              src={manifest.brand.logo_url}
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
              Premium Banking
            </div>
          </div>
        </Link>
      </div>

      <div className="mx-6 mb-4 h-px bg-white/10" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-4">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = activePath === n.path;
          return (
            <Link
              key={n.key}
              to={n.path === "" ? "/banks/$slug/portal" : `/banks/$slug/portal${n.path}`}
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
              <span>{n.label}</span>
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
          {loggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </div>
  );
}

export function PortalShell({
  manifest,
  customer,
  activePath,
  children,
}: {
  manifest: WebsiteManifest;
  customer: CustomerProfile;
  activePath: string;
  children: ReactNode;
}) {
  const theme = manifest.theme;
  const primary = theme.colors.primary || "#061938";
  const tenantDark = shade(primary, 0.55);
  const tenantDeep = shade(primary, 0.7);

  const slug = manifest.bank.slug;
  const navigate = useNavigate();
  const doLogout = useServerFn(logoutCustomer);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Remember last selected page (per slug) — restore on mount if landing on base.
  useEffect(() => {
    try {
      const key = `portal:last:${slug}`;
      if (activePath && activePath !== "") {
        localStorage.setItem(key, activePath);
      }
    } catch { /* ignore */ }
  }, [activePath, slug]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [activePath]);

  const logoutMut = useMutation({
    mutationFn: () => doLogout({ data: { slug } }),
    onSuccess: () => {
      toast.success("Signed out");
      navigate({ to: "/banks/$slug/login", params: { slug } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Logout failed"),
  });

  const cssVars = {
    "--tenant-primary": primary,
    "--tenant-accent": theme.colors.accent,
    "--tenant-dark": tenantDark,
    "--tenant-deep": tenantDeep,
  } as CSSProperties;

  const activeLabel =
    NAV.find((n) => n.path === activePath)?.label ?? "Dashboard";

  return (
    <div
      style={{
        ...cssVars,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
        backgroundColor: "#F8FAFC",
        color: "#0f172a",
      }}
      className="flex w-full"
    >
      {/* Desktop sidebar */}
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

      {/* Mobile top bar */}
      <header
        className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3 md:hidden"
        style={{ borderColor: "#e2e8f0" }}
      >
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div
          className="flex-1 truncate text-center text-sm font-semibold"
          style={{ color: "var(--tenant-primary)", fontFamily: theme.typography.heading }}
        >
          {activeLabel}
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-lg p-2 text-white/80 hover:bg-white/10"
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
        <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

export function BrandedCard({
  manifest: _manifest,
  children,
  className,
}: {
  manifest: WebsiteManifest;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
