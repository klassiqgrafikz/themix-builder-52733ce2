import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerProfile } from "./types";
import { logoutCustomer } from "./customer.functions";
import { toast } from "sonner";
import * as Icons from "lucide-react";

type NavEntry = {
  key: string;
  label: string;
  path: string;
  icon: keyof typeof Icons;
  requiresModule?: string[]; // matched against module.label OR module.key
};

const BASE_NAV: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", path: "", icon: "LayoutDashboard" },
  { key: "accounts", label: "Accounts", path: "/accounts", icon: "Wallet" },
  { key: "cards", label: "Cards", path: "/cards", icon: "CreditCard", requiresModule: ["Cards"] },
  { key: "statements", label: "Statements", path: "/statements", icon: "FileText", requiresModule: ["Statements"] },
  { key: "profile", label: "Profile", path: "/profile", icon: "User" },
  { key: "notifications", label: "Notifications", path: "/notifications", icon: "Bell", requiresModule: ["Notifications"] },
  { key: "support", label: "Support", path: "/support", icon: "LifeBuoy", requiresModule: ["Support"] },
  { key: "settings", label: "Settings", path: "/settings", icon: "Settings" },
];

function moduleEnabled(manifest: WebsiteManifest, needles: string[] | undefined): boolean {
  if (!needles) return true;
  return manifest.modules.some((m) =>
    needles.some(
      (n) => m.label.toLowerCase() === n.toLowerCase() || m.key.toLowerCase() === n.toLowerCase(),
    ),
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
  activePath: string; // e.g. "", "/accounts", "/profile"
  children: ReactNode;
}) {
  const theme = manifest.theme;
  const isDark = theme.dark_mode;
  const bg = isDark ? "#0b1120" : "#f6f7fb";
  const surface = isDark ? "#111827" : "#ffffff";
  const text = isDark ? "#e2e8f0" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#1f2937" : "#e2e8f0";

  const nav = BASE_NAV.filter((n) => moduleEnabled(manifest, n.requiresModule));
  const slug = manifest.bank.slug;
  const navigate = useNavigate();
  const doLogout = useServerFn(logoutCustomer);
  const logoutMut = useMutation({
    mutationFn: () => doLogout({ data: { slug } }),
    onSuccess: () => {
      toast.success("Signed out");
      navigate({ to: "/banks/$slug/login", params: { slug } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Logout failed"),
  });

  return (
    <div
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: theme.typography.body,
        minHeight: "100vh",
      }}
    >
      <header
        style={{ backgroundColor: surface, borderBottom: `1px solid ${border}` }}
        className="sticky top-0 z-30"
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3">
          <Link
            to="/banks/$slug"
            params={{ slug }}
            className="flex items-center gap-2 font-semibold"
            style={{ color: theme.colors.primary, fontFamily: theme.typography.heading }}
          >
            {manifest.brand.logo_url ? (
              <img src={manifest.brand.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded text-white"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                }}
              >
                {manifest.bank.name.slice(0, 1)}
              </span>
            )}
            <span>{manifest.bank.name}</span>
          </Link>
          <span className="ml-auto text-sm" style={{ color: muted }}>
            {customer.first_name} {customer.last_name} · {customer.customer_number}
          </span>
          <button
            type="button"
            onClick={() => logoutMut.mutate()}
            disabled={logoutMut.isPending}
            className="rounded px-3 py-1.5 text-sm"
            style={{ backgroundColor: `${theme.colors.primary}11`, color: theme.colors.primary }}
          >
            {logoutMut.isPending ? "Signing out…" : "Log out"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:flex-row">
        <aside
          className="w-full shrink-0 md:w-64"
          style={{ color: muted }}
        >
          <nav className="space-y-1">
            {nav.map((n) => {
              const Icon = (Icons[n.icon] ?? Icons.Circle) as React.ComponentType<{
                className?: string;
              }>;
              const active = activePath === n.path;
              return (
                <Link
                  key={n.key}
                  to={n.path === "" ? "/banks/$slug/portal" : `/banks/$slug/portal${n.path}`}
                  params={{ slug }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition"
                  style={{
                    backgroundColor: active ? `${theme.colors.primary}18` : "transparent",
                    color: active ? theme.colors.primary : muted,
                    fontFamily: theme.typography.body,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer
        className="border-t py-6"
        style={{ borderColor: border, color: muted, backgroundColor: surface }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {manifest.bank.name}. Customer portal.</span>
          <span>Powered by TheMixWeb</span>
        </div>
      </footer>
    </div>
  );
}

export function BrandedCard({
  manifest,
  children,
  className,
}: {
  manifest: WebsiteManifest;
  children: ReactNode;
  className?: string;
}) {
  const isDark = manifest.theme.dark_mode;
  const surface = isDark ? "#111827" : "#ffffff";
  const border = isDark ? "#1f2937" : "#e2e8f0";
  return (
    <div
      className={`rounded-2xl p-5 ${className ?? ""}`}
      style={{
        backgroundColor: surface,
        border: `1px solid ${border}`,
        borderRadius: Math.max(manifest.theme.radius, 12),
      }}
    >
      {children}
    </div>
  );
}
