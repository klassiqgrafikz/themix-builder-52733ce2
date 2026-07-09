import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/launch/require-auth";
import { cn } from "@/lib/utils";
import { gbocListBanks, gbocListCustomers } from "@/lib/gboc/operations.functions";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Building2,
  Users,
  SlidersHorizontal,
  Receipt,
  Bell,
  MessagesSquare,
  FileCheck2,
  FileBarChart2,
  Settings2,
  Menu,
  Search,
  type LucideIcon,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/gboc", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Tenants",
    items: [{ to: "/gboc/banks", label: "Banks", icon: Building2 }],
  },
  {
    label: "Customer Ops",
    items: [
      { to: "/gboc/customers", label: "Customers", icon: Users },
      { to: "/gboc/operations", label: "Operations Console", icon: SlidersHorizontal },
      { to: "/gboc/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    label: "Communications",
    items: [
      { to: "/gboc/notifications", label: "Notifications", icon: Bell },
      { to: "/gboc/communications", label: "Live Chat", icon: MessagesSquare },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/gboc/audit", label: "Audit Center", icon: FileCheck2 },
      { to: "/gboc/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Platform",
    items: [{ to: "/gboc/settings", label: "Settings", icon: Settings2 }],
  },
];

export const Route = createFileRoute("/gboc")({
  head: () => ({
    meta: [
      { title: "Global Banking Operations Center — TheMixWeb" },
      {
        name: "description",
        content:
          "Enterprise operations console for every generated bank on TheMixWeb: tenants, customers, transactions, notifications, audit and reports.",
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
          <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="rounded-md border p-2 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SidebarNav path={path} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="hidden text-sm font-semibold sm:inline">
              TheMixWeb
            </Link>
            <span className="hidden text-muted-foreground sm:inline">›</span>
            <span className="text-sm font-medium">GBOC</span>
            <div className="ml-auto flex flex-1 items-center gap-2 sm:flex-none">
              <GlobalSearch />
              <Link
                to="/admin"
                className="hidden rounded-md border px-3 py-1.5 text-xs hover:bg-muted sm:inline"
              >
                Global Admin
              </Link>
            </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1500px]">
          <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
            <SidebarNav path={path} />
          </aside>
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}

function SidebarNav({ path }: { path: string }) {
  return (
    <nav className="p-3">
      {NAV.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Header global search. Runs client-side over already-loaded banks and,
// once a bank is selected, over its customers via existing server functions.
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({
    queryKey: ["gboc", "banks"],
    queryFn: () => banksFn(),
  });
  const banks = banksQ.data ?? [];

  const custFn = useServerFn(gbocListCustomers);
  const custQ = useQuery({
    queryKey: ["gboc", "search-customers", q],
    enabled: open && q.trim().length >= 2 && banks.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        banks.slice(0, 8).map((b) =>
          custFn({ data: { bank_id: b.id, search: q.trim() } }).catch(() => []),
        ),
      );
      return results.flat().slice(0, 20);
    },
  });

  const filteredBanks = useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    return banks
      .filter(
        (b) =>
          b.bank_name.toLowerCase().includes(term) ||
          (b.slug ?? "").toLowerCase().includes(term) ||
          (b.country ?? "").toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [banks, q]);

  return (
    <div className="relative w-full sm:w-80">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search banks, customers, accounts…"
          className="h-9 pl-8 text-sm"
        />
      </div>
      {open && q.trim().length >= 1 && (
        <div className="absolute right-0 top-11 z-40 max-h-96 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
          {filteredBanks.length > 0 && (
            <div className="p-2">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Banks
              </div>
              {filteredBanks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onMouseDown={() => {
                    navigate({ to: "/gboc/operations", search: { bank: b.id } });
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{b.bank_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{b.country ?? ""}</span>
                </button>
              ))}
            </div>
          )}
          {(custQ.data?.length ?? 0) > 0 && (
            <div className="border-t p-2">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Customers
              </div>
              {custQ.data?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => {
                    navigate({
                      to: "/gboc/customers/$id",
                      params: { id: c.id },
                      search: { bank: c.bank_id },
                    });
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {c.primary_account_number ?? c.email}
                  </span>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 &&
            custQ.isFetched &&
            (custQ.data?.length ?? 0) === 0 &&
            filteredBanks.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matches for &ldquo;{q}&rdquo;.
              </div>
            )}
          {q.trim().length < 2 && filteredBanks.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search customers.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
