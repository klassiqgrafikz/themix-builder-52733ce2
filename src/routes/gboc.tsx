import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { RequireAuth } from "@/components/launch/require-auth";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";

const NAV = [
  { slug: "", label: "Dashboard", icon: "LayoutDashboard" as const },
  { slug: "operations", label: "Operations Console", icon: "SlidersHorizontal" as const },
  { slug: "audit", label: "Audit Center", icon: "FileCheck2" as const },
];

export const Route = createFileRoute("/gboc")({
  head: () => ({
    meta: [
      { title: "Global Banking Operations Center — TheMixWeb" },
      {
        name: "description",
        content:
          "Centralized operations hub for every generated bank on TheMixWeb: balance operations, account controls, restrictions, transactions and audit.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GbocLayout,
});

function GbocLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth>
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
            <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
            <span className="text-muted-foreground">›</span>
            <span className="text-sm font-medium">Global Banking Operations Center</span>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/admin"
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Global Admin
              </Link>
            </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1500px]">
          <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">
            <nav className="p-3">
              <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operations
              </div>
              {NAV.map((n) => {
                const Icon = (Icons[n.icon] ?? Icons.Circle) as React.ComponentType<{
                  className?: string;
                }>;
                const to = n.slug === "" ? "/gboc" : `/gboc/${n.slug}`;
                const active = path === to;
                return (
                  <Link
                    key={n.slug}
                    to={to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                      active && "bg-muted font-medium",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
